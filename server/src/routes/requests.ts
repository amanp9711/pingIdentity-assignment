import { Router, Request, Response } from 'express';
import { getAll, getById, update } from '../store';
import {
  AccessRequest,
  DecisionBody,
  BulkDecisionBody,
  BulkResult,
  Priority,
} from '../types';

const router = Router();

const PRIORITY_ORDER: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// GET /requests
router.get('/', (req: Request, res: Response) => {
  const {
    status,
    type,
    riskFlag,
    search,
    sortBy = 'requestedAt',
    sortDir = 'desc',
    page: pageStr = '1',
    pageSize: pageSizeStr = '25',
  } = req.query as Record<string, string>;

  let items = getAll();

  // Filters
  if (status) {
    const statuses = status.split(',').map((s) => s.trim().toUpperCase());
    items = items.filter((r) => statuses.includes(r.status));
  }
  if (type) {
    const types = type.split(',').map((t) => t.trim().toUpperCase());
    items = items.filter((r) => types.includes(r.type));
  }
  if (riskFlag) {
    const flags = riskFlag.split(',').map((f) => f.trim().toUpperCase());
    items = items.filter((r) => r.riskFlags.some((flag) => flags.includes(flag.toUpperCase())));
  }
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (r) =>
        r.requester.name.toLowerCase().includes(q) ||
        r.resource.name.toLowerCase().includes(q) ||
        r.requestId.toLowerCase().includes(q)
    );
  }

  // Sort
  const validSortBy = ['requestedAt', 'dueDate', 'requester', 'resource', 'priority'];
  const col = validSortBy.includes(sortBy) ? sortBy : 'requestedAt';
  const dir = sortDir === 'asc' ? 1 : -1;

  items = [...items].sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    switch (col) {
      case 'requester':
        av = a.requester.name;
        bv = b.requester.name;
        break;
      case 'resource':
        av = a.resource.name;
        bv = b.resource.name;
        break;
      case 'priority':
        av = PRIORITY_ORDER[a.priority];
        bv = PRIORITY_ORDER[b.priority];
        break;
      default:
        av = a[col as 'requestedAt' | 'dueDate'];
        bv = b[col as 'requestedAt' | 'dueDate'];
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  // Pagination
  const total = items.length;
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr, 10) || 25));
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  res.json({ items: paged, page, pageSize, total });
});

// GET /requests/:id
router.get('/:id', (req: Request, res: Response) => {
  const record = getById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'NOT_FOUND', message: `Request ${req.params.id} not found` });
  }
  res.json(record);
});

// POST /requests/:id/decision
router.post('/:id/decision', (req: Request, res: Response) => {
  const record = getById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'NOT_FOUND', message: `Request ${req.params.id} not found` });
  }

  const candidate: unknown = req.body;
  if (
    !isRecord(candidate) ||
    typeof candidate.decision !== 'string' ||
    typeof candidate.version !== 'number' ||
    !Number.isInteger(candidate.version) ||
    (candidate.justification !== undefined && typeof candidate.justification !== 'string')
  ) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Body must include a decision, numeric version, and optional string justification' });
  }
  if (!['APPROVE', 'DENY'].includes(candidate.decision)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: `Unknown decision value: ${candidate.decision}` });
  }
  const body = candidate as unknown as DecisionBody;

  // 409 — version mismatch or already decided
  if (record.status !== 'PENDING') {
    return res.status(409).json({ error: 'ALREADY_DECIDED', message: `Request ${record.requestId} is not PENDING (current status: ${record.status})` });
  }
  if (body.version !== record.version) {
    return res.status(409).json({ error: 'STALE_VERSION', message: `Version mismatch: sent ${body.version}, current is ${record.version}` });
  }

  // 422 — validation
  const hasRiskFlags = record.riskFlags.length > 0;
  const justification = body.justification?.trim();
  if (body.decision === 'DENY' && !justification) {
    return res.status(422).json({ error: 'JUSTIFICATION_REQUIRED', message: 'A justification is required when denying a request' });
  }
  if (body.decision === 'APPROVE' && hasRiskFlags && !justification) {
    return res.status(422).json({ error: 'JUSTIFICATION_REQUIRED', message: 'A justification is required when approving a risk-flagged request' });
  }

  // Apply decision
  const now = new Date().toISOString();
  const outcome = body.decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
  const decidedBy = 'Admin User'; // out of scope: auth

  const updated: AccessRequest = {
    ...record,
    status: outcome,
    version: record.version + 1,
    decision: {
      outcome,
      decidedBy,
      decidedAt: now,
      justification: justification || '',
    },
    history: [
      ...record.history,
      { at: now, event: 'DECIDED', actor: decidedBy },
    ],
  };

  update(updated);
  res.json(updated);
});

// POST /requests/bulk-decision
router.post('/bulk-decision', (req: Request, res: Response) => {
  const candidate: unknown = req.body;
  if (
    !isRecord(candidate) ||
    typeof candidate.decision !== 'string' ||
    !Array.isArray(candidate.items) ||
    (candidate.justification !== undefined && typeof candidate.justification !== 'string')
  ) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Body must include a decision, items array, and optional string justification' });
  }
  if (!['APPROVE', 'DENY'].includes(candidate.decision)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: `Unknown decision value: ${candidate.decision}` });
  }
  const body = candidate as unknown as BulkDecisionBody;

  const justification = body.justification?.trim();
  const now = new Date().toISOString();
  const decidedBy = 'Admin User';
  const results: BulkResult[] = [];

  for (const item of body.items) {
    if (
      !isRecord(item) ||
      typeof item.requestId !== 'string' ||
      item.requestId.trim().length === 0 ||
      typeof item.version !== 'number' ||
      !Number.isInteger(item.version)
    ) {
      const requestId = isRecord(item) && typeof item.requestId === 'string' ? item.requestId : '';
      results.push({ requestId, outcome: 'FAILED', reason: 'BAD_REQUEST' });
      continue;
    }

    const record = getById(item.requestId);

    if (!record) {
      results.push({ requestId: item.requestId, outcome: 'FAILED', reason: 'NOT_FOUND' });
      continue;
    }
    if (record.status !== 'PENDING') {
      results.push({ requestId: item.requestId, outcome: 'FAILED', reason: 'ALREADY_DECIDED' });
      continue;
    }
    if (item.version !== record.version) {
      results.push({ requestId: item.requestId, outcome: 'FAILED', reason: 'STALE_VERSION' });
      continue;
    }

    const hasRiskFlags = record.riskFlags.length > 0;
    if (body.decision === 'DENY' && !justification) {
      results.push({ requestId: item.requestId, outcome: 'FAILED', reason: 'JUSTIFICATION_REQUIRED' });
      continue;
    }
    if (body.decision === 'APPROVE' && hasRiskFlags && !justification) {
      results.push({ requestId: item.requestId, outcome: 'FAILED', reason: 'JUSTIFICATION_REQUIRED' });
      continue;
    }

    const outcome = body.decision === 'APPROVE' ? 'APPROVED' : 'DENIED';
    const updated: AccessRequest = {
      ...record,
      status: outcome,
      version: record.version + 1,
      decision: {
        outcome,
        decidedBy,
        decidedAt: now,
        justification: justification || '',
      },
      history: [
        ...record.history,
        { at: now, event: 'DECIDED', actor: decidedBy },
      ],
    };
    update(updated);
    results.push({ requestId: item.requestId, outcome: 'SUCCESS' });
  }

  res.json({ results });
});

export default router;
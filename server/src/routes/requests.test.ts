import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Mock the store so we control data
vi.mock('../store.js', () => {
  const data: any[] = [];
  return {
    loadData: vi.fn(),
    getAll: () => data,
    getById: (id: string) => data.find((r: any) => r.requestId === id),
    update: (updated: any) => {
      const idx = data.findIndex((r: any) => r.requestId === updated.requestId);
      if (idx !== -1) data[idx] = updated;
    },
    __data: data,
  };
});

import * as store from '../store.js';
import requestsRouter from './requests.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/requests', requestsRouter);

const __data = (store as any).__data as any[];

function seedRequest(overrides: Partial<any> = {}) {
  const base = {
    requestId: `ar-test-${Math.random().toString(36).slice(2, 7)}`,
    type: 'GRANT',
    status: 'PENDING',
    priority: 'NORMAL',
    requester: { name: 'Test User', department: 'Engineering', manager: 'T. Manager' },
    resource: { name: 'Test Resource', system: 'TestSys', type: 'ENTITLEMENT' },
    requesterJustification: 'Test justification',
    riskFlags: [],
    requestedAt: '2026-09-20T10:00:00Z',
    dueDate: '2026-09-30',
    version: 1,
    decision: null,
    history: [{ at: '2026-09-20T10:00:00Z', event: 'REQUESTED', actor: 'Test User' }],
    ...overrides,
  };
  __data.push(base);
  return base;
}

beforeEach(() => {
  __data.length = 0;
});

// ────────────────────────────────────────────
// GET /requests — filtering
// ────────────────────────────────────────────
describe('GET /requests — filtering', () => {
  it('returns all requests with no filters', async () => {
    seedRequest();
    seedRequest();
    const res = await request(app).get('/requests');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
  });

  it('filters by status', async () => {
    seedRequest({ status: 'PENDING' });
    seedRequest({ status: 'APPROVED' });
    const res = await request(app).get('/requests?status=PENDING');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].status).toBe('PENDING');
  });

  it('filters by type', async () => {
    seedRequest({ type: 'GRANT' });
    seedRequest({ type: 'REVOKE' });
    const res = await request(app).get('/requests?type=REVOKE');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].type).toBe('REVOKE');
  });

  it('filters by riskFlag', async () => {
    seedRequest({ riskFlags: ['SOD_CONFLICT'] });
    seedRequest({ riskFlags: [] });
    const res = await request(app).get('/requests?riskFlag=SOD_CONFLICT');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].riskFlags).toContain('SOD_CONFLICT');
  });

  it('filters by search — requester name (case insensitive)', async () => {
    seedRequest({ requester: { name: 'Alice Wonderland', department: 'Eng' } });
    seedRequest({ requester: { name: 'Bob Builder', department: 'IT' } });
    const res = await request(app).get('/requests?search=alice');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].requester.name).toBe('Alice Wonderland');
  });

  it('filters by search — resource name', async () => {
    seedRequest({ resource: { name: 'Payment Gateway', system: 'ERP', type: 'ENTITLEMENT' } });
    seedRequest({ resource: { name: 'VPN Access', system: 'Network', type: 'ENTITLEMENT' } });
    const res = await request(app).get('/requests?search=payment');
    expect(res.body.total).toBe(1);
  });

  it('filters by search — requestId', async () => {
    seedRequest({ requestId: 'ar-99999' });
    seedRequest({ requestId: 'ar-88888' });
    const res = await request(app).get('/requests?search=99999');
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].requestId).toBe('ar-99999');
  });

  it('returns empty items array when nothing matches', async () => {
    seedRequest({ status: 'PENDING' });
    const res = await request(app).get('/requests?status=APPROVED');
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });
});

// ────────────────────────────────────────────
// GET /requests — sorting
// ────────────────────────────────────────────
describe('GET /requests — sorting', () => {
  it('sorts by requestedAt desc by default', async () => {
    seedRequest({ requestId: 'ar-old', requestedAt: '2026-09-10T00:00:00Z' });
    seedRequest({ requestId: 'ar-new', requestedAt: '2026-09-25T00:00:00Z' });
    const res = await request(app).get('/requests');
    expect(res.body.items[0].requestId).toBe('ar-new');
  });

  it('sorts by requestedAt asc', async () => {
    seedRequest({ requestId: 'ar-old', requestedAt: '2026-09-10T00:00:00Z' });
    seedRequest({ requestId: 'ar-new', requestedAt: '2026-09-25T00:00:00Z' });
    const res = await request(app).get('/requests?sortBy=requestedAt&sortDir=asc');
    expect(res.body.items[0].requestId).toBe('ar-old');
  });

  it('sorts by priority desc', async () => {
    seedRequest({ requestId: 'ar-low', priority: 'LOW' });
    seedRequest({ requestId: 'ar-high', priority: 'HIGH' });
    const res = await request(app).get('/requests?sortBy=priority&sortDir=desc');
    expect(res.body.items[0].requestId).toBe('ar-high');
  });

  it('sorts by requester name asc', async () => {
    seedRequest({ requester: { name: 'Zara Khan', department: 'IT' } });
    seedRequest({ requester: { name: 'Alice Smith', department: 'IT' } });
    const res = await request(app).get('/requests?sortBy=requester&sortDir=asc');
    expect(res.body.items[0].requester.name).toBe('Alice Smith');
  });

  it('sorts by dueDate asc', async () => {
    seedRequest({ requestId: 'ar-later', dueDate: '2026-10-05' });
    seedRequest({ requestId: 'ar-sooner', dueDate: '2026-09-25' });
    const res = await request(app).get('/requests?sortBy=dueDate&sortDir=asc');
    expect(res.body.items[0].requestId).toBe('ar-sooner');
  });

  it('sorts by resource name asc', async () => {
    seedRequest({ resource: { name: 'Zulu Resource', system: 'IT', type: 'ROLE' } });
    seedRequest({ resource: { name: 'Alpha Resource', system: 'IT', type: 'ROLE' } });
    const res = await request(app).get('/requests?sortBy=resource&sortDir=asc');
    expect(res.body.items[0].resource.name).toBe('Alpha Resource');
  });
});

// ────────────────────────────────────────────
// GET /requests — pagination
// ────────────────────────────────────────────
describe('GET /requests — pagination', () => {
  it('paginates correctly', async () => {
    for (let i = 0; i < 10; i++) seedRequest();
    const res = await request(app).get('/requests?page=2&pageSize=3');
    expect(res.body.total).toBe(10);
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.items).toHaveLength(3);
  });

  it('caps pageSize at 100', async () => {
    for (let i = 0; i < 5; i++) seedRequest();
    const res = await request(app).get('/requests?pageSize=999');
    expect(res.body.pageSize).toBe(100);
  });

  it('returns empty items for page beyond total', async () => {
    seedRequest();
    const res = await request(app).get('/requests?page=99&pageSize=25');
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(0);
  });

  it('defaults pageSize to 25', async () => {
    const res = await request(app).get('/requests');
    expect(res.body.pageSize).toBe(25);
  });
});

// ────────────────────────────────────────────
// GET /requests/:id
// ────────────────────────────────────────────
describe('GET /requests/:id', () => {
  it('returns a request by id', async () => {
    const r = seedRequest({ requestId: 'ar-12345' });
    const res = await request(app).get('/requests/ar-12345');
    expect(res.status).toBe(200);
    expect(res.body.requestId).toBe('ar-12345');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/requests/ar-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ────────────────────────────────────────────
// POST /requests/:id/decision — 409 cases
// ────────────────────────────────────────────
describe('POST /requests/:id/decision — 409 conditions', () => {
  it('returns 409 STALE_VERSION when version does not match', async () => {
    const r = seedRequest({ requestId: 'ar-v1', version: 1 });
    const res = await request(app)
      .post('/requests/ar-v1/decision')
      .send({ decision: 'APPROVE', version: 99 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('STALE_VERSION');
  });

  it('returns 409 ALREADY_DECIDED when request is APPROVED', async () => {
    seedRequest({ requestId: 'ar-approved', status: 'APPROVED', version: 2 });
    const res = await request(app)
      .post('/requests/ar-approved/decision')
      .send({ decision: 'DENY', justification: 'too late', version: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_DECIDED');
  });

  it('returns 409 ALREADY_DECIDED when request is DENIED', async () => {
    seedRequest({ requestId: 'ar-denied', status: 'DENIED', version: 2 });
    const res = await request(app)
      .post('/requests/ar-denied/decision')
      .send({ decision: 'APPROVE', version: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_DECIDED');
  });

  it('returns 409 ALREADY_DECIDED when request is CANCELLED', async () => {
    seedRequest({ requestId: 'ar-cancelled', status: 'CANCELLED', version: 1 });
    const res = await request(app)
      .post('/requests/ar-cancelled/decision')
      .send({ decision: 'APPROVE', version: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_DECIDED');
  });
});

// ────────────────────────────────────────────
// POST /requests/:id/decision — 422 cases
// ────────────────────────────────────────────
describe('POST /requests/:id/decision — 422 conditions', () => {
  it('returns 422 JUSTIFICATION_REQUIRED when DENY with no justification', async () => {
    seedRequest({ requestId: 'ar-deny-nojust', riskFlags: [] });
    const res = await request(app)
      .post('/requests/ar-deny-nojust/decision')
      .send({ decision: 'DENY', version: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('JUSTIFICATION_REQUIRED');
  });

  it('returns 422 JUSTIFICATION_REQUIRED when DENY with empty justification', async () => {
    seedRequest({ requestId: 'ar-deny-emptyjust', riskFlags: [] });
    const res = await request(app)
      .post('/requests/ar-deny-emptyjust/decision')
      .send({ decision: 'DENY', justification: '   ', version: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('JUSTIFICATION_REQUIRED');
  });

  it('returns 422 JUSTIFICATION_REQUIRED when APPROVE on risk-flagged request with no justification', async () => {
    seedRequest({ requestId: 'ar-approve-risky', riskFlags: ['SOD_CONFLICT'] });
    const res = await request(app)
      .post('/requests/ar-approve-risky/decision')
      .send({ decision: 'APPROVE', version: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('JUSTIFICATION_REQUIRED');
  });

  it('allows APPROVE on risk-flagged request WITH justification', async () => {
    seedRequest({ requestId: 'ar-approve-risky-just', riskFlags: ['SOD_CONFLICT'] });
    const res = await request(app)
      .post('/requests/ar-approve-risky-just/decision')
      .send({ decision: 'APPROVE', justification: 'Compensating control in place.', version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('allows APPROVE on non-risk request WITHOUT justification', async () => {
    seedRequest({ requestId: 'ar-approve-safe', riskFlags: [] });
    const res = await request(app)
      .post('/requests/ar-approve-safe/decision')
      .send({ decision: 'APPROVE', version: 1 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });
});

describe('POST /requests/:id/decision — malformed body', () => {
  it('returns 400 when justification is not a string', async () => {
    const record = seedRequest({ requestId: 'ar-invalid-justification' });
    const res = await request(app)
      .post('/requests/ar-invalid-justification/decision')
      .send({ decision: 'APPROVE', justification: 42, version: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(record.status).toBe('PENDING');
  });
});

// ────────────────────────────────────────────
// POST /requests/:id/decision — success
// ────────────────────────────────────────────
describe('POST /requests/:id/decision — success', () => {
  it('increments version on decision', async () => {
    seedRequest({ requestId: 'ar-ver', version: 1 });
    const res = await request(app)
      .post('/requests/ar-ver/decision')
      .send({ decision: 'APPROVE', version: 1 });
    expect(res.body.version).toBe(2);
  });

  it('appends DECIDED event to history', async () => {
    seedRequest({ requestId: 'ar-hist', history: [{ at: '2026-09-20T10:00:00Z', event: 'REQUESTED', actor: 'Test User' }] });
    const res = await request(app)
      .post('/requests/ar-hist/decision')
      .send({ decision: 'APPROVE', version: 1 });
    expect(res.body.history).toHaveLength(2);
    expect(res.body.history[1].event).toBe('DECIDED');
  });

  it('subsequent decision returns 409 ALREADY_DECIDED', async () => {
    seedRequest({ requestId: 'ar-double' });
    await request(app).post('/requests/ar-double/decision').send({ decision: 'APPROVE', version: 1 });
    const res = await request(app).post('/requests/ar-double/decision').send({ decision: 'DENY', justification: 'try again', version: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ALREADY_DECIDED');
  });
});

// ────────────────────────────────────────────
// POST /requests/bulk-decision
// ────────────────────────────────────────────
describe('POST /requests/bulk-decision', () => {
  it('reports malformed items independently and continues valid items', async () => {
    seedRequest({ requestId: 'ar-b-valid' });
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [null, { requestId: 'ar-b-valid', version: 1 }],
        decision: 'APPROVE',
      });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { requestId: '', outcome: 'FAILED', reason: 'BAD_REQUEST' },
      { requestId: 'ar-b-valid', outcome: 'SUCCESS' },
    ]);
    expect(store.getById('ar-b-valid')?.status).toBe('APPROVED');
  });

  it('returns 400 when bulk justification is not a string', async () => {
    const record = seedRequest({ requestId: 'ar-b-invalid-justification' });
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [{ requestId: 'ar-b-invalid-justification', version: 1 }],
        decision: 'APPROVE',
        justification: 42,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BAD_REQUEST');
    expect(record.status).toBe('PENDING');
  });

  it('processes all items successfully', async () => {
    const r1 = seedRequest({ requestId: 'ar-b1' });
    const r2 = seedRequest({ requestId: 'ar-b2' });
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [{ requestId: 'ar-b1', version: 1 }, { requestId: 'ar-b2', version: 1 }],
        decision: 'DENY',
        justification: 'Bulk policy violation',
      });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
    expect(res.body.results.every((r: any) => r.outcome === 'SUCCESS')).toBe(true);
  });

  it('reports ALREADY_DECIDED for non-pending items in bulk', async () => {
    seedRequest({ requestId: 'ar-b-pending' });
    seedRequest({ requestId: 'ar-b-approved', status: 'APPROVED', version: 2 });
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [
          { requestId: 'ar-b-pending', version: 1 },
          { requestId: 'ar-b-approved', version: 2 },
        ],
        decision: 'DENY',
        justification: 'Bulk deny',
      });
    expect(res.body.results[0].outcome).toBe('SUCCESS');
    expect(res.body.results[1].outcome).toBe('FAILED');
    expect(res.body.results[1].reason).toBe('ALREADY_DECIDED');
  });

  it('reports STALE_VERSION for version mismatch in bulk', async () => {
    seedRequest({ requestId: 'ar-b-stale', version: 1 });
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [{ requestId: 'ar-b-stale', version: 99 }],
        decision: 'APPROVE',
      });
    expect(res.body.results[0].outcome).toBe('FAILED');
    expect(res.body.results[0].reason).toBe('STALE_VERSION');
  });

  it('reports NOT_FOUND for unknown requestId in bulk', async () => {
    const res = await request(app)
      .post('/requests/bulk-decision')
      .send({
        items: [{ requestId: 'ar-nonexistent', version: 1 }],
        decision: 'APPROVE',
      });
    expect(res.body.results[0].outcome).toBe('FAILED');
    expect(res.body.results[0].reason).toBe('NOT_FOUND');
  });
});
import { AccessRequest, ListResponse, Filters } from '../types';

const BASE = 'http://localhost:3001';

export async function fetchRequests(filters: Partial<Filters>): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  if (filters.riskFlag) params.set('riskFlag', filters.riskFlag);
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));

  const res = await fetch(`${BASE}/requests?${params}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function fetchRequest(id: string): Promise<AccessRequest> {
  const res = await fetch(`${BASE}/requests/${id}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export async function submitDecision(
  id: string,
  decision: 'APPROVE' | 'DENY',
  justification: string,
  version: number
): Promise<AccessRequest> {
  const res = await fetch(`${BASE}/requests/${id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, justification, version }),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Decision failed'), { status: res.status, error: data.error, data });
  return data;
}

export async function submitBulkDecision(
  items: { requestId: string; version: number }[],
  decision: 'APPROVE' | 'DENY',
  justification: string
) {
  const res = await fetch(`${BASE}/requests/bulk-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, decision, justification }),
  });
  if (!res.ok) throw new Error('Bulk decision failed');
  return res.json();
}
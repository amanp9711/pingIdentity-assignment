import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccessRequest, Filters, ListResponse } from '../types';
import { fetchRequests } from '../api/api';
import { StatusBadge, PriorityBadge, RiskBadge } from './StatusBadge';
import { DueDateCell } from './DueDateCell';
import { RequestFilters } from './RequestFilters';

interface Props {
  onSelect: (r: AccessRequest) => void;
}

const DEFAULT_FILTERS: Filters = {
  status: 'PENDING',
  type: '',
  riskFlag: '',
  search: '',
  sortBy: 'requestedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

type SortCol = 'requestedAt' | 'dueDate' | 'requester' | 'resource' | 'priority';

export function RequestList({ onSelect }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data, isLoading, isError, error } = useQuery<ListResponse>({
    queryKey: ['requests', filters],
    queryFn: () => fetchRequests(filters),
    staleTime: 10_000,
  });

  function updateFilters(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  function toggleSort(col: SortCol) {
    setFilters((f) => ({
      ...f,
      sortBy: col,
      sortDir: f.sortBy === col && f.sortDir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  }

  function SortHeader({ col, label }: { col: SortCol; label: string }) {
    const active = filters.sortBy === col;
    return (
      <th
        className={`sortable ${active ? 'sort-active' : ''}`}
        aria-sort={active ? (filters.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          className="sort-control"
          onClick={() => toggleSort(col)}
          aria-label={`Sort by ${label}; ${active ? `currently ${filters.sortDir}` : 'not currently sorted'}`}
        >
          {label} <span aria-hidden="true">{active ? (filters.sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    );
  }

  const totalPages = data ? Math.ceil(data.total / filters.pageSize) : 0;

  return (
    <div className="list-pane">
      <div className="list-header">
        <h1>Access Request Queue</h1>
        {data && (
          <span className="total-count">{data.total} request{data.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      <RequestFilters filters={filters} onChange={updateFilters} />

      {isLoading && (
        <div className="state-message" role="status" aria-live="polite">Loading requests…</div>
      )}

      {isError && (
        <div className="state-error" role="alert">
          <strong>Failed to load requests.</strong>{' '}
          {(error as Error)?.message || 'Check that the API server is running.'}
        </div>
      )}

      {!isLoading && !isError && data?.items.length === 0 && (
        <div className="state-empty" role="status">
          No requests match the current filters.
        </div>
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="request-table" aria-label="Access requests">
              <thead>
                <tr>
                  <th>ID</th>
                  <SortHeader col="requester" label="Requester" />
                  <SortHeader col="resource" label="Resource" />
                  <th>Type</th>
                  <th>Status</th>
                  <SortHeader col="priority" label="Priority" />
                  <th>Risk</th>
                  <SortHeader col="dueDate" label="Due Date" />
                  <SortHeader col="requestedAt" label="Requested" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr
                    key={r.requestId}
                    onClick={() => onSelect(r)}
                    className="request-row"
                  >
                    <td className="id-cell">
                      <button
                        type="button"
                        className="request-open"
                        aria-label={`Open request ${r.requestId} from ${r.requester.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(r);
                        }}
                      >
                        {r.requestId}
                      </button>
                    </td>
                    <td>
                      <div>{r.requester.name}</div>
                      <small className="muted">{r.requester.department}</small>
                    </td>
                    <td>
                      <div>{r.resource.name}</div>
                      <small className="muted">{r.resource.system}</small>
                    </td>
                    <td>{r.type}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td><PriorityBadge priority={r.priority} /></td>
                    <td>
                      {r.riskFlags.map((f) => <RiskBadge key={f} flag={f} />)}
                    </td>
                    <td><DueDateCell dueDate={r.dueDate} /></td>
                    <td>{new Date(r.requestedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination" role="navigation" aria-label="Pagination">
            <button
              className="btn-ghost"
              onClick={() => updateFilters({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span className="page-info">
              Page {filters.page} of {totalPages}
            </span>
            <button
              className="btn-ghost"
              onClick={() => updateFilters({ page: filters.page + 1 })}
              disabled={filters.page >= totalPages}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
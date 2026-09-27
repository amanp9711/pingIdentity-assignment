import { Filters } from '../types';

interface Props {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
}

export function RequestFilters({ filters, onChange }: Props) {
  return (
    <div className="filters">
      <input
        type="search"
        placeholder="Search requester, resource, or ID…"
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value, page: 1 })}
        className="filter-search"
        aria-label="Search requests"
      />

      <select
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value, page: 1 })}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="DENIED">Denied</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      <select
        value={filters.type}
        onChange={(e) => onChange({ type: e.target.value, page: 1 })}
        aria-label="Filter by type"
      >
        <option value="">All Types</option>
        <option value="GRANT">Grant</option>
        <option value="REVOKE">Revoke</option>
      </select>

      <input
        type="search"
        className="filter-risk"
        placeholder="e.g. SOD_CONFLICT"
        value={filters.riskFlag}
        onChange={(e) => onChange({ riskFlag: e.target.value, page: 1 })}
        aria-label="Filter by risk flag"
      />

      {(filters.status || filters.type || filters.riskFlag || filters.search) && (
        <button
          className="btn-ghost"
          onClick={() => onChange({ status: '', type: '', riskFlag: '', search: '', page: 1 })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
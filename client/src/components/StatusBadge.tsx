import { RequestStatus, Priority } from '../types';

export function StatusBadge({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, string> = {
    PENDING: 'badge badge-pending',
    APPROVED: 'badge badge-approved',
    DENIED: 'badge badge-denied',
    CANCELLED: 'badge badge-cancelled',
  };
  return <span className={map[status]}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const map: Record<Priority, string> = {
    LOW: 'badge badge-low',
    NORMAL: 'badge badge-normal',
    HIGH: 'badge badge-high',
  };
  return <span className={map[priority]}>{priority}</span>;
}

export function RiskBadge({ flag }: { flag: string }) {
  const label = {
    SOD_CONFLICT: 'SoD Conflict',
    SENSITIVE_DATA: 'Sensitive Data',
  }[flag] ?? flag;
  return <span className="badge badge-risk">{label}</span>;
}
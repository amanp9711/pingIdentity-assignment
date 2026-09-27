export type RequestType = 'GRANT' | 'REVOKE';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH';
export type RiskFlag = string;
export type DecisionOutcome = 'APPROVED' | 'DENIED';

export interface Requester {
  name: string;
  department: string;
  manager?: string;
}

export interface Resource {
  name: string;
  system: string;
  type: string;
}

export interface SodConflict {
  conflictsWith: string;
  policy: string;
}

export interface Decision {
  outcome: DecisionOutcome;
  decidedBy: string;
  decidedAt: string;
  justification: string;
}

export interface HistoryEvent {
  at: string;
  event: string;
  actor: string;
}

export interface AccessRequest {
  requestId: string;
  type: RequestType;
  status: RequestStatus;
  priority: Priority;
  requester: Requester;
  resource: Resource;
  requesterJustification: string;
  riskFlags: RiskFlag[];
  sodConflict?: SodConflict;
  requestedAt: string;
  dueDate: string;
  version: number;
  decision: Decision | null;
  history: HistoryEvent[];
}

export interface ListResponse {
  items: AccessRequest[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DecisionBody {
  decision: 'APPROVE' | 'DENY';
  justification?: string;
  version: number;
}

export interface BulkDecisionItem {
  requestId: string;
  version: number;
}

export interface BulkDecisionBody {
  items: BulkDecisionItem[];
  decision: 'APPROVE' | 'DENY';
  justification?: string;
}

export interface BulkResult {
  requestId: string;
  outcome: 'SUCCESS' | 'FAILED';
  reason?: string;
}
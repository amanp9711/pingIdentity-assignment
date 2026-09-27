import { useState } from 'react';
import { AccessRequest } from '../types';
import { StatusBadge, PriorityBadge, RiskBadge } from './StatusBadge';
import { DueDateCell } from './DueDateCell';
import { DecisionDialog } from './DecisionDialog';

interface Props {
  request: AccessRequest;
  onBack: () => void;
  onUpdated: (r: AccessRequest) => void;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export function RequestDetail({ request, onBack, onUpdated }: Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [current, setCurrent] = useState(request);
  const [conflictMessage, setConflictMessage] = useState('');

  function handleDecided(updated: AccessRequest) {
    setCurrent(updated);
    setConflictMessage('');
    onUpdated(updated);
    setShowDialog(false);
  }

  function handleRefreshed(updated: AccessRequest) {
    setCurrent(updated);
    onUpdated(updated);
    if (updated.status !== 'PENDING') {
      setConflictMessage(`This request changed while you were reviewing it. Your decision was not applied; the current status is ${updated.status}.`);
    }
  }

  return (
    <div className="detail-pane">
      <div className="detail-header">
        <button className="btn-ghost" onClick={onBack} aria-label="Back to list">← Back</button>
        <h1>{current.requestId}</h1>
        <div className="detail-badges">
          <StatusBadge status={current.status} />
          <PriorityBadge priority={current.priority} />
          <span className="type-chip">{current.type}</span>
          {current.riskFlags.map((f) => <RiskBadge key={f} flag={f} />)}
        </div>
      </div>

      {conflictMessage && <div className="state-error" role="alert">{conflictMessage}</div>}

      <div className="detail-grid">
        <section className="detail-card">
          <h2>Requester</h2>
          <dl>
            <dt>Name</dt><dd>{current.requester.name}</dd>
            <dt>Department</dt><dd>{current.requester.department}</dd>
            {current.requester.manager && <><dt>Manager</dt><dd>{current.requester.manager}</dd></>}
          </dl>
        </section>

        <section className="detail-card">
          <h2>Resource</h2>
          <dl>
            <dt>Name</dt><dd>{current.resource.name}</dd>
            <dt>System</dt><dd>{current.resource.system}</dd>
            <dt>Type</dt><dd>{current.resource.type}</dd>
          </dl>
        </section>

        <section className="detail-card">
          <h2>Dates</h2>
          <dl>
            <dt>Requested</dt><dd>{fmt(current.requestedAt)}</dd>
            <dt>Due</dt><dd><DueDateCell dueDate={current.dueDate} /></dd>
          </dl>
        </section>
      </div>

      <section className="detail-card detail-justification">
        <h2>Requester Justification</h2>
        <p>{current.requesterJustification}</p>
      </section>

      {current.sodConflict && (
        <section className="detail-card sod-detail" role="alert">
          <h2>⚠ SoD Conflict</h2>
          <p><strong>Conflicts with:</strong> {current.sodConflict.conflictsWith}</p>
          <p><strong>Policy:</strong> {current.sodConflict.policy}</p>
        </section>
      )}

      {current.decision && (
        <section className="detail-card decision-record">
          <h2>Decision Record</h2>
          <dl>
            <dt>Outcome</dt><dd><StatusBadge status={current.status} /></dd>
            <dt>Decided by</dt><dd>{current.decision.decidedBy}</dd>
            <dt>Decided at</dt><dd>{fmt(current.decision.decidedAt)}</dd>
            {current.decision.justification && (
              <><dt>Justification</dt><dd>{current.decision.justification}</dd></>
            )}
          </dl>
        </section>
      )}

      <section className="detail-card">
        <h2>Audit Trail</h2>
        <ol className="history-list">
          {current.history.map((h, i) => (
            <li key={i}>
              <span className="history-event">{h.event}</span>
              <span className="history-actor">{h.actor}</span>
              <span className="history-time">{fmt(h.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      {current.status === 'PENDING' && (
        <div className="detail-actions">
          <button className="btn-primary" onClick={() => setShowDialog(true)}>
            Make Decision
          </button>
        </div>
      )}

      {showDialog && (
        <DecisionDialog
          request={current}
          onClose={() => setShowDialog(false)}
          onDecided={handleDecided}
          onRefreshed={handleRefreshed}
        />
      )}
    </div>
  );
}
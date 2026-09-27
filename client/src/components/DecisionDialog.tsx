import { useEffect, useRef, useState } from 'react';
import { AccessRequest } from '../types';
import { fetchRequest, submitDecision } from '../api/api';
import { RiskBadge } from './StatusBadge';

interface Props {
  request: AccessRequest;
  onClose: () => void;
  onDecided: (updated: AccessRequest) => void;
  onRefreshed: (updated: AccessRequest) => void;
}

export function DecisionDialog({ request, onClose, onDecided, onRefreshed }: Props) {
  const [outcome, setOutcome] = useState<'APPROVE' | 'DENY'>('APPROVE');
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const needsJustification =
    outcome === 'DENY' || (outcome === 'APPROVE' && request.riskFlags.length > 0);

  // Focus trap + ESC close
  useEffect(() => {
    firstFocusRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function validate(): string {
    if (outcome === 'DENY' && !justification.trim()) return 'Justification is required when denying.';
    if (outcome === 'APPROVE' && request.riskFlags.length > 0 && !justification.trim())
      return 'Justification is required when approving a risk-flagged request.';
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSubmitting(true);
    setError('');
    try {
      const updated = await submitDecision(request.requestId, outcome, justification.trim(), request.version);
      onDecided(updated);
    } catch (err: any) {
      if (err.error === 'STALE_VERSION' || err.error === 'ALREADY_DECIDED') {
        try {
          const refreshed = await fetchRequest(request.requestId);
          onRefreshed(refreshed);
          if (refreshed.status === 'PENDING') {
            setError('Request refreshed. Review the latest details and resubmit; your justification is retained.');
          } else {
            onClose();
          }
        } catch {
          setError('The request changed, but its latest details could not be loaded. Your justification is retained; try again.');
        }
      } else if (err.error === 'JUSTIFICATION_REQUIRED') {
        setError('Justification is required for this decision.');
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog" ref={dialogRef}>
        <div className="dialog-header">
          <h2 id="dialog-title">Decision — {request.requestId}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>

        <div className="dialog-meta">
          <span><strong>{request.requester.name}</strong> · {request.requester.department}</span>
          <span>→ <strong>{request.resource.name}</strong> ({request.resource.system})</span>
          {request.riskFlags.map((f) => <RiskBadge key={f} flag={f} />)}
        </div>

        {request.sodConflict && (
          <div className="sod-warning" role="alert">
            <strong>SoD Conflict:</strong> Conflicts with <em>{request.sodConflict.conflictsWith}</em><br />
            <small>{request.sodConflict.policy}</small>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset className="decision-toggle">
            <legend className="sr-only">Choose decision</legend>
            <button
              type="button"
              ref={firstFocusRef}
              className={`btn-decision ${outcome === 'APPROVE' ? 'active approve' : ''}`}
              onClick={() => { setOutcome('APPROVE'); setError(''); }}
              aria-pressed={outcome === 'APPROVE'}
            >
              Approve
            </button>
            <button
              type="button"
              className={`btn-decision ${outcome === 'DENY' ? 'active deny' : ''}`}
              onClick={() => { setOutcome('DENY'); setError(''); }}
              aria-pressed={outcome === 'DENY'}
            >
              Deny
            </button>
          </fieldset>

          <label htmlFor="justification" className="field-label">
            Justification {needsJustification ? <span className="required">*</span> : <span className="optional">(optional)</span>}
          </label>
          <textarea
            id="justification"
            className="justification-input"
            rows={4}
            value={justification}
            onChange={(e) => { setJustification(e.target.value); setError(''); }}
            placeholder={
              outcome === 'DENY'
                ? 'Explain the reason for denial…'
                : request.riskFlags.length > 0
                  ? 'Describe the compensating control or exception rationale…'
                  : 'Optional justification…'
            }
            aria-required={needsJustification}
            aria-describedby={error ? 'dialog-error' : undefined}
          />

          {error && (
            <div id="dialog-error" className="form-error" role="alert">{error}</div>
          )}

          <div className="dialog-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary ${outcome === 'DENY' ? 'btn-deny' : ''}`}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : outcome === 'APPROVE' ? 'Approve' : 'Deny'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
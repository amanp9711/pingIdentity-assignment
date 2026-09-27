import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DecisionDialog } from './DecisionDialog';
import { AccessRequest } from '../types';

vi.mock('../api/api', () => ({
  submitDecision: vi.fn(),
  fetchRequest: vi.fn(),
}));

import { fetchRequest, submitDecision } from '../api/api';

const baseRequest: AccessRequest = {
  requestId: 'ar-test-01',
  type: 'GRANT',
  status: 'PENDING',
  priority: 'NORMAL',
  requester: { name: 'Test User', department: 'Engineering', manager: 'Mgr' },
  resource: { name: 'Test Resource', system: 'TestSys', type: 'ENTITLEMENT' },
  requesterJustification: 'Need access for testing',
  riskFlags: [],
  requestedAt: '2026-09-20T10:00:00Z',
  dueDate: '2026-09-30',
  version: 1,
  decision: null,
  history: [],
};

const riskRequest: AccessRequest = {
  ...baseRequest,
  requestId: 'ar-test-02',
  riskFlags: ['SOD_CONFLICT'],
  sodConflict: { conflictsWith: 'Payment Approval', policy: 'SoD-PAY-01' },
};

function renderDialog(req = baseRequest, onRefreshed = vi.fn()) {
  const onClose = vi.fn();
  const onDecided = vi.fn();
  render(<DecisionDialog request={req} onClose={onClose} onDecided={onDecided} onRefreshed={onRefreshed} />);
  return { onClose, onDecided, onRefreshed };
}

function selectOutcome(outcome: 'Approve' | 'Deny') {
  const fieldset = screen.getByText('Choose decision').closest('fieldset')!;
  fireEvent.click(within(fieldset).getByRole('button', { name: outcome }));
}

function submitForm() {
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
}

describe('DecisionDialog — validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks DENY without justification', async () => {
    renderDialog();
    selectOutcome('Deny');
    submitForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Justification is required when denying');
    expect(submitDecision).not.toHaveBeenCalled();
  });

  it('blocks APPROVE on risk-flagged request without justification', async () => {
    renderDialog(riskRequest);
    submitForm();
    expect(await screen.findByText(/Justification is required when approving a risk-flagged/)).toBeInTheDocument();
    expect(submitDecision).not.toHaveBeenCalled();
  });

  it('allows APPROVE on non-risk request without justification', async () => {
    (submitDecision as any).mockResolvedValue({ ...baseRequest, status: 'APPROVED', version: 2 });
    renderDialog();
    submitForm();
    await waitFor(() => expect(submitDecision).toHaveBeenCalledWith('ar-test-01', 'APPROVE', '', 1));
  });

  it('allows DENY with a justification', async () => {
    (submitDecision as any).mockResolvedValue({ ...baseRequest, status: 'DENIED', version: 2 });
    const user = userEvent.setup();
    renderDialog();
    selectOutcome('Deny');
    await user.type(screen.getByRole('textbox'), 'Policy violation');
    submitForm();
    await waitFor(() => expect(submitDecision).toHaveBeenCalledWith('ar-test-01', 'DENY', 'Policy violation', 1));
  });

  it('shows STALE_VERSION error from API', async () => {
    const err = Object.assign(new Error('Stale'), { error: 'STALE_VERSION' });
    (submitDecision as any).mockRejectedValue(err);
    (fetchRequest as any).mockResolvedValue(baseRequest);
    renderDialog();
    submitForm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Request refreshed');
    expect(fetchRequest).toHaveBeenCalledWith(baseRequest.requestId);
  });

  it('shows ALREADY_DECIDED error from API', async () => {
    const err = Object.assign(new Error('Decided'), { error: 'ALREADY_DECIDED' });
    (submitDecision as any).mockRejectedValue(err);
    const updated = { ...baseRequest, status: 'APPROVED' as const, version: 2 };
    (fetchRequest as any).mockResolvedValue(updated);
    const { onClose, onRefreshed } = renderDialog();
    submitForm();
    await waitFor(() => expect(onRefreshed).toHaveBeenCalledWith(updated));
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves the draft and uses the refreshed version after a stale conflict', async () => {
    const updated = { ...baseRequest, version: 2 };
    const draft = 'Reviewed updated policy details';
    (submitDecision as any)
      .mockRejectedValueOnce(Object.assign(new Error('Stale'), { error: 'STALE_VERSION' }))
      .mockResolvedValueOnce({ ...updated, status: 'APPROVED', version: 3 });
    (fetchRequest as any).mockResolvedValue(updated);

    const onClose = vi.fn();
    const onDecided = vi.fn();
    const onRefreshed = vi.fn();
    const view = render(
      <DecisionDialog request={baseRequest} onClose={onClose} onDecided={onDecided} onRefreshed={onRefreshed} />
    );
    const textbox = screen.getByRole('textbox');
    fireEvent.change(textbox, { target: { value: draft } });
    submitForm();

    expect(await screen.findByRole('alert')).toHaveTextContent('justification is retained');
    expect(onRefreshed).toHaveBeenCalledWith(updated);
    expect(onClose).not.toHaveBeenCalled();

    view.rerender(
      <DecisionDialog request={updated} onClose={onClose} onDecided={onDecided} onRefreshed={onRefreshed} />
    );
    expect(screen.getByRole('textbox')).toHaveValue(draft);
    submitForm();

    await waitFor(() => {
      expect(submitDecision).toHaveBeenNthCalledWith(2, baseRequest.requestId, 'APPROVE', draft, 2);
    });
  });

  it('calls onDecided with updated request on success', async () => {
    const updated = { ...baseRequest, status: 'APPROVED' as const, version: 2 };
    (submitDecision as any).mockResolvedValue(updated);
    const { onDecided } = renderDialog();
    submitForm();
    await waitFor(() => expect(onDecided).toHaveBeenCalledWith(updated));
  });

  it('shows SoD conflict details for risk-flagged request', () => {
    renderDialog(riskRequest);
    expect(screen.getByText('SoD Conflict:', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/Payment Approval/)).toBeInTheDocument();
  });

  it('closes on ESC key', () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
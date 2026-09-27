import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { RequestDetail } from './RequestDetail';
import { AccessRequest } from '../types';

vi.mock('../api/api', () => ({
  fetchRequest: vi.fn(),
  submitDecision: vi.fn(),
}));

import { fetchRequest, submitDecision } from '../api/api';

const pendingRequest: AccessRequest = {
  requestId: 'ar-conflict-01',
  type: 'GRANT',
  status: 'PENDING',
  priority: 'NORMAL',
  requester: { name: 'Taylor Reed', department: 'Engineering' },
  resource: { name: 'Build Console', system: 'CI', type: 'APPLICATION' },
  requesterJustification: 'Needed for release support.',
  riskFlags: [],
  requestedAt: '2026-09-20T10:00:00Z',
  dueDate: '2026-09-30',
  version: 1,
  decision: null,
  history: [{ at: '2026-09-20T10:00:00Z', event: 'REQUESTED', actor: 'Taylor Reed' }],
};

describe('RequestDetail conflict recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the refreshed status and explains that its decision was not applied', async () => {
    const updated: AccessRequest = {
      ...pendingRequest,
      status: 'APPROVED',
      version: 2,
      decision: {
        outcome: 'APPROVED',
        decidedBy: 'Another Admin',
        decidedAt: '2026-09-21T10:00:00Z',
        justification: '',
      },
    };
    (submitDecision as any).mockRejectedValue(Object.assign(new Error('Already decided'), { error: 'ALREADY_DECIDED' }));
    (fetchRequest as any).mockResolvedValue(updated);

    const user = userEvent.setup();
    render(<RequestDetail request={pendingRequest} onBack={vi.fn()} onUpdated={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Make Decision' }));
    fireEvent.submit(screen.getByRole('textbox').closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Your decision was not applied');
    expect(screen.getAllByText('APPROVED').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Make Decision' })).not.toBeInTheDocument();
  });
});
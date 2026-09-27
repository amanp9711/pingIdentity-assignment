import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequestFilters } from './RequestFilters';
import { RiskBadge } from './StatusBadge';
import { Filters } from '../types';

const filters: Filters = {
  status: 'PENDING',
  type: '',
  riskFlag: '',
  search: '',
  sortBy: 'requestedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: 25,
};

describe('risk flag handling', () => {
  it('passes arbitrary risk flag values to the API filter state', () => {
    const onChange = vi.fn();
    render(<RequestFilters filters={filters} onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter by risk flag' }), {
      target: { value: 'CUSTOM_APPROVAL' },
    });

    expect(onChange).toHaveBeenCalledWith({ riskFlag: 'CUSTOM_APPROVAL', page: 1 });
  });

  it('displays an unknown flag instead of assigning it a known label', () => {
    render(<RiskBadge flag="CUSTOM_APPROVAL" />);

    expect(screen.getByText('CUSTOM_APPROVAL')).toBeInTheDocument();
    expect(screen.queryByText('Sensitive Data')).not.toBeInTheDocument();
  });
});
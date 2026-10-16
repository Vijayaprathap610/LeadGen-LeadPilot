import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', () => ({
  api: { getLeads: vi.fn(), updateStatus: vi.fn(), exportCsv: vi.fn(), getStats: vi.fn(), importCsv: vi.fn() },
  isCancel: () => false,
}));
vi.mock('../utils/csv', async (orig) => ({ ...(await orig()), downloadBlob: vi.fn() }));

import { api } from '../services/api';
import { downloadBlob } from '../utils/csv';
import LeadsPage from '../pages/LeadsPage';
import { THRESHOLDS, makeLead, page, renderWithToasts } from './fixtures';

const props = () => ({ thresholds: THRESHOLDS, preset: null, onPresetUsed: vi.fn(), onDataChanged: vi.fn(), onGoImport: vi.fn() });
const two = [
  makeLead(),
  makeLead({ _id: '507f1f77bcf86cd799439012', companyName: 'Orchid Software', score: 11, priority: 'low', provisional: true,
    dataQualityWarnings: [{ code: 'MISSING_SIZE', message: 'No company size provided.' }, { code: 'MISSING_REVENUE', message: 'No revenue provided.' }] }),
];

beforeEach(() => { vi.clearAllMocks(); });

describe('LeadsPage', () => {
  it('shows a loading state, then the ranked leads with scores, priorities and quality flags', async () => {
    api.getLeads.mockResolvedValue(page(two));
    await renderWithToasts(<LeadsPage {...props()} />);
    expect(screen.getByText('Loading leads…')).toBeInTheDocument();
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1]).getByText('Complete')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Provisional')).toBeInTheDocument();
    expect(within(rows[2]).getByRole('button', { name: /2 issues to review for Orchid Software/ })).toBeInTheDocument();
    expect(api.getLeads.mock.calls[0][0]).toMatchObject({ page: 1, limit: 25, sort: 'score_desc' });
  });

  it('shows an invitation to import when there are no leads at all', async () => {
    api.getLeads.mockResolvedValue(page([], { total: 0 }));
    const p = props();
    await renderWithToasts(<LeadsPage {...p} />);
    expect(await screen.findByRole('heading', { name: 'No leads yet' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Import a CSV' }));
    expect(p.onGoImport).toHaveBeenCalled();
  });

  it('shows a filter-specific empty state that can be cleared', async () => {
    api.getLeads.mockResolvedValueOnce(page(two)).mockResolvedValue(page([], { total: 0 }));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'low');
    expect(await screen.findByRole('heading', { name: 'No leads match these filters' })).toBeInTheDocument();
    api.getLeads.mockResolvedValue(page(two));
    await userEvent.click(screen.getAllByRole('button', { name: /Clear filters/ })[0]);
    expect(await screen.findAllByRole('row')).toHaveLength(3);
  });

  it('shows an error with a working retry', async () => {
    api.getLeads.mockRejectedValueOnce(new Error("Can't reach the LeadPilot server."));
    await renderWithToasts(<LeadsPage {...props()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the LeadPilot server.");
    api.getLeads.mockResolvedValue(page(two));
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findAllByRole('row')).toHaveLength(3);
  });

  it('debounces search and resets to page one', async () => {
    api.getLeads.mockResolvedValue(page(two));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    await userEvent.type(screen.getByLabelText('Search'), 'apex');
    await waitFor(() => expect(api.getLeads.mock.calls.at(-1)[0]).toMatchObject({ search: 'apex', page: 1 }));
    const searchCalls = api.getLeads.mock.calls.filter(([p]) => p.search);
    expect(searchCalls).toHaveLength(1); // four keystrokes, one request
  });

  it('updates a status, confirms it, and tells the dashboard to refresh', async () => {
    api.getLeads.mockResolvedValue(page(two));
    api.updateStatus.mockResolvedValue({ ...two[0], status: 'contacted' });
    const p = props();
    await renderWithToasts(<LeadsPage {...p} />);
    await screen.findAllByRole('row');
    await userEvent.selectOptions(screen.getByLabelText('Status for Northwind Analytics'), 'contacted');
    expect(api.updateStatus).toHaveBeenCalledWith(two[0]._id, 'contacted');
    expect(await screen.findByText('Northwind Analytics marked contacted.')).toBeInTheDocument();
    expect(p.onDataChanged).toHaveBeenCalled();
    expect(screen.getByLabelText('Status for Northwind Analytics')).toHaveValue('contacted');
  });

  it('reverts the status and explains when the update fails', async () => {
    api.getLeads.mockResolvedValue(page(two));
    api.updateStatus.mockRejectedValue(new Error('The database is temporarily unavailable.'));
    const p = props();
    await renderWithToasts(<LeadsPage {...p} />);
    await screen.findAllByRole('row');
    await userEvent.selectOptions(screen.getByLabelText('Status for Northwind Analytics'), 'qualified');
    expect(await screen.findByText(/Could not update Northwind Analytics: The database is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByLabelText('Status for Northwind Analytics')).toHaveValue('new');
    expect(p.onDataChanged).not.toHaveBeenCalled();
  });

  it('opens a lead to explain its score and warnings', async () => {
    api.getLeads.mockResolvedValue(page(two));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: 'Orchid Software' }));
    expect(await screen.findByText('How this score was calculated')).toBeInTheDocument();
    expect(screen.getByText('No company size provided.')).toBeInTheDocument();
    expect(screen.getByText(/not a machine-learning model/)).toBeInTheDocument();
  });

  it('exports with the active filters and confirms', async () => {
    api.getLeads.mockResolvedValue(page(two));
    api.exportCsv.mockResolvedValue(new Blob(['x']));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    await userEvent.selectOptions(screen.getByLabelText('Priority'), 'high');
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(api.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ priority: 'high', sort: 'score_desc' }));
    expect(api.exportCsv.mock.calls[0][0]).not.toHaveProperty('page');
    expect(await screen.findByText(/Export downloaded/)).toBeInTheDocument();
  });

  it('reports a failed export without downloading anything', async () => {
    api.getLeads.mockResolvedValue(page(two));
    api.exportCsv.mockRejectedValue(new Error('Invalid priority.'));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    await userEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(await screen.findByText('Export failed: Invalid priority.')).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('applies a preset coming from the dashboard', async () => {
    api.getLeads.mockResolvedValue(page(two));
    const p = { ...props(), preset: { priority: 'high' } };
    await renderWithToasts(<LeadsPage {...p} />);
    await screen.findAllByRole('row');
    expect(api.getLeads.mock.calls[0][0]).toMatchObject({ priority: 'high' });
    expect(screen.getByLabelText('Priority')).toHaveValue('high');
    expect(p.onPresetUsed).toHaveBeenCalled();
  });

  it('paginates', async () => {
    api.getLeads.mockResolvedValue(page(two, { total: 60, totalPages: 3 }));
    await renderWithToasts(<LeadsPage {...props()} />);
    await screen.findAllByRole('row');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));
    await waitFor(() => expect(api.getLeads.mock.calls.at(-1)[0]).toMatchObject({ page: 2 }));
  });
});

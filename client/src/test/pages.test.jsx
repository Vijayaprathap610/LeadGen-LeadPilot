import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { getLeads: vi.fn(), updateStatus: vi.fn(), exportCsv: vi.fn(), getStats: vi.fn(), importCsv: vi.fn() },
  isCancel: () => false,
}));

import { api } from '../services/api';
import { ApiRequestError } from '../services/api';
import DashboardPage from '../pages/DashboardPage';
import ImportPage from '../pages/ImportPage';
import App from '../App';
import { makeLead, makeStats, page, renderWithToasts } from './fixtures';

beforeEach(() => { vi.clearAllMocks(); window.location.hash = ''; });

const importResult = (o = {}) => ({
  batchId: 'b', fileName: 'sample-leads.csv', totalRows: 15, imported: 12,
  duplicates: { total: 2, inFile: 2, existing: 0 }, invalid: 1, incomplete: 6,
  importedByPriority: { high: 9, medium: 2, low: 1 }, ignoredColumns: ['Notes'],
  issues: [
    { row: 6, companyName: 'Northwind Analytics', type: 'duplicate', reason: 'Duplicate of row 1 in this file (same website domain).' },
    { row: 9, companyName: '', type: 'invalid', reason: 'Company name is missing.' },
  ],
  issuesTruncated: false, ...o,
});

const csvFile = (name = 'leads.csv') => new File(['Company Name\nAcme\n'], name, { type: 'text/csv' });

describe('DashboardPage', () => {
  const base = { loading: false, error: null, onRetry: vi.fn(), onOpenLeads: vi.fn(), onGoImport: vi.fn() };

  it('invites the user to import when nothing exists yet', async () => {
    await renderWithToasts(<DashboardPage {...base} stats={makeStats({ uniqueLeads: 0, imports: { count: 0, rowsProcessed: 0, duplicatesDetected: 0, invalidRejected: 0 }, lastImport: null })} />);
    expect(screen.getByRole('heading', { name: 'No leads yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download a sample file' })).toHaveAttribute('href', '/sample-leads.csv');
  });

  it('shows the real numbers and honest scoring notes', async () => {
    await renderWithToasts(<DashboardPage {...base} stats={makeStats()} />);
    const strip = screen.getByText('Unique leads').closest('div');
    expect(strip).toHaveTextContent('12');
    expect(screen.getByText('Duplicates caught').closest('div')).toHaveTextContent('16');
    expect(screen.getByText(/No target industries are set, so industry is not scored/)).toBeInTheDocument();
    expect(screen.getByText(/not produced by a machine-learning model/)).toBeInTheDocument();
    expect(screen.getByText('sample-leads.csv')).toBeInTheDocument();
  });

  it('turns the high-priority number into a shortcut', async () => {
    const onOpenLeads = vi.fn();
    await renderWithToasts(<DashboardPage {...base} onOpenLeads={onOpenLeads} stats={makeStats()} />);
    await userEvent.click(screen.getByRole('button', { name: 'score 70 or more' }));
    expect(onOpenLeads).toHaveBeenCalledWith({ priority: 'high' });
  });

  it('shows an error with retry when stats cannot load', async () => {
    const onRetry = vi.fn();
    await renderWithToasts(<DashboardPage {...base} stats={null} error="The database is not connected." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The database is not connected.');
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('shows a loading state', async () => {
    await renderWithToasts(<DashboardPage {...base} stats={null} loading />);
    expect(screen.getByText('Loading dashboard…')).toBeInTheDocument();
  });
});

describe('ImportPage', () => {
  const choose = (file) => fireEvent.change(document.getElementById('csv-input'), { target: { files: [file] } });

  it('imports a file and explains every skipped row', async () => {
    api.importCsv.mockResolvedValue(importResult());
    const onImported = vi.fn();
    await renderWithToasts(<ImportPage onImported={onImported} onViewLeads={vi.fn()} />);
    choose(csvFile('sample-leads.csv'));
    await userEvent.click(await screen.findByRole('button', { name: 'Import leads' }));
    expect(await screen.findByRole('heading', { name: 'Imported 12 leads' })).toBeInTheDocument();
    expect(api.importCsv).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalled();
    expect(screen.getByText('Company name is missing.')).toBeInTheDocument();
    expect(screen.getByText(/Duplicate of row 1/)).toBeInTheDocument();
    expect(screen.getByText('No name')).toBeInTheDocument();
    expect(screen.getByText(/Ignored columns: Notes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download report' })).toBeInTheDocument();
  });

  it('says so when nothing new was imported', async () => {
    api.importCsv.mockResolvedValue(importResult({ imported: 0, issues: [] }));
    await renderWithToasts(<ImportPage onImported={vi.fn()} onViewLeads={vi.fn()} />);
    choose(csvFile());
    await userEvent.click(await screen.findByRole('button', { name: 'Import leads' }));
    expect(await screen.findByRole('heading', { name: 'No new leads were imported' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View leads' })).not.toBeInTheDocument();
  });

  it('turns a missing-column error into instructions', async () => {
    api.importCsv.mockRejectedValue(new ApiRequestError('Missing required column: company name.', {
      status: 422, details: { missingColumns: ['companyName'], acceptedHeaders: ['Company Name', 'Company'], foundHeaders: ['Website', 'Industry'] },
    }));
    await renderWithToasts(<ImportPage onImported={vi.fn()} onViewLeads={vi.fn()} />);
    choose(csvFile());
    await userEvent.click(await screen.findByRole('button', { name: 'Import leads' }));
    const alert = await screen.findByText('The file was not imported');
    expect(alert.closest('[role=alert]')).toHaveTextContent('Missing required column: company name.');
    expect(alert.closest('[role=alert]')).toHaveTextContent('Add a column headed "Company Name", "Company". Columns found: Website, Industry.');
  });

  it('rejects non-CSV files in the browser without calling the server', async () => {
    await renderWithToasts(<ImportPage onImported={vi.fn()} onViewLeads={vi.fn()} />);
    choose(new File(['x'], 'leads.xlsx'));
    expect(await screen.findByRole('alert')).toHaveTextContent('"leads.xlsx" is not a CSV file');
    expect(screen.queryByRole('button', { name: 'Import leads' })).not.toBeInTheDocument();
    expect(api.importCsv).not.toHaveBeenCalled();
  });

  it('disables the button while importing so a file cannot be sent twice', async () => {
    let resolve;
    api.importCsv.mockReturnValue(new Promise((r) => { resolve = r; }));
    await renderWithToasts(<ImportPage onImported={vi.fn()} onViewLeads={vi.fn()} />);
    choose(csvFile());
    await userEvent.click(await screen.findByRole('button', { name: 'Import leads' }));
    expect(screen.getByRole('button', { name: 'Importing…' })).toBeDisabled();
    resolve(importResult());
    await screen.findByRole('heading', { name: 'Imported 12 leads' });
    expect(api.importCsv).toHaveBeenCalledTimes(1);
  });

  it('shows a network failure message', async () => {
    api.importCsv.mockRejectedValue(new ApiRequestError("Can't reach the LeadPilot server. Check that the API is running and try again."));
    await renderWithToasts(<ImportPage onImported={vi.fn()} onViewLeads={vi.fn()} />);
    choose(csvFile());
    await userEvent.click(await screen.findByRole('button', { name: 'Import leads' }));
    expect(await screen.findByText(/Can't reach the LeadPilot server/)).toBeInTheDocument();
  });
});

describe('App navigation', () => {
  it('starts on the dashboard and moves between pages with the hash router', async () => {
    api.getStats.mockResolvedValue(makeStats());
    api.getLeads.mockResolvedValue(page([makeLead()]));
    const { render } = await import('@testing-library/react');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('link', { name: 'Leads' })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Northwind Analytics' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('link', { name: 'Import' })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Import leads' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/import');
  });

  it('opens the leads table pre-filtered from a dashboard shortcut', async () => {
    api.getStats.mockResolvedValue(makeStats());
    api.getLeads.mockResolvedValue(page([makeLead()]));
    const { render } = await import('@testing-library/react');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'missing or unclear data' }));
    await screen.findByRole('heading', { level: 1, name: 'Leads' });
    await waitFor(() => expect(api.getLeads.mock.calls.at(-1)[0]).toMatchObject({ dataQuality: 'incomplete' }));
    expect(screen.getByLabelText('Data quality')).toHaveValue('incomplete');
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreMeter from '../components/ScoreMeter';
import PriorityBadge from '../components/PriorityBadge';
import { issuesToCsv } from '../utils/csv';
import { toApiError, ApiRequestError } from '../services/api';
import { AxiosError } from 'axios';
import { THRESHOLDS } from './fixtures';

describe('ScoreMeter', () => {
  it('describes the score and priority to assistive tech and marks both thresholds', () => {
    const { container } = render(<ScoreMeter score={67} priority="medium" thresholds={THRESHOLDS} />);
    expect(screen.getByRole('img', { name: 'Score 67 out of 100, medium priority' })).toBeInTheDocument();
    const ticks = [...container.querySelectorAll('.meter-tick')].map((t) => t.style.left);
    expect(ticks).toEqual(['40%', '70%']);
    expect(container.querySelector('.meter-fill').style.width).toBe('67%');
  });

  it('says when a score is provisional', () => {
    render(<ScoreMeter score={11} priority="low" thresholds={THRESHOLDS} provisional />);
    expect(screen.getByRole('img', { name: /provisional/ })).toBeInTheDocument();
  });

  it('follows custom thresholds', () => {
    const { container } = render(<ScoreMeter score={50} priority="low" thresholds={{ mediumThreshold: 60, highThreshold: 90 }} />);
    expect([...container.querySelectorAll('.meter-tick')].map((t) => t.style.left)).toEqual(['60%', '90%']);
  });
});

describe('PriorityBadge', () => {
  it('shows the priority and the provisional flag', () => {
    render(<PriorityBadge priority="high" provisional />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Provisional')).toBeInTheDocument();
  });
});

describe('issuesToCsv', () => {
  it('quotes values, labels results, and neutralises spreadsheet formulas', () => {
    const csv = issuesToCsv([
      { row: 6, companyName: 'Acme, "Inc"', type: 'duplicate', reason: 'Duplicate of row 1' },
      { row: 9, companyName: '=HYPERLINK("x")', type: 'invalid', reason: 'Company name is missing.' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('"Row","Company","Result","Reason"');
    expect(lines[1]).toBe('"6","Acme, ""Inc""","Duplicate","Duplicate of row 1"');
    expect(lines[2]).toContain('"\'=HYPERLINK(""x"")"');
    expect(lines[2]).toContain('"Rejected"');
  });
});

describe('toApiError', () => {
  it('explains an unreachable server', async () => {
    const err = await toApiError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.message).toMatch(/Can't reach the LeadPilot server/);
  });

  it('explains a timeout', async () => {
    expect((await toApiError(new AxiosError('timeout', 'ECONNABORTED'))).message).toMatch(/took too long/);
  });

  it('uses the server message and details when present', async () => {
    const response = { status: 422, data: { error: { message: 'Missing required column: company name.', details: { missingColumns: ['companyName'] } } } };
    const err = await toApiError(new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, response));
    expect(err.message).toBe('Missing required column: company name.');
    expect(err.status).toBe(422);
    expect(err.details.missingColumns).toEqual(['companyName']);
  });

  it('reads the error message out of a failed blob download', async () => {
    const blob = new Blob([JSON.stringify({ error: { message: 'Invalid priority.' } })]);
    const err = await toApiError(new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400, data: blob }));
    expect(err.message).toBe('Invalid priority.');
  });

  it('falls back to a generic message when the body is unreadable', async () => {
    const err = await toApiError(new AxiosError('bad', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 502, data: '<html>' }));
    expect(err.message).toBe('The server returned an error (502).');
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareImport } from '../services/importService';

const here = path.dirname(fileURLToPath(import.meta.url));
const OPTS = { maxRows: 100, scoring: { highThreshold: 70, mediumThreshold: 40, targetIndustries: [] } };
const run = (csv, opts = OPTS) => prepareImport(Buffer.from(csv), opts);
const failure = (csv, opts = OPTS) => {
  try { run(csv, opts); } catch (e) { return e; }
  return null;
};

describe('prepareImport: sample dataset', () => {
  const sample = fs.readFileSync(path.join(here, '../../client/public/sample-leads.csv'));
  const result = prepareImport(sample, OPTS);

  it('reports the expected totals', () => {
    expect(result.totalRows).toBe(15);
    expect(result.candidates).toHaveLength(12);
    expect(result.invalid).toBe(1);
    expect(result.duplicatesInFile).toBe(2);
    expect(result.candidates.length + result.invalid + result.duplicatesInFile).toBe(result.totalRows);
  });

  it('explains every rejected row instead of dropping it silently', () => {
    expect(result.issues.map((i) => [i.row, i.type])).toEqual([[6, 'duplicate'], [7, 'duplicate'], [9, 'invalid']]);
    expect(result.issues.every((i) => i.reason.length > 10)).toBe(true);
  });

  it('keeps same-name companies with different domains as separate leads', () => {
    const apex = result.candidates.filter((c) => c.lead.normalizedCompanyName === 'apex consulting');
    expect(apex).toHaveLength(2);
  });

  it('does not treat unrelated records without a website as duplicates', () => {
    const keys = result.candidates.filter((c) => !c.lead.normalizedDomain).map((c) => c.lead.dedupeKey);
    expect(keys).toEqual(['n:summit roofing', 'n:evergreen landscaping']);
  });

  it('attaches quality warnings and provisional scores', () => {
    const byName = (n) => result.candidates.find((c) => c.lead.companyName.startsWith(n)).lead;
    expect(byName('Quartz').dataQualityWarnings.map((w) => w.code)).toEqual(['INVALID_EMAIL']);
    expect(byName('Quartz').contactEmail).toBeUndefined();
    expect(byName('Orchid').provisional).toBe(true);
    expect(byName('Pioneer').dataQualityWarnings.map((w) => w.code)).toEqual(['UNPARSEABLE_SIZE', 'UNPARSEABLE_REVENUE']);
    expect(byName('Northwind').dataQualityWarnings).toEqual([]);
  });

  it('keeps every score inside 0..100 and priorities consistent with thresholds', () => {
    for (const { lead } of result.candidates) {
      expect(lead.score).toBeGreaterThanOrEqual(0);
      expect(lead.score).toBeLessThanOrEqual(100);
      const expected = lead.score >= 70 ? 'high' : lead.score >= 40 ? 'medium' : 'low';
      expect(lead.priority).toBe(expected);
    }
  });
});

describe('prepareImport: parsing and file-level errors', () => {
  it('rejects an empty file', () => {
    const e = failure('');
    expect(e.name).toBe('ApiError'); // not instanceof: Vitest and Node load separate copies of CJS modules
    expect(e.status).toBe(400);
    expect(failure('   \n ').status).toBe(400);
  });

  it('rejects a header with no data rows', () => {
    expect(failure('Company Name,Website\n').message).toMatch(/no data rows/);
  });

  it('rejects a file without a company column and lists accepted headers', () => {
    const e = failure('Website,Industry\nacme.example,Software\n');
    expect(e.status).toBe(422);
    expect(e.details.missingColumns).toEqual(['companyName']);
    expect(e.details.acceptedHeaders.length).toBeGreaterThan(0);
  });

  it('rejects malformed CSV with a clear message', () => {
    expect(failure('Company Name,Website\n"Acme,acme.example\n').message).toMatch(/^Malformed CSV/);
    expect(failure('Company Name,Website\nAcme,acme.example,extra\n').message).toMatch(/^Malformed CSV/);
  });

  it('rejects binary content', () => {
    expect(failure(Buffer.from([0x50, 0x4b, 0x00, 0x03]).toString('latin1')).status).toBe(400);
  });

  it('enforces the maximum row count', () => {
    const csv = `Company Name\n${Array.from({ length: 6 }, (_, i) => `Co ${i}`).join('\n')}\n`;
    expect(failure(csv, { ...OPTS, maxRows: 5 }).status).toBe(413);
  });

  it('handles BOM, semicolon delimiters, header aliases and reports ignored columns', () => {
    const csv = '\uFEFFOrganization;Domain;Notes\nAcme Inc;acme.example;call back\n';
    const r = run(csv);
    expect(r.candidates[0].lead.normalizedDomain).toBe('acme.example');
    expect(r.ignoredColumns).toEqual(['Notes']);
  });

  it('combines city/state/country and first/last name when single columns are absent', () => {
    const r = run('Company,City,State,First Name,Last Name\nAcme,Austin,TX,Ada,Lovelace\n');
    expect(r.candidates[0].lead.location).toBe('Austin, TX');
    expect(r.candidates[0].lead.contactName).toBe('Ada Lovelace');
  });

  it('rejects over-long values per row rather than failing the import', () => {
    const r = run(`Company Name,Industry\nAcme,${'x'.repeat(501)}\nBeta,Software\n`);
    expect(r.invalid).toBe(1);
    expect(r.candidates).toHaveLength(1);
  });
});

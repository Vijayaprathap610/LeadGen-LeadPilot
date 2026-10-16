import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import request from 'supertest';
import { parse } from 'csv-parse/sync';
import createApp from '../app';
import { testConfig, csvFile } from './helpers';

// Database-backed tests. Set MONGO_TEST_URI (e.g. mongodb://127.0.0.1:27017) to run them; each run
// uses its own throwaway database that is dropped afterwards.
const URI = process.env.MONGO_TEST_URI;
const here = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = fs.readFileSync(path.join(here, '../../client/public/sample-leads.csv'));

describe.skipIf(!URI)('API (database-backed)', () => {
  let app;
  const upload = (a, buf, name = 'leads.csv', type = 'text/csv') =>
    request(a).post('/api/leads/import').attach('file', buf, { filename: name, contentType: type });
  const list = (query = '') => request(app).get(`/api/leads${query}`);

  beforeAll(async () => {
    app = createApp(testConfig());
    await mongoose.connect(URI, { dbName: `leadpilot_test_${process.pid}_${Date.now()}` });
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('health endpoint reports a connected database', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: 'ok', database: 'connected' });
  });

  describe('import', () => {
    it('imports the sample file and returns an accurate summary', async () => {
      const res = await upload(app, SAMPLE, 'sample-leads.csv');
      expect(res.status).toBe(201);
      const d = res.body.data;
      expect(d).toMatchObject({ totalRows: 15, imported: 12, invalid: 1, incomplete: 6, fileName: 'sample-leads.csv' });
      expect(d.duplicates).toEqual({ total: 2, inFile: 2, existing: 0 });
      expect(d.importedByPriority.high + d.importedByPriority.medium + d.importedByPriority.low).toBe(12);
      expect(d.issues).toHaveLength(3);
      expect(d.totalRows).toBe(d.imported + d.invalid + d.duplicates.total);
      expect(await mongoose.connection.collection('leads').countDocuments()).toBe(12);
    });

    it('re-importing the same file creates no new records and keeps existing ones', async () => {
      const res = await upload(app, SAMPLE, 'sample-leads.csv');
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ imported: 0, invalid: 1 });
      expect(res.body.data.duplicates).toEqual({ total: 14, inFile: 2, existing: 12 });
      expect(res.body.data.issues.some((i) => /Already exists/.test(i.reason))).toBe(true);
      expect((await list()).body.pagination.total).toBe(12);
    });

    it('dashboard statistics match the stored data', async () => {
      const { data } = (await request(app).get('/api/dashboard/stats')).body;
      const total = (await list()).body.pagination.total;
      expect(data.uniqueLeads).toBe(total);
      expect(data.highPriority + data.mediumPriority + data.lowPriority).toBe(total);
      expect(data.highPriority).toBe((await list('?priority=high')).body.pagination.total);
      expect(data.needReview).toBe((await list('?dataQuality=incomplete')).body.pagination.total);
      expect(data.imports).toEqual({ count: 2, rowsProcessed: 30, duplicatesDetected: 16, invalidRejected: 2 });
      expect(data.lastImport).toMatchObject({ imported: 0, totalRows: 15 });
      expect(data.byStatus.new).toBe(total);
      expect(data.scoring).toEqual({ highThreshold: 70, mediumThreshold: 40, targetIndustries: [] });
      const scores = (await list('?limit=100')).body.data.map((l) => l.score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      expect(data.averageScore).toBeCloseTo(mean, 1);
      expect(data.provisionalScores).toBe((await list('?limit=100')).body.data.filter((l) => l.provisional).length);
    });

    it('rejects bad uploads with clear messages and leaves the database untouched', async () => {
      const wrongType = await upload(app, Buffer.from('a'), 'leads.txt', 'text/plain');
      expect(wrongType.status).toBe(400);
      expect(wrongType.body.error.message).toMatch(/\.csv/);

      const none = await request(app).post('/api/leads/import');
      expect(none.status).toBe(400);
      expect(none.body.error.message).toMatch(/No file uploaded/);

      const missingCol = await upload(app, Buffer.from('Website,Industry\nacme.example,Software\n'));
      expect(missingCol.status).toBe(422);
      expect(missingCol.body.error.details.missingColumns).toEqual(['companyName']);

      expect((await upload(app, Buffer.from(''))).status).toBe(400);
      expect((await upload(app, Buffer.from('Company Name\n'))).status).toBe(400);
      expect((await upload(app, Buffer.from('Company Name,Website\n"x,y\n'))).body.error.message).toMatch(/Malformed CSV/);

      const small = createApp(testConfig({ maxFileSizeMb: 0.001 }));
      const tooBig = await upload(small, SAMPLE);
      expect(tooBig.status).toBe(413);
      expect(tooBig.body.error.message).toMatch(/too large/);

      expect((await list()).body.pagination.total).toBe(12);
    });
  });

  describe('listing, search, filters, sorting', () => {
    it('paginates and returns totals', async () => {
      const page3 = (await list('?limit=5&page=3')).body;
      expect(page3.data).toHaveLength(2);
      expect(page3.pagination).toEqual({ page: 3, limit: 5, total: 12, totalPages: 3 });
      const beyond = (await list('?limit=5&page=9')).body;
      expect(beyond.data).toEqual([]);
      expect(beyond.pagination.total).toBe(12);
    });

    it('sorts by score descending by default, ascending on request, and by name', async () => {
      const desc = (await list()).body.data.map((l) => l.score);
      expect(desc).toEqual([...desc].sort((a, b) => b - a));
      const asc = (await list('?sort=score_asc')).body.data.map((l) => l.score);
      expect(asc).toEqual([...asc].sort((a, b) => a - b));
      const names = (await list('?sort=name_asc')).body.data.map((l) => l.normalizedCompanyName);
      expect(names).toEqual([...names].sort());
    });

    it('does not repeat or skip records across pages', async () => {
      const ids = [];
      for (const page of [1, 2, 3]) ids.push(...(await list(`?limit=5&page=${page}`)).body.data.map((l) => l._id));
      expect(new Set(ids).size).toBe(12);
    });

    it('filters by priority and data quality', async () => {
      const low = (await list('?priority=low')).body.data;
      expect(low).toHaveLength(1);
      expect(low[0].companyName).toBe('Orchid Software');
      expect(low[0].provisional).toBe(true);
      expect((await list('?dataQuality=incomplete')).body.pagination.total).toBe(6);
      expect((await list('?dataQuality=complete')).body.pagination.total).toBe(6);
    });

    it('searches company names and domains, case-insensitively and safely', async () => {
      expect((await list('?search=NORTHWIND')).body.pagination.total).toBe(1);
      expect((await list('?search=apex')).body.pagination.total).toBe(2);
      expect((await list('?search=bluebirdlogistics.example')).body.pagination.total).toBe(1);
      const weird = await list(`?search=${encodeURIComponent('(.*[')}`);
      expect(weird.status).toBe(200);
      expect(weird.body.data).toEqual([]);
      const empty = await list('?search=zzzznothing');
      expect(empty.status).toBe(200);
      expect(empty.body.pagination).toMatchObject({ total: 0, totalPages: 1 });
    });

    it('rejects invalid query parameters', async () => {
      for (const q of ['?limit=101', '?limit=0', '?page=0', '?page=x', '?priority=urgent', '?status=maybe', '?sort=bad', '?dataQuality=meh']) {
        const res = await list(q);
        expect(res.status, q).toBe(400);
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('single lead and status updates', () => {
    let id;
    beforeAll(async () => { id = (await list('?search=harbor')).body.data[0]._id; });

    it('returns a lead with its score explanation', async () => {
      const res = await request(app).get(`/api/leads/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.companyName).toBe('Harbor Dental Group');
      expect(res.body.data.scoreBreakdown.map((b) => b.criterion)).toContain('completeness');
      expect(res.body.data.dedupeKey).toBe('d:harbordental.example');
    });

    it('handles invalid and unknown identifiers', async () => {
      expect((await request(app).get('/api/leads/not-an-id')).status).toBe(400);
      expect((await request(app).get('/api/leads/507f1f77bcf86cd799439011')).status).toBe(404);
      expect((await request(app).patch('/api/leads/not-an-id/status').send({ status: 'new' })).status).toBe(400);
      expect((await request(app).patch('/api/leads/507f1f77bcf86cd799439011/status').send({ status: 'new' })).status).toBe(404);
    });

    it('persists status changes and reflects them in filters and stats', async () => {
      const res = await request(app).patch(`/api/leads/${id}/status`).send({ status: 'contacted' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('contacted');
      expect((await request(app).get(`/api/leads/${id}`)).body.data.status).toBe('contacted');
      expect((await list('?status=contacted')).body.pagination.total).toBe(1);
      const stats = (await request(app).get('/api/dashboard/stats')).body.data;
      expect(stats.byStatus).toEqual({ new: 11, contacted: 1, qualified: 0, disqualified: 0 });
    });

    it('rejects invalid status values and malformed JSON', async () => {
      expect((await request(app).patch(`/api/leads/${id}/status`).send({ status: 'won' })).status).toBe(400);
      expect((await request(app).patch(`/api/leads/${id}/status`).send({})).status).toBe(400);
      const bad = await request(app).patch(`/api/leads/${id}/status`).set('Content-Type', 'application/json').send('{oops');
      expect(bad.status).toBe(400);
      expect(bad.body.error.message).toMatch(/JSON/);
    });
  });

  describe('export', () => {
    it('exports all matching records as CSV with expected columns', async () => {
      const res = await request(app).get('/api/leads/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="leadpilot-export-\d{4}-\d{2}-\d{2}\.csv"/);
      const rows = parse(res.text, { columns: true });
      expect(rows).toHaveLength(12);
      expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['companyName', 'domain', 'score', 'priority', 'status', 'dataQualityWarnings', 'scoreExplanation']));
      const scores = rows.map((r) => Number(r.score));
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(rows.find((r) => r.companyName === 'Harbor Dental Group').status).toBe('contacted');
    });

    it('respects filters', async () => {
      const rows = parse((await request(app).get('/api/leads/export?priority=low')).text, { columns: true });
      expect(rows).toHaveLength(1);
      expect(rows[0].scoreIsProvisional).toBe('yes');
      const none = parse((await request(app).get('/api/leads/export?search=zzzz')).text, { columns: true });
      expect(none).toHaveLength(0);
    });

    it('returns a JSON error (not a download) for invalid filters', async () => {
      const res = await request(app).get('/api/leads/export?priority=urgent');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.headers['content-disposition']).toBeUndefined();
    });
  });

  describe('rescoring', () => {
    it('applies new thresholds to stored leads and can be reversed', async () => {
      const strict = createApp(testConfig({ scoring: { highThreshold: 95, mediumThreshold: 80, targetIndustries: [] } }));
      const a = await request(strict).post('/api/leads/rescore');
      expect(a.status).toBe(200);
      expect(a.body.data).toMatchObject({ rescored: 12, thresholds: { high: 95, medium: 80 } });
      expect(a.body.data.priorityChanged).toBeGreaterThan(0);
      const highScores = (await list('?priority=high')).body.data.map((l) => l.score);
      expect(highScores.length).toBeGreaterThan(0);
      expect(highScores.every((s) => s >= 95)).toBe(true);

      const b = await request(app).post('/api/leads/rescore');
      expect(b.body.data.priorityChanged).toBe(a.body.data.priorityChanged);
      expect((await request(app).get('/api/dashboard/stats')).body.data.highPriority).toBe(9);
    });
  });

  describe('concurrency and export safety', () => {
    it('two simultaneous imports of the same file never create duplicates', async () => {
      // Whether the unique-index race path is actually hit depends on timing; the invariants must hold either way.
      const csv = `Company Name,Website\n${Array.from({ length: 20 }, (_, i) => `Race Co ${i},raceco${i}.example`).join('\n')}\n`;
      const [x, y] = await Promise.all([upload(app, Buffer.from(csv)), upload(app, Buffer.from(csv))]);
      expect([x.status, y.status].every((s) => s === 200 || s === 201)).toBe(true);
      expect(x.body.data.imported + y.body.data.imported).toBe(20);
      expect(x.body.data.duplicates.existing + y.body.data.duplicates.existing).toBe(20);
      expect((await list('?search=race%20co&limit=100')).body.pagination.total).toBe(20);
      expect(await mongoose.connection.collection('leads').countDocuments({ dedupeKey: /^d:raceco/ })).toBe(20);
    });

    it('neutralises spreadsheet formulas in exported cells', async () => {
      const res = await upload(app, Buffer.from('Company Name,Website\n"=HYPERLINK(""http://evil.example"",""x"")",evilco.example\n'));
      expect(res.status).toBe(201);
      const rows = parse((await request(app).get('/api/leads/export?search=hyperlink')).text, { columns: true });
      expect(rows).toHaveLength(1);
      expect(rows[0].companyName.startsWith("'=")).toBe(true);
    });
  });
});

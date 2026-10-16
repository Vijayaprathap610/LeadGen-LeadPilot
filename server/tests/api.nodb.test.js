import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import createApp from '../app';
import { errorHandler } from '../middleware/errorHandler';
import { testConfig } from './helpers';

// These run with no database connection at all, so they cover the failure paths.
describe('API without a database connection', () => {
  const app = createApp(testConfig());

  it('health reports a degraded state', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, status: 'degraded', database: 'disconnected' });
  });

  it.each(['/api/leads', '/api/leads/export', '/api/dashboard/stats'])('%s returns a safe 503', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, error: { message: expect.stringMatching(/database/i) } });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('HTTP security behaviour', () => {
  it('sets security headers and hides the framework', async () => {
    const res = await request(createApp(testConfig())).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('allows only configured CORS origins', async () => {
    const app = createApp(testConfig());
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate-limits API requests with a JSON 429', async () => {
    const app = createApp(testConfig({ rateLimit: { windowMs: 60000, max: 3, importMax: 3 } }));
    for (let i = 0; i < 3; i += 1) await request(app).get('/api/health');
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });

  it('hides internal error details in production but not in development', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const build = (env) => {
      const a = express();
      a.set('config', testConfig({ env }));
      a.get('/boom', () => { throw new Error('secret connection string'); });
      a.use(errorHandler);
      return a;
    };
    const prod = await request(build('production')).get('/boom');
    expect(prod.status).toBe(500);
    expect(prod.body.error).toEqual({ message: 'Internal server error.' });
    expect(JSON.stringify(prod.body)).not.toMatch(/secret/);
    const dev = await request(build('development')).get('/boom');
    expect(dev.body.error.debug).toBe('secret connection string');
    spy.mockRestore();
  });
});

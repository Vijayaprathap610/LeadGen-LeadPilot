export const testConfig = (overrides = {}) => ({
  env: 'test',
  port: 0,
  clientOrigins: ['http://localhost:5173'],
  maxFileSizeMb: 5,
  maxImportRows: 1000,
  trustProxy: false,
  rateLimit: { windowMs: 60000, max: 10000, importMax: 10000 },
  scoring: { highThreshold: 70, mediumThreshold: 40, targetIndustries: [] },
  ...overrides,
});

export const csvFile = (text, filename = 'leads.csv') => ({
  buffer: Buffer.from(text), options: { filename, contentType: 'text/csv' },
});

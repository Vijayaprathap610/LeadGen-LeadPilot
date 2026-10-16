'use strict';
require('dotenv').config({ quiet: true });

function readNumber(name, fallback, { min = 1, max = Infinity, integer = true } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`Invalid environment variable ${name}="${raw}" (expected ${integer ? 'an integer' : 'a number'} between ${min} and ${max}).`);
  }
  return value;
}

function readList(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: readNumber('PORT', 5000, { min: 1, max: 65535 }),
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://vijayaprathap610navi_db_user:PklSIogPqxvrzSu9@leadpilot.rwantnw.mongodb.net/',
  clientOrigins: readList('CLIENT_URL', ['https://leadpilotv01.netlify.app/']).map((o) => o.replace(/\/+$/, '')),
  maxFileSizeMb: readNumber('MAX_FILE_SIZE_MB', 5, { min: 0.1, max: 50, integer: false }),
  maxImportRows: readNumber('MAX_IMPORT_ROWS', 20000, { min: 1, max: 200000 }),
  trustProxy: process.env.TRUST_PROXY === 'true',
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: readNumber('RATE_LIMIT_MAX', 300),
    importMax: readNumber('IMPORT_RATE_LIMIT_MAX', 20),
  },
  scoring: {
    highThreshold: readNumber('SCORE_HIGH_THRESHOLD', 70, { min: 1, max: 100 }),
    mediumThreshold: readNumber('SCORE_MEDIUM_THRESHOLD', 40, { min: 1, max: 100 }),
    targetIndustries: readList('TARGET_INDUSTRIES', []),
  },
};

if (config.scoring.mediumThreshold >= config.scoring.highThreshold) {
  throw new Error('SCORE_MEDIUM_THRESHOLD must be lower than SCORE_HIGH_THRESHOLD.');
}

module.exports = config;

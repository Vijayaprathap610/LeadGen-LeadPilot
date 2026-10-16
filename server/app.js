'use strict';
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const leadRoutes = require('./routes/leads');
const dashboardRoutes = require('./routes/dashboard');
const requireDb = require('./middleware/requireDb');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function createApp(config = require('./config/env')) {
  const app = express();
  app.set('config', config);
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      // Requests without an Origin header (curl, Postman, server-to-server) are not browser CORS requests.
      callback(null, !origin || config.clientOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    exposedHeaders: ['Content-Disposition'],
  }));
  app.use('/api', rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests. Please slow down.' } },
  }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      status: connected ? 'ok' : 'degraded',
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });
  app.use('/api/leads', requireDb, leadRoutes(config));
  app.use('/api/dashboard', requireDb, dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = createApp;

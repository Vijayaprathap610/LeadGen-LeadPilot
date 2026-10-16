'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/leadController');
const { createUpload } = require('../middleware/upload');

function leadRoutes(config) {
  const router = express.Router();
  const importLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.importMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many imports. Please wait before uploading again.' } },
  });

  // Fixed paths must be registered before "/:id".
  router.get('/export', controller.exportCsv);
  router.post('/import', importLimiter, createUpload(config), controller.importCsv);
  router.post('/rescore', controller.rescore);
  router.get('/', controller.list);
  router.get('/:id', controller.getOne);
  router.patch('/:id/status', controller.updateStatus);
  return router;
}

module.exports = leadRoutes;

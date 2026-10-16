'use strict';
const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');

const CSV_MIME = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream']);

/** In-memory upload: the CSV is parsed and discarded, never written to disk or served. */
function createUpload(config) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(config.maxFileSizeMb * 1024 * 1024), files: 1, fields: 5 },
    fileFilter(req, file, cb) {
      const isCsvName = path.extname(file.originalname || '').toLowerCase() === '.csv';
      if (!isCsvName || !CSV_MIME.has(file.mimetype)) {
        return cb(new ApiError(400, 'Only .csv files are accepted.'));
      }
      return cb(null, true);
    },
  }).single('file');
}

module.exports = { createUpload };

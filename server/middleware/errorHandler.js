'use strict';
const mongoose = require('mongoose');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const DB_UNAVAILABLE = new Set([
  'MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError',
  'MongoNotConnectedError', 'MongoTopologyClosedError', 'MongoNetworkTimeoutError',
]);

function toHttpError(err, config) {
  if (err instanceof ApiError) return { status: err.status, message: err.message, details: err.details };
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return { status: 413, message: `File is too large. The maximum size is ${config.maxFileSizeMb} MB.` };
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return { status: 400, message: 'Unexpected file field. Upload the CSV in a field named "file".' };
    return { status: 400, message: `Upload error: ${err.message}` };
  }
  if (err.type === 'entity.parse.failed') return { status: 400, message: 'The request body is not valid JSON.' };
  if (err.type === 'entity.too.large') return { status: 413, message: 'The request body is too large.' };
  if (err instanceof mongoose.Error.CastError) return { status: 400, message: 'Invalid identifier or value.' };
  if (err instanceof mongoose.Error.ValidationError) {
    return { status: 422, message: Object.values(err.errors)[0]?.message || 'Validation failed.' };
  }
  if (err.code === 11000) return { status: 409, message: 'A record with the same key already exists.' };
  if (DB_UNAVAILABLE.has(err.name)) return { status: 503, message: 'The database is temporarily unavailable. Please try again shortly.' };
  return { status: 500, message: 'Internal server error.' };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const config = req.app.get('config');
  const { status, message, details } = toHttpError(err, config);

  if (status >= 500 && !(err instanceof ApiError)) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return res.destroy(err); // e.g. a streamed export failed part-way

  res.removeHeader('Content-Disposition');
  const body = { success: false, error: { message } };
  if (details) body.error.details = details;
  if (status === 500 && config.env !== 'production') body.error.debug = String(err && err.message);
  return res.status(status).json(body);
}

function notFound(req, res) {
  res.status(404).json({ success: false, error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

module.exports = { errorHandler, notFound };

'use strict';
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

module.exports = function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(new ApiError(503, 'The database is not connected. Please try again shortly.'));
  }
  return next();
};

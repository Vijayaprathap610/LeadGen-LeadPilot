'use strict';
const ApiError = require('../utils/ApiError');
const { cleanText } = require('../utils/normalize');
const { STATUSES, PRIORITIES } = require('../models/Lead');

const SORTS = {
  score_desc: { score: -1, _id: 1 },
  score_asc: { score: 1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { normalizedCompanyName: 1, _id: 1 },
};
const MAX_LIMIT = 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function oneOf(value, allowed, name) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new ApiError(400, `Invalid ${name}. Allowed values: ${allowed.join(', ')}.`);
  }
  return value;
}

function integer(value, fallback, name, min, max) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new ApiError(400, `Invalid ${name}. Expected an integer between ${min} and ${max}.`);
  return n;
}

/** Validates list/export query parameters and builds the Mongo filter and sort. */
function parseListQuery(query, { paginate = true } = {}) {
  const filter = {};
  const priority = oneOf(query.priority, PRIORITIES, 'priority');
  const status = oneOf(query.status, STATUSES, 'status');
  const quality = oneOf(query.dataQuality, ['complete', 'incomplete'], 'dataQuality');
  const sortKey = oneOf(query.sort, Object.keys(SORTS), 'sort') || 'score_desc';

  if (priority) filter.priority = priority;
  if (status) filter.status = status;
  if (quality) filter.hasWarnings = quality === 'incomplete';

  if (query.search !== undefined && typeof query.search !== 'string') throw new ApiError(400, 'Invalid search.');
  const search = cleanText(query.search).slice(0, 100);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ companyName: pattern }, { normalizedDomain: pattern }];
  }

  const result = { filter, sort: SORTS[sortKey] };
  if (paginate) {
    result.page = integer(query.page, 1, 'page', 1, 1e6);
    result.limit = integer(query.limit, 25, 'limit', 1, MAX_LIMIT);
  }
  return result;
}

module.exports = { parseListQuery, SORTS };

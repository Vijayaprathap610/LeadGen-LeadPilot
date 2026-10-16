'use strict';
const {
  cleanText, normalizeCompanyName, normalizeDomain, isValidEmail, parseCompanySize, parseRevenue,
} = require('../utils/normalize');
const { scoreLead } = require('./scoring');

const MAX_NAME = 200;
const MAX_FIELD = 500;
const OPTIONAL = ['website', 'industry', 'companySize', 'revenueRange', 'contactName', 'contactEmail', 'source'];

const orUndefined = (value) => (value === '' ? undefined : value);

/**
 * Validates, normalizes and scores one parsed CSV row.
 * @returns {{ error: string } | { lead: object }}
 */
function buildLead(raw, scoringOptions) {
  const companyName = cleanText(raw.companyName);
  if (!companyName) return { error: 'Company name is missing.' };
  if (companyName.length > MAX_NAME) return { error: `Company name is longer than ${MAX_NAME} characters.` };

  const fields = {};
  for (const key of OPTIONAL) fields[key] = cleanText(raw[key]);
  fields.contactName = fields.contactName || cleanText([raw.firstName, raw.lastName].map(cleanText).filter(Boolean).join(' '));
  fields.location = cleanText(raw.location) || [raw.city, raw.state, raw.country].map(cleanText).filter(Boolean).join(', ');

  for (const [key, value] of Object.entries(fields)) {
    if (value.length > MAX_FIELD) return { error: `Value in "${key}" is longer than ${MAX_FIELD} characters.` };
  }

  const warnings = [];
  const warn = (code, message) => warnings.push({ code, message });

  const normalizedDomain = fields.website ? normalizeDomain(fields.website) : null;
  if (!fields.website) warn('MISSING_WEBSITE', 'No website provided; duplicates can only be matched by company name.');
  else if (!normalizedDomain) warn('INVALID_WEBSITE', `Website "${fields.website}" could not be parsed as a domain.`);

  if (!fields.industry) warn('MISSING_INDUSTRY', 'No industry provided.');
  if (!fields.location) warn('MISSING_LOCATION', 'No location provided.');

  if (!fields.companySize) warn('MISSING_SIZE', 'No company size provided.');
  else if (!parseCompanySize(fields.companySize)) warn('UNPARSEABLE_SIZE', `Company size "${fields.companySize}" could not be interpreted.`);

  if (!fields.revenueRange) warn('MISSING_REVENUE', 'No revenue provided.');
  else if (!parseRevenue(fields.revenueRange)) warn('UNPARSEABLE_REVENUE', `Revenue "${fields.revenueRange}" could not be interpreted (only USD amounts are understood).`);

  let contactEmail = fields.contactEmail;
  if (contactEmail && !isValidEmail(contactEmail)) {
    warn('INVALID_EMAIL', `Contact email "${contactEmail}" is not valid and was not saved.`);
    contactEmail = '';
  }
  if (!fields.contactName && !contactEmail) warn('MISSING_CONTACT', 'No contact name or email provided.');

  const normalizedCompanyName = normalizeCompanyName(companyName);
  const dedupeKey = normalizedDomain ? `d:${normalizedDomain}` : `n:${normalizedCompanyName}`;

  const lead = {
    companyName,
    normalizedCompanyName,
    website: orUndefined(fields.website),
    normalizedDomain,
    industry: orUndefined(fields.industry),
    location: orUndefined(fields.location),
    companySize: orUndefined(fields.companySize),
    revenueRange: orUndefined(fields.revenueRange),
    contactName: orUndefined(fields.contactName),
    contactEmail: orUndefined(contactEmail),
    source: orUndefined(fields.source),
    dedupeKey,
    dataQualityWarnings: warnings,
    hasWarnings: warnings.length > 0,
  };

  const scored = scoreLead(lead, scoringOptions);
  lead.score = scored.score;
  lead.priority = scored.priority;
  lead.provisional = scored.provisional;
  lead.scoreBreakdown = scored.breakdown;
  return { lead };
}

module.exports = { buildLead };

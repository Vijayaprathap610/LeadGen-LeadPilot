'use strict';

const LEGAL_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'limited',
  'corp', 'corporation', 'co', 'company', 'gmbh', 'plc', 'pvt', 'pte',
]);

/** Strip control characters, collapse whitespace, trim. Always returns a string. */
function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "Acme, Inc." and "ACME Incorporated" both become "acme". Never returns empty for a non-empty input. */
function normalizeCompanyName(name) {
  const base = cleanText(name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.'\u2019]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const tokens = base.split(/\s+/).filter(Boolean);
  const original = tokens.join(' ');
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ') || original;
}

const HOSTNAME = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

/** Returns a bare lowercase hostname without "www.", or null when the input is not a usable website. */
function normalizeDomain(input) {
  let value = cleanText(input).toLowerCase();
  if (!value || value.includes('@')) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `http://${value}`;
  let hostname;
  try {
    hostname = new URL(value).hostname;
  } catch {
    return null;
  }
  hostname = hostname.replace(/\.$/, '').replace(/^www\./, '');
  return HOSTNAME.test(hostname) ? hostname : null;
}

function isValidEmail(value) {
  const email = cleanText(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

const MULTIPLIERS = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
const FILLER = /\b(employees?|staff|people|ppl|headcount|approx(?:imately)?|about|around|annual|annually|revenue|per year|a year|yearly|usd|us|dollars?|to)\b|[~$,]/g;

/**
 * Shared range parser for sizes ("51-200", "1,000+", "<10") and revenue ("$1M-$5M", "500k").
 * Returns { min, max } (max === null means open-ended) or null when the text cannot be interpreted.
 */
function parseRange(raw, { allowUnits }) {
  let text = cleanText(raw).toLowerCase();
  if (!text) return null;
  if (/[€£¥₹]|\b(eur|gbp|inr|cad|aud|jpy|cny)\b/.test(text)) return null;

  const upper = /^(<|under|less than|up to|below)\s*/.test(text);
  const lower = /(\+|^(>|over|more than|above)\s*)/.test(text) || /\b(plus)\b/.test(text);
  text = text.replace(/^(<|>|under|less than|up to|below|over|more than|above)\s*/, '').replace(/\+/g, ' ').replace(/\bplus\b/g, ' ');
  text = text.replace(/(\d),(?=\d{3}\b)/g, '$1').replace(FILLER, ' ').replace(/[–—]/g, '-');

  const unitPattern = allowUnits ? '(thousand|million|billion|mm|mn|bn|k|m|b)?' : '(k)?';
  const tokenRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unitPattern}(?![a-z])`, 'g');
  const tokens = [];
  let match;
  while ((match = tokenRe.exec(text)) !== null) {
    tokens.push({ value: Number(match[1]), unit: match[2] || null });
  }
  const leftover = text.replace(tokenRe, ' ').replace(/[-\s]/g, '');
  if (leftover.length > 0 || tokens.length === 0 || tokens.length > 2) return null;

  if (tokens.length === 2 && !tokens[0].unit && tokens[1].unit && tokens[0].value <= tokens[1].value) {
    tokens[0].unit = tokens[1].unit;
  }
  const values = tokens.map(({ value, unit }) => value * (unit ? MULTIPLIERS[unit] : 1));
  if (values.some((v) => !Number.isFinite(v))) return null;

  if (values.length === 2) return values[0] <= values[1] ? { min: values[0], max: values[1] } : null;
  if (upper) return { min: 0, max: values[0] };
  if (lower) return { min: values[0], max: null };
  return { min: values[0], max: values[0] };
}

const parseCompanySize = (raw) => parseRange(raw, { allowUnits: false });
const parseRevenue = (raw) => parseRange(raw, { allowUnits: true });

/** A single representative number for banding: midpoint of a closed range, lower bound of an open one. */
function representativeValue(range) {
  if (!range) return null;
  return range.max === null ? range.min : (range.min + range.max) / 2;
}

module.exports = {
  cleanText, normalizeCompanyName, normalizeDomain, isValidEmail,
  parseCompanySize, parseRevenue, representativeValue,
};

'use strict';
const { parse } = require('csv-parse/sync');
const ApiError = require('../utils/ApiError');

const norm = (header) => String(header).toLowerCase().replace(/[^a-z0-9]/g, '');

const FIELD_ALIASES = {
  companyName: ['companyname', 'company', 'name', 'organization', 'organisation', 'accountname', 'businessname'],
  website: ['website', 'domain', 'url', 'companywebsite', 'site', 'websiteurl', 'companydomain'],
  industry: ['industry', 'sector', 'vertical'],
  location: ['location', 'headquarters', 'hq', 'address', 'region'],
  city: ['city'],
  state: ['state', 'province'],
  country: ['country'],
  companySize: ['companysize', 'employees', 'employeecount', 'numberofemployees', 'size', 'headcount', 'employeesrange'],
  revenueRange: ['revenue', 'revenuerange', 'annualrevenue', 'estimatedrevenue'],
  contactName: ['contactname', 'contact', 'fullname', 'contactperson'],
  firstName: ['firstname'],
  lastName: ['lastname'],
  contactEmail: ['contactemail', 'email', 'emailaddress'],
  source: ['source', 'leadsource'],
};

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  for (const alias of aliases) ALIAS_TO_FIELD.set(alias, field);
}

const ACCEPTED_COMPANY_HEADERS = ['Company Name', 'Company', 'Name', 'Organization'];

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/**
 * Parses a CSV buffer into [{ rowNumber, raw }] where raw uses canonical field names.
 * Throws ApiError for file-level problems; row-level validation happens later.
 */
function parseCsvBuffer(buffer, { maxRows }) {
  if (!buffer || buffer.length === 0) throw new ApiError(400, 'The uploaded file is empty.');
  const text = buffer.toString('utf8');
  if (text.includes('\u0000')) throw new ApiError(400, 'The file does not look like a text CSV (binary content detected).');
  if (text.trim() === '') throw new ApiError(400, 'The uploaded file is empty.');

  let records;
  try {
    records = parse(text, {
      bom: true, skip_empty_lines: true, trim: true,
      delimiter: detectDelimiter(text), relax_column_count: false,
    });
  } catch (err) {
    if (err && typeof err.code === 'string' && err.code.startsWith('CSV_')) {
      throw new ApiError(400, `Malformed CSV: ${err.message}`, { code: err.code });
    }
    throw err;
  }

  if (records.length === 0) throw new ApiError(400, 'The uploaded file is empty.');
  if (records.length === 1) throw new ApiError(400, 'The CSV has a header row but no data rows.');

  const headers = records[0];
  const columnMap = []; // index -> canonical field
  const ignoredColumns = [];
  const used = new Set();
  headers.forEach((header, index) => {
    const field = ALIAS_TO_FIELD.get(norm(header));
    if (field && !used.has(field)) {
      used.add(field);
      columnMap[index] = field;
    } else {
      ignoredColumns.push(String(header));
    }
  });

  if (!used.has('companyName')) {
    throw new ApiError(422, 'Missing required column: company name.', {
      missingColumns: ['companyName'],
      acceptedHeaders: ACCEPTED_COMPANY_HEADERS,
      foundHeaders: headers,
    });
  }

  const dataRows = records.slice(1);
  if (dataRows.length > maxRows) {
    throw new ApiError(413, `The file has ${dataRows.length} rows; the maximum per import is ${maxRows}.`);
  }

  const rows = dataRows.map((cells, i) => {
    const raw = {};
    cells.forEach((cell, index) => {
      if (columnMap[index]) raw[columnMap[index]] = cell;
    });
    return { rowNumber: i + 1, raw };
  });

  return { rows, ignoredColumns, recognizedColumns: [...used] };
}

module.exports = { parseCsvBuffer };

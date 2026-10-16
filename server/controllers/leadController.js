'use strict';
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { stringify } = require('csv-stringify');
const Lead = require('../models/Lead');
const ApiError = require('../utils/ApiError');
const { parseListQuery } = require('../services/leadQuery');
const { importLeads } = require('../services/importService');
const { scoreLead, explain } = require('../services/scoring');

const OBJECT_ID = /^[a-f\d]{24}$/i;
const assertId = (id) => {
  if (!OBJECT_ID.test(id)) throw new ApiError(400, 'Invalid lead id.');
};

async function list(req, res) {
  const { filter, sort, page, limit } = parseListQuery(req.query);
  const [data, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).select('-__v').lean(),
    Lead.countDocuments(filter),
  ]);
  res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
}

async function getOne(req, res) {
  assertId(req.params.id);
  const lead = await Lead.findById(req.params.id).select('-__v').lean();
  if (!lead) throw new ApiError(404, 'Lead not found.');
  res.json({ success: true, data: lead });
}

async function updateStatus(req, res) {
  assertId(req.params.id);
  const { status } = req.body || {};
  if (!Lead.STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Allowed values: ${Lead.STATUSES.join(', ')}.`);
  }
  const updated = await Lead.findByIdAndUpdate(
    req.params.id, { status }, { returnDocument: 'after', runValidators: true },
  ).lean();
  if (!updated) throw new ApiError(404, 'Lead not found.');
  const { __v, ...lead } = updated;
  res.json({ success: true, data: lead });
}

async function importCsv(req, res) {
  if (!req.file) throw new ApiError(400, 'No file uploaded. Send a CSV in a multipart field named "file".');
  const summary = await importLeads(req.file.buffer, {
    fileName: req.file.originalname.slice(0, 255),
    config: req.app.get('config'),
  });
  res.status(summary.imported > 0 ? 201 : 200).json({ success: true, data: summary });
}

// Spreadsheet apps execute cells that start with these characters as formulas.
const formulaSafe = (v) => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

const EXPORT_COLUMNS = [
  'companyName', 'website', 'domain', 'industry', 'location', 'companySize', 'revenueRange',
  'contactName', 'contactEmail', 'score', 'priority', 'scoreIsProvisional', 'status',
  'dataQualityWarnings', 'scoreExplanation',
];

function toExportRow(lead) {
  return {
    companyName: formulaSafe(lead.companyName), website: formulaSafe(lead.website || ''),
    domain: lead.normalizedDomain || '', industry: formulaSafe(lead.industry || ''),
    location: formulaSafe(lead.location || ''), companySize: formulaSafe(lead.companySize || ''),
    revenueRange: formulaSafe(lead.revenueRange || ''), contactName: formulaSafe(lead.contactName || ''),
    contactEmail: formulaSafe(lead.contactEmail || ''), score: lead.score, priority: lead.priority,
    scoreIsProvisional: lead.provisional ? 'yes' : 'no', status: lead.status,
    dataQualityWarnings: (lead.dataQualityWarnings || []).map((w) => w.code).join('; '),
    scoreExplanation: explain(lead.scoreBreakdown || []),
  };
}

async function exportCsv(req, res) {
  const { filter, sort } = parseListQuery(req.query, { paginate: false });
  async function* rows() {
    for await (const lead of Lead.find(filter).sort(sort).lean().cursor()) yield toExportRow(lead);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leadpilot-export-${new Date().toISOString().slice(0, 10)}.csv"`);
  await pipeline(Readable.from(rows()), stringify({ header: true, columns: EXPORT_COLUMNS }), res);
}

/** Recomputes score/priority for every stored lead, e.g. after thresholds or target industries change. */
async function rescore(req, res) {
  const scoring = req.app.get('config').scoring;
  let rescored = 0;
  let priorityChanged = 0;
  let ops = [];
  const flush = async () => {
    if (ops.length) await Lead.bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const lead of Lead.find({}).lean().cursor()) {
    const result = scoreLead(lead, scoring);
    rescored += 1;
    if (result.priority !== lead.priority) priorityChanged += 1;
    ops.push({
      updateOne: {
        filter: { _id: lead._id },
        update: { $set: { score: result.score, priority: result.priority, provisional: result.provisional, scoreBreakdown: result.breakdown } },
      },
    });
    if (ops.length >= 500) await flush();
  }
  await flush();
  res.json({ success: true, data: { rescored, priorityChanged, thresholds: { high: scoring.highThreshold, medium: scoring.mediumThreshold } } });
}

module.exports = { list, getOne, updateStatus, importCsv, exportCsv, rescore };

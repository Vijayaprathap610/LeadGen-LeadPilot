'use strict';
const Lead = require('../models/Lead');
const ImportBatch = require('../models/ImportBatch');

const PRIORITIES = ['high', 'medium', 'low'];
const STATUSES = ['new', 'contacted', 'qualified', 'disqualified'];

/** Sums one numeric field across a collection. One accumulator per $group keeps every aggregation simple and portable. */
async function sumOf(Model, field) {
  const [row] = await Model.aggregate([{ $group: { _id: null, total: { $sum: `$${field}` } } }]);
  return row ? row.total : 0;
}

async function stats(req, res) {
  const [groups, scoreSum, imports, rowsProcessed, duplicates, invalid, lastImport] = await Promise.all([
    // Group by every dimension we report on (at most ~48 groups), then total in JS.
    Lead.aggregate([{ $group: {
      _id: { priority: '$priority', status: '$status', hasWarnings: '$hasWarnings', provisional: '$provisional' },
      count: { $sum: 1 },
    } }]),
    sumOf(Lead, 'score'),
    ImportBatch.countDocuments(),
    sumOf(ImportBatch, 'totalRows'),
    sumOf(ImportBatch, 'duplicates'),
    sumOf(ImportBatch, 'invalid'),
    ImportBatch.findOne().sort({ createdAt: -1 }).select('-__v -_id').lean(),
  ]);

  const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let total = 0;
  let needReview = 0;
  let provisional = 0;
  for (const { _id, count } of groups) {
    total += count;
    byPriority[_id.priority] += count;
    byStatus[_id.status] += count;
    if (_id.hasWarnings) needReview += count;
    if (_id.provisional) provisional += count;
  }

  res.json({
    success: true,
    data: {
      uniqueLeads: total,
      highPriority: byPriority.high,
      mediumPriority: byPriority.medium,
      lowPriority: byPriority.low,
      needReview,
      provisionalScores: provisional,
      averageScore: total ? Math.round((scoreSum / total) * 10) / 10 : 0,
      byStatus,
      scoring: {
        highThreshold: req.app.get('config').scoring.highThreshold,
        mediumThreshold: req.app.get('config').scoring.mediumThreshold,
        targetIndustries: req.app.get('config').scoring.targetIndustries,
      },
      imports: { count: imports, rowsProcessed, duplicatesDetected: duplicates, invalidRejected: invalid },
      lastImport: lastImport || null,
    },
  });
}

module.exports = { stats };

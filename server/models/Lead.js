'use strict';
const mongoose = require('mongoose');

const STATUSES = ['new', 'contacted', 'qualified', 'disqualified'];
const PRIORITIES = ['high', 'medium', 'low'];

const warningSchema = new mongoose.Schema(
  { code: { type: String, required: true }, message: { type: String, required: true } },
  { _id: false },
);

const breakdownSchema = new mongoose.Schema(
  {
    criterion: { type: String, required: true },
    label: { type: String, required: true },
    points: { type: Number, default: null },
    max: { type: Number, default: null },
    detail: { type: String, required: true },
  },
  { _id: false },
);

const leadSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    normalizedCompanyName: { type: String, required: true, index: true },
    website: { type: String, maxlength: 500 },
    normalizedDomain: { type: String, default: null },
    industry: { type: String, maxlength: 500 },
    location: { type: String, maxlength: 500 },
    companySize: { type: String, maxlength: 500 },
    revenueRange: { type: String, maxlength: 500 },
    contactName: { type: String, maxlength: 500 },
    contactEmail: { type: String, maxlength: 254, lowercase: true },
    source: { type: String, maxlength: 255 },
    importBatchId: { type: String, index: true },

    // Duplicate key: "d:<domain>" when a valid domain exists, otherwise "n:<normalized name>".
    // Always populated, so records without a website can never collide on an empty value.
    dedupeKey: { type: String, required: true, unique: true },

    score: { type: Number, required: true, min: 0, max: 100 },
    priority: { type: String, enum: PRIORITIES, required: true },
    provisional: { type: Boolean, default: false },
    scoreBreakdown: { type: [breakdownSchema], default: [] },

    status: { type: String, enum: STATUSES, default: 'new' },
    dataQualityWarnings: { type: [warningSchema], default: [] },
    hasWarnings: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Default list view (priority filter + score sort) and the status filter.
leadSchema.index({ priority: 1, score: -1, _id: 1 });
leadSchema.index({ score: -1, _id: 1 });
leadSchema.index({ status: 1, score: -1 });
leadSchema.index({ hasWarnings: 1 });
leadSchema.index({ normalizedDomain: 1 });

module.exports = mongoose.model('Lead', leadSchema);
module.exports.STATUSES = STATUSES;
module.exports.PRIORITIES = PRIORITIES;

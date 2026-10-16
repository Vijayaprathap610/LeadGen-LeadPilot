'use strict';
const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, unique: true },
    fileName: { type: String, maxlength: 255 },
    totalRows: { type: Number, required: true, min: 0 },
    imported: { type: Number, required: true, min: 0 },
    duplicatesInFile: { type: Number, required: true, min: 0 },
    duplicatesExisting: { type: Number, required: true, min: 0 },
    duplicates: { type: Number, required: true, min: 0 },
    invalid: { type: Number, required: true, min: 0 },
    incomplete: { type: Number, required: true, min: 0 },
    ignoredColumns: { type: [String], default: [] },
  },
  { timestamps: true },
);

importBatchSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ImportBatch', importBatchSchema);

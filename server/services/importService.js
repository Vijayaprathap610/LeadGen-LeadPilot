'use strict';
const crypto = require('crypto');
const Lead = require('../models/Lead');
const ImportBatch = require('../models/ImportBatch');
const { parseCsvBuffer } = require('./csvParser');
const { buildLead } = require('./leadBuilder');

const ISSUE_CAP = 1000;
const INSERT_CHUNK = 500;
const LOOKUP_CHUNK = 1000;

const keyKind = (key) => (key.startsWith('d:') ? 'website domain' : 'company name');

/**
 * Pure step (no database): parse, validate, normalize, score and de-duplicate within the file.
 * The first occurrence of a key wins; later ones are reported, never silently dropped.
 */
function prepareImport(buffer, { maxRows, scoring }) {
  const parsed = parseCsvBuffer(buffer, { maxRows });
  const issues = [];
  const candidates = [];
  const firstRowForKey = new Map();
  let invalid = 0;
  let duplicatesInFile = 0;

  for (const { rowNumber, raw } of parsed.rows) {
    const result = buildLead(raw, scoring);
    if (result.error) {
      invalid += 1;
      issues.push({ row: rowNumber, companyName: raw.companyName || '', type: 'invalid', reason: result.error });
      continue;
    }
    const { lead } = result;
    if (firstRowForKey.has(lead.dedupeKey)) {
      duplicatesInFile += 1;
      issues.push({
        row: rowNumber, companyName: lead.companyName, type: 'duplicate',
        reason: `Duplicate of row ${firstRowForKey.get(lead.dedupeKey)} in this file (same ${keyKind(lead.dedupeKey)}).`,
      });
      continue;
    }
    firstRowForKey.set(lead.dedupeKey, rowNumber);
    candidates.push({ rowNumber, lead });
  }

  return {
    totalRows: parsed.rows.length, candidates, issues, invalid, duplicatesInFile,
    ignoredColumns: parsed.ignoredColumns,
  };
}

async function findExisting(keys) {
  const found = new Map();
  for (let i = 0; i < keys.length; i += LOOKUP_CHUNK) {
    const docs = await Lead.find({ dedupeKey: { $in: keys.slice(i, i + LOOKUP_CHUNK) } })
      .select('dedupeKey companyName').lean();
    docs.forEach((d) => found.set(d.dedupeKey, d.companyName));
  }
  return found;
}

/**
 * Import is per-record safe but not atomic across the whole file (no multi-document transaction, so it
 * also works on a standalone MongoDB). Existing records are never modified, and re-importing the same
 * file is harmless because the unique dedupeKey index rejects repeats.
 */
async function importLeads(buffer, { fileName, config }) {
  const prepared = prepareImport(buffer, { maxRows: config.maxImportRows, scoring: config.scoring });
  const batchId = crypto.randomUUID();
  const issues = [...prepared.issues];

  const existing = await findExisting(prepared.candidates.map((c) => c.lead.dedupeKey));
  const toInsert = [];
  let duplicatesExisting = 0;
  for (const { rowNumber, lead } of prepared.candidates) {
    if (existing.has(lead.dedupeKey)) {
      duplicatesExisting += 1;
      issues.push({
        row: rowNumber, companyName: lead.companyName, type: 'duplicate',
        reason: `Already exists as "${existing.get(lead.dedupeKey)}" (same ${keyKind(lead.dedupeKey)}). Existing record was kept.`,
      });
    } else {
      toInsert.push({ rowNumber, lead: { ...lead, source: lead.source || fileName, importBatchId: batchId } });
    }
  }

  const insertedKeys = new Set();
  let incomplete = 0;
  const countInserted = (docs) => docs.forEach((d) => {
    insertedKeys.add(d.dedupeKey);
    if (d.hasWarnings) incomplete += 1;
  });

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    try {
      countInserted(await Lead.insertMany(chunk.map((c) => c.lead), { ordered: false }));
    } catch (err) {
      if (!Array.isArray(err.writeErrors)) throw err;
      countInserted(err.insertedDocs || []);
      for (const writeError of err.writeErrors) {
        if ((writeError.code ?? writeError.err?.code) !== 11000) throw err;
        const item = chunk[writeError.index];
        duplicatesExisting += 1;
        issues.push({
          row: item.rowNumber, companyName: item.lead.companyName, type: 'duplicate',
          reason: `Another import created the same ${keyKind(item.lead.dedupeKey)} while this file was processing. Existing record was kept.`,
        });
      }
    }
  }

  const imported = insertedKeys.size;
  const duplicates = prepared.duplicatesInFile + duplicatesExisting;
  await ImportBatch.create({
    batchId, fileName, totalRows: prepared.totalRows, imported,
    duplicatesInFile: prepared.duplicatesInFile, duplicatesExisting, duplicates,
    invalid: prepared.invalid, incomplete, ignoredColumns: prepared.ignoredColumns,
  });

  issues.sort((a, b) => a.row - b.row);
  const importedByPriority = { high: 0, medium: 0, low: 0 };
  toInsert.forEach(({ lead }) => { if (insertedKeys.has(lead.dedupeKey)) importedByPriority[lead.priority] += 1; });

  return {
    batchId, fileName,
    totalRows: prepared.totalRows,
    imported,
    duplicates: { total: duplicates, inFile: prepared.duplicatesInFile, existing: duplicatesExisting },
    invalid: prepared.invalid,
    incomplete,
    importedByPriority,
    ignoredColumns: prepared.ignoredColumns,
    issues: issues.slice(0, ISSUE_CAP),
    issuesTruncated: issues.length > ISSUE_CAP,
  };
}

module.exports = { prepareImport, importLeads };

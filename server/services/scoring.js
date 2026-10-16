'use strict';
const { parseCompanySize, parseRevenue, representativeValue, isValidEmail } = require('../utils/normalize');

/**
 * Rule-based, explainable scoring. This is NOT a machine-learning model.
 * The bands below are illustrative defaults and should be tuned to a real ideal customer profile.
 * Final score = round(100 * pointsEarned / pointsAvailable), where only applicable criteria count.
 */
const DEFAULT_RULES = {
  maxPoints: { completeness: 30, size: 25, industry: 25, revenue: 20 },
  sizeBands: [
    { upTo: 10, points: 10 },
    { upTo: 50, points: 20 },
    { upTo: 500, points: 25 },
    { upTo: 5000, points: 15 },
    { upTo: Infinity, points: 8 },
  ],
  revenueBands: [
    { upTo: 250000, points: 5 },
    { upTo: 1000000, points: 10 },
    { upTo: 5000000, points: 16 },
    { upTo: 100000000, points: 20 },
    { upTo: Infinity, points: 14 },
  ],
  minSignalsForFinalScore: 2, // of: company size, revenue, industry
};

const round1 = (n) => Math.round(n * 10) / 10;

function priorityFor(score, { highThreshold, mediumThreshold }) {
  if (score >= highThreshold) return 'high';
  if (score >= mediumThreshold) return 'medium';
  return 'low';
}

function pickBand(bands, value) {
  return bands.find((band) => value <= band.upTo);
}

function formatNumber(n) {
  if (n >= 1e9) return `${round1(n / 1e9)}B`;
  if (n >= 1e6) return `${round1(n / 1e6)}M`;
  if (n >= 1e3) return `${round1(n / 1e3)}K`;
  return String(Math.round(n));
}

/**
 * @param lead   fields: normalizedDomain, industry, location, companySize, revenueRange, contactName, contactEmail
 * @param options { highThreshold, mediumThreshold, targetIndustries[] }
 * @returns { score, priority, provisional, breakdown[] }
 */
function scoreLead(lead, options, rules = DEFAULT_RULES) {
  const breakdown = [];
  const targets = (options.targetIndustries || []).map((t) => t.toLowerCase());

  // 1. Data completeness
  const completenessFields = [
    ['website', Boolean(lead.normalizedDomain)],
    ['industry', Boolean(lead.industry)],
    ['location', Boolean(lead.location)],
    ['company size', Boolean(lead.companySize)],
    ['revenue', Boolean(lead.revenueRange)],
    ['contact name', Boolean(lead.contactName)],
    ['contact email', Boolean(lead.contactEmail) && isValidEmail(lead.contactEmail)],
  ];
  const present = completenessFields.filter(([, ok]) => ok);
  const missing = completenessFields.filter(([, ok]) => !ok).map(([name]) => name);
  breakdown.push({
    criterion: 'completeness',
    label: 'Data completeness',
    points: round1((rules.maxPoints.completeness * present.length) / completenessFields.length),
    max: rules.maxPoints.completeness,
    detail: `${present.length} of ${completenessFields.length} fields present${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`,
  });

  // 2. Company size
  const sizeRange = parseCompanySize(lead.companySize);
  const sizeValue = representativeValue(sizeRange);
  if (sizeValue !== null) {
    const band = pickBand(rules.sizeBands, sizeValue);
    breakdown.push({
      criterion: 'size', label: 'Company size', points: band.points, max: rules.maxPoints.size,
      detail: `About ${formatNumber(sizeValue)} employees ("${lead.companySize}")`,
    });
  } else {
    breakdown.push({
      criterion: 'size', label: 'Company size', points: 0, max: rules.maxPoints.size,
      detail: lead.companySize ? `Size "${lead.companySize}" could not be interpreted` : 'No company size provided',
    });
  }

  // 3. Industry relevance (only when target industries are configured)
  const industryText = (lead.industry || '').toLowerCase();
  if (targets.length > 0) {
    const matched = industryText && targets.find((t) => industryText.includes(t) || t.includes(industryText));
    breakdown.push({
      criterion: 'industry', label: 'Industry relevance',
      points: matched ? rules.maxPoints.industry : 0, max: rules.maxPoints.industry,
      detail: !industryText ? 'No industry provided'
        : matched ? `"${lead.industry}" matches target "${matched}"` : `"${lead.industry}" is not in the target industries`,
    });
  } else {
    breakdown.push({
      criterion: 'industry', label: 'Industry relevance', points: null, max: null,
      detail: 'Not scored: no target industries configured',
    });
  }

  // 4. Revenue
  const revenueRange = parseRevenue(lead.revenueRange);
  const revenueValue = representativeValue(revenueRange);
  if (revenueValue !== null) {
    const band = pickBand(rules.revenueBands, revenueValue);
    breakdown.push({
      criterion: 'revenue', label: 'Revenue', points: band.points, max: rules.maxPoints.revenue,
      detail: `About $${formatNumber(revenueValue)} ("${lead.revenueRange}")`,
    });
  } else {
    breakdown.push({
      criterion: 'revenue', label: 'Revenue', points: 0, max: rules.maxPoints.revenue,
      detail: lead.revenueRange ? `Revenue "${lead.revenueRange}" could not be interpreted` : 'No revenue provided',
    });
  }

  const scored = breakdown.filter((b) => b.max !== null);
  const earned = scored.reduce((sum, b) => sum + b.points, 0);
  const available = scored.reduce((sum, b) => sum + b.max, 0);
  const score = Math.min(100, Math.max(0, Math.round((100 * earned) / available)));

  const signals = [sizeValue !== null, revenueValue !== null, Boolean(industryText)].filter(Boolean).length;
  const provisional = signals < rules.minSignalsForFinalScore;
  if (provisional) {
    breakdown.push({
      criterion: 'provisional', label: 'Confidence', points: null, max: null,
      detail: `Provisional: only ${signals} of 3 scoring signals (size, revenue, industry) available`,
    });
  }

  return { score, priority: priorityFor(score, options), provisional, breakdown };
}

function explain(breakdown) {
  return breakdown
    .map((b) => (b.max === null ? `${b.label}: ${b.detail}` : `${b.label}: ${b.points}/${b.max} - ${b.detail}`))
    .join(' | ');
}

module.exports = { scoreLead, priorityFor, explain, DEFAULT_RULES };

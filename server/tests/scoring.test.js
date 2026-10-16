import { describe, it, expect } from 'vitest';
import { scoreLead, priorityFor, explain } from '../services/scoring';

const OPTS = { highThreshold: 70, mediumThreshold: 40, targetIndustries: [] };
const FULL = {
  normalizedDomain: 'a.example', industry: 'Software', location: 'NY', companySize: '51-200',
  revenueRange: '$5M-$10M', contactName: 'A B', contactEmail: 'a@a.example',
};

describe('priorityFor (configurable thresholds)', () => {
  it('uses inclusive lower bounds', () => {
    expect(priorityFor(100, OPTS)).toBe('high');
    expect(priorityFor(70, OPTS)).toBe('high');
    expect(priorityFor(69, OPTS)).toBe('medium');
    expect(priorityFor(40, OPTS)).toBe('medium');
    expect(priorityFor(39, OPTS)).toBe('low');
    expect(priorityFor(0, OPTS)).toBe('low');
  });
  it('honours custom thresholds', () => {
    const custom = { highThreshold: 90, mediumThreshold: 60 };
    expect(priorityFor(89, custom)).toBe('medium');
    expect(priorityFor(90, custom)).toBe('high');
    expect(priorityFor(59, custom)).toBe('low');
  });
});

describe('scoreLead', () => {
  it('scores a complete lead at 100 and explains every criterion', () => {
    const r = scoreLead(FULL, OPTS);
    expect(r.score).toBe(100);
    expect(r.priority).toBe('high');
    expect(r.provisional).toBe(false);
    expect(r.breakdown.map((b) => b.criterion)).toEqual(['completeness', 'size', 'industry', 'revenue']);
    expect(explain(r.breakdown)).toContain('Data completeness: 30/30');
  });

  it('scores an empty lead at 0, low and provisional, without inventing data', () => {
    const r = scoreLead({}, OPTS);
    expect(r.score).toBe(0);
    expect(r.priority).toBe('low');
    expect(r.provisional).toBe(true);
    expect(r.breakdown.find((b) => b.criterion === 'provisional').detail).toMatch(/only 0 of 3/);
  });

  it('always stays within 0..100 across many combinations', () => {
    const sizes = [undefined, '', '1', '10', '51-200', '1,000+', 'junk', '999999'];
    const revenues = [undefined, '', '$1', '$5M', '$100M+', '$999B', 'junk'];
    const industries = [undefined, 'Software', 'Retail'];
    for (const companySize of sizes) for (const revenueRange of revenues) for (const industry of industries) {
      for (const targetIndustries of [[], ['software']]) {
        const r = scoreLead({ ...FULL, companySize, revenueRange, industry }, { ...OPTS, targetIndustries });
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
        expect(Number.isInteger(r.score)).toBe(true);
      }
    }
  });

  it('skips industry scoring when no target industries are configured', () => {
    const industry = scoreLead(FULL, OPTS).breakdown.find((b) => b.criterion === 'industry');
    expect(industry.points).toBeNull();
    expect(industry.max).toBeNull();
  });

  it('scores industry relevance when targets are configured', () => {
    const opts = { ...OPTS, targetIndustries: ['software'] };
    const hit = scoreLead({ ...FULL, industry: 'Software Development' }, opts);
    const miss = scoreLead({ ...FULL, industry: 'Retail' }, opts);
    expect(hit.breakdown.find((b) => b.criterion === 'industry').points).toBe(25);
    expect(miss.breakdown.find((b) => b.criterion === 'industry').points).toBe(0);
    expect(hit.score).toBeGreaterThan(miss.score);
  });

  it('flags unparseable size and revenue instead of guessing', () => {
    const r = scoreLead({ ...FULL, companySize: 'about fifty', revenueRange: '€3M' }, OPTS);
    expect(r.breakdown.find((b) => b.criterion === 'size').detail).toMatch(/could not be interpreted/);
    expect(r.breakdown.find((b) => b.criterion === 'revenue').detail).toMatch(/could not be interpreted/);
    expect(r.provisional).toBe(true);
  });

  it('marks a lead with exactly two scoring signals as final, one as provisional', () => {
    expect(scoreLead({ companySize: '51-200', revenueRange: '$5M' }, OPTS).provisional).toBe(false);
    expect(scoreLead({ companySize: '51-200' }, OPTS).provisional).toBe(true);
  });

  it('breakdown points add up to the reported score', () => {
    const r = scoreLead({ ...FULL, companySize: '11-50', revenueRange: '$1M-$5M' }, OPTS);
    const scored = r.breakdown.filter((b) => b.max !== null);
    const earned = scored.reduce((s, b) => s + b.points, 0);
    const available = scored.reduce((s, b) => s + b.max, 0);
    expect(r.score).toBe(Math.round((100 * earned) / available));
  });
});

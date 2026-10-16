import { describe, it, expect } from 'vitest';
import {
  normalizeCompanyName, normalizeDomain, parseCompanySize, parseRevenue, isValidEmail,
} from '../utils/normalize';

describe('normalizeCompanyName', () => {
  it.each([
    ['Acme, Inc.', 'acme'],
    ['ACME Incorporated', 'acme'],
    ['A.B.C. Inc', 'abc'],
    ['Smith & Sons LLC', 'smith and sons'],
    ['Café Münch GmbH', 'cafe munch'],
    ["Joe's Pizza", 'joes pizza'],
    ['  Multiple   Spaces  Ltd ', 'multiple spaces'],
  ])('%s -> %s', (input, expected) => expect(normalizeCompanyName(input)).toBe(expected));

  it('never reduces a name to an empty string', () => {
    expect(normalizeCompanyName('Inc')).toBe('inc');
    expect(normalizeCompanyName('Company Inc')).toBe('company');
    expect(normalizeCompanyName('株式会社テスト')).toBe('株式会社テスト');
  });
});

describe('normalizeDomain', () => {
  it.each([
    ['https://www.Acme.com/about?x=1', 'acme.com'],
    ['acme.com', 'acme.com'],
    ['http://acme.co.uk:8080/', 'acme.co.uk'],
    ['WWW.ACME.COM.', 'acme.com'],
    ['https://münchen.de', 'xn--mnchen-3ya.de'],
  ])('%s -> %s', (input, expected) => expect(normalizeDomain(input)).toBe(expected));

  it.each(['', '   ', 'not a domain', 'info@acme.com', 'localhost', '192.168.1.1', undefined, null])(
    'rejects %j', (input) => expect(normalizeDomain(input)).toBeNull(),
  );
});

describe('parseCompanySize', () => {
  it.each([
    ['51-200', { min: 51, max: 200 }],
    ['11 - 50 employees', { min: 11, max: 50 }],
    ['500', { min: 500, max: 500 }],
    ['1,000+', { min: 1000, max: null }],
    ['10000+', { min: 10000, max: null }],
    ['<10', { min: 0, max: 10 }],
    ['2k-5k', { min: 2000, max: 5000 }],
  ])('%s', (input, expected) => expect(parseCompanySize(input)).toEqual(expected));

  it.each(['about fifty', 'lots', '', '200-50', '1-2-3', undefined])('returns null for %j', (input) => {
    expect(parseCompanySize(input)).toBeNull();
  });
});

describe('parseRevenue', () => {
  it.each([
    ['$1M-$5M', { min: 1e6, max: 5e6 }],
    ['$10M - $50M', { min: 1e7, max: 5e7 }],
    ['1-5M', { min: 1e6, max: 5e6 }],
    ['$1.5 million', { min: 1.5e6, max: 1.5e6 }],
    ['5M+', { min: 5e6, max: null }],
    ['$100M+', { min: 1e8, max: null }],
    ['500k', { min: 5e5, max: 5e5 }],
    ['1,000,000', { min: 1e6, max: 1e6 }],
    ['Under $1M', { min: 0, max: 1e6 }],
    ['$1M to $5M', { min: 1e6, max: 5e6 }],
  ])('%s', (input, expected) => expect(parseRevenue(input)).toEqual(expected));

  it.each(['€2M', '£500k', 'n/a', '', 'unknown', '$5M-$1M'])('returns null for %j', (input) => {
    expect(parseRevenue(input)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts and rejects the obvious cases', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });
});

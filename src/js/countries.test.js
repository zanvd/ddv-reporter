import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COUNTRIES, isValidCountryCode, normalizeCountryCode } from './countries.js';

test('COUNTRIES contains 27 EU member states + XI, each with a unique 2-letter code', () => {
  assert.equal(COUNTRIES.length, 28);
  const codes = COUNTRIES.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length, 'codes must be unique');
  for (const code of codes) {
    assert.match(code, /^[A-Z]{2}$/);
  }
});

test('COUNTRIES includes Slovenia (SI) and Northern Ireland (XI)', () => {
  const codes = COUNTRIES.map((c) => c.code);
  assert.ok(codes.includes('SI'));
  assert.ok(codes.includes('XI'));
});

test('normalizeCountryCode trims and uppercases', () => {
  assert.equal(normalizeCountryCode(' de '), 'DE');
  assert.equal(normalizeCountryCode('si'), 'SI');
  assert.equal(normalizeCountryCode('XI'), 'XI');
});

test('normalizeCountryCode returns empty string for non-string/empty input', () => {
  assert.equal(normalizeCountryCode(''), '');
  assert.equal(normalizeCountryCode(undefined), '');
  assert.equal(normalizeCountryCode(null), '');
});

test('isValidCountryCode accepts EU member states + SI + XI, case-insensitively', () => {
  assert.ok(isValidCountryCode('SI'));
  assert.ok(isValidCountryCode('si'));
  assert.ok(isValidCountryCode('DE'));
  assert.ok(isValidCountryCode(' xi '));
});

test('isValidCountryCode accepts both GR and EL for Greece', () => {
  assert.ok(isValidCountryCode('GR'));
  assert.ok(isValidCountryCode('EL'));
  assert.ok(isValidCountryCode('el'));
});

test('isValidCountryCode rejects unknown or malformed codes', () => {
  assert.equal(isValidCountryCode('US'), false);
  assert.equal(isValidCountryCode('CH'), false);
  assert.equal(isValidCountryCode('XX'), false);
  assert.equal(isValidCountryCode(''), false);
  assert.equal(isValidCountryCode('SLO'), false);
});

test('COUNTRIES (the dropdown source) offers Greece as GR only; EL is accepted by validation but never a distinct dropdown entry', () => {
  const codes = COUNTRIES.map((c) => c.code);
  assert.ok(codes.includes('GR'));
  assert.ok(!codes.includes('EL'));
  assert.ok(isValidCountryCode('EL'));
});

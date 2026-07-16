import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveFlags, derivePeriod } from './derive.js';

test('derivePeriod: monthly June 2026', () => {
  const result = derivePeriod({ periodType: 'monthly', periodUnit: 6, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-06-01',
    OBDOBJE_DO: '2026-06-30',
    OBDOBJE: '0606',
  });
});

test('derivePeriod: monthly January (single-digit month zero-padded)', () => {
  const result = derivePeriod({ periodType: 'monthly', periodUnit: 1, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-01-01',
    OBDOBJE_DO: '2026-01-31',
    OBDOBJE: '0101',
  });
});

test('derivePeriod: monthly February in a leap year ends on the 29th', () => {
  const result = derivePeriod({ periodType: 'monthly', periodUnit: 2, periodYear: 2024 });
  assert.equal(result.OBDOBJE_DO, '2024-02-29');
});

test('derivePeriod: monthly February in a non-leap year ends on the 28th', () => {
  const result = derivePeriod({ periodType: 'monthly', periodUnit: 2, periodYear: 2026 });
  assert.equal(result.OBDOBJE_DO, '2026-02-28');
});

test('derivePeriod: quarterly Q1 spans January-March', () => {
  const result = derivePeriod({ periodType: 'quarterly', periodUnit: 1, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-01-01',
    OBDOBJE_DO: '2026-03-31',
    OBDOBJE: '0103',
  });
});

test('derivePeriod: quarterly Q2 spans April-June', () => {
  const result = derivePeriod({ periodType: 'quarterly', periodUnit: 2, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-04-01',
    OBDOBJE_DO: '2026-06-30',
    OBDOBJE: '0406',
  });
});

test('derivePeriod: quarterly Q3 spans July-September', () => {
  const result = derivePeriod({ periodType: 'quarterly', periodUnit: 3, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-07-01',
    OBDOBJE_DO: '2026-09-30',
    OBDOBJE: '0709',
  });
});

test('derivePeriod: quarterly Q4 spans October-December', () => {
  const result = derivePeriod({ periodType: 'quarterly', periodUnit: 4, periodYear: 2026 });
  assert.deepEqual(result, {
    OBDOBJE_OD: '2026-10-01',
    OBDOBJE_DO: '2026-12-31',
    OBDOBJE: '1012',
  });
});

test('derivePeriod: quarterly Q1 leap-year February end-of-quarter is unaffected but internal Feb is leap-correct', () => {
  // Q1 2024 ends March 31 regardless of leap year; this just re-confirms no off-by-one creeps in.
  const result = derivePeriod({ periodType: 'quarterly', periodUnit: 1, periodYear: 2024 });
  assert.equal(result.OBDOBJE_DO, '2024-03-31');
});

test('derivePeriod: rejects unknown periodType', () => {
  assert.throws(() => derivePeriod({ periodType: 'yearly', periodUnit: 1, periodYear: 2026 }));
});

test('derivePeriod: rejects out-of-range monthly periodUnit', () => {
  assert.throws(() => derivePeriod({ periodType: 'monthly', periodUnit: 0, periodYear: 2026 }));
  assert.throws(() => derivePeriod({ periodType: 'monthly', periodUnit: 13, periodYear: 2026 }));
});

test('derivePeriod: rejects out-of-range quarterly periodUnit', () => {
  assert.throws(() => derivePeriod({ periodType: 'quarterly', periodUnit: 0, periodYear: 2026 }));
  assert.throws(() => derivePeriod({ periodType: 'quarterly', periodUnit: 5, periodYear: 2026 }));
});

test('derivePeriod: rejects non-integer periodYear', () => {
  assert.throws(() => derivePeriod({ periodType: 'monthly', periodUnit: 1, periodYear: 2026.5 }));
});

test('deriveFlags: both false when both lists are empty', () => {
  assert.deepEqual(deriveFlags([], []), { KIR: false, KPR: false });
});

test('deriveFlags: KIR true when only kirEntries has items', () => {
  assert.deepEqual(deriveFlags([{}], []), { KIR: true, KPR: false });
});

test('deriveFlags: KPR true when only kprEntries has items', () => {
  assert.deepEqual(deriveFlags([], [{}]), { KIR: false, KPR: true });
});

test('deriveFlags: both true when both lists have items', () => {
  assert.deepEqual(deriveFlags([{}, {}], [{}]), { KIR: true, KPR: true });
});

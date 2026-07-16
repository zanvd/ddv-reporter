import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  hasAnyErrors,
  validateAmount,
  validateCountryCode,
  validateDateNotFuture,
  validateGeneral,
  validateKirEntry,
  validateKprEntry,
  validatePeriodType,
  validatePeriodUnit,
  validatePeriodYear,
  validateRequiredText,
  validateState,
  validateTaxPayerID,
  validateVatId,
} from './validate.js';

function tomorrowISODate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- validateTaxPayerID -----------------------------------------------------

test('validateTaxPayerID accepts exactly 8 digits', () => {
  assert.equal(validateTaxPayerID('12345678'), null);
});

test('validateTaxPayerID rejects blank, wrong length, non-digits, or SI prefix', () => {
  assert.ok(validateTaxPayerID(''));
  assert.ok(validateTaxPayerID('1234567'));
  assert.ok(validateTaxPayerID('123456789'));
  assert.ok(validateTaxPayerID('1234567a'));
  assert.ok(validateTaxPayerID('SI12345678'));
});

// --- validatePeriodType / validatePeriodUnit / validatePeriodYear ----------

test('validatePeriodType accepts monthly and quarterly only', () => {
  assert.equal(validatePeriodType('monthly'), null);
  assert.equal(validatePeriodType('quarterly'), null);
  assert.ok(validatePeriodType(''));
  assert.ok(validatePeriodType('yearly'));
});

test('validatePeriodUnit accepts 1-12 for monthly and 1-4 for quarterly', () => {
  assert.equal(validatePeriodUnit('monthly', 1), null);
  assert.equal(validatePeriodUnit('monthly', 12), null);
  assert.equal(validatePeriodUnit('quarterly', 1), null);
  assert.equal(validatePeriodUnit('quarterly', 4), null);
});

test('validatePeriodUnit rejects out-of-range, non-integer, blank, or an invalid period type', () => {
  assert.ok(validatePeriodUnit('monthly', 0));
  assert.ok(validatePeriodUnit('monthly', 13));
  assert.ok(validatePeriodUnit('quarterly', 0));
  assert.ok(validatePeriodUnit('quarterly', 5));
  assert.ok(validatePeriodUnit('monthly', 1.5));
  assert.ok(validatePeriodUnit('monthly', ''));
  assert.ok(validatePeriodUnit('yearly', 1));
});

test('validatePeriodYear accepts a 4-digit year and rejects other shapes', () => {
  assert.equal(validatePeriodYear('2026'), null);
  assert.ok(validatePeriodYear(''));
  assert.ok(validatePeriodYear('26'));
  assert.ok(validatePeriodYear('20266'));
  assert.ok(validatePeriodYear('abcd'));
});

// --- validateDateNotFuture ---------------------------------------------------

test('validateDateNotFuture accepts a valid past/today date', () => {
  assert.equal(validateDateNotFuture('2020-01-01'), null);
});

test('validateDateNotFuture rejects blank, malformed shape, or non-calendar dates', () => {
  assert.ok(validateDateNotFuture(''));
  assert.ok(validateDateNotFuture('2026-1-1'));
  assert.ok(validateDateNotFuture('01-01-2026'));
  assert.ok(validateDateNotFuture('2024-02-30'));
  assert.ok(validateDateNotFuture('2026-13-01'));
});

test('validateDateNotFuture rejects a future date', () => {
  assert.ok(validateDateNotFuture(tomorrowISODate()));
});

// --- validateAmount -----------------------------------------------------------

test('validateAmount treats a blank value as valid (optional field, omitted)', () => {
  assert.equal(validateAmount(''), null);
  assert.equal(validateAmount(undefined), null);
  assert.equal(validateAmount(null), null);
});

test('validateAmount accepts integers, up to 2 decimals, and negatives', () => {
  assert.equal(validateAmount('0'), null);
  assert.equal(validateAmount('100'), null);
  assert.equal(validateAmount('19.9'), null);
  assert.equal(validateAmount('19.99'), null);
  assert.equal(validateAmount('-19.99'), null);
});

test('validateAmount rejects more than 2 decimal places or non-numeric input', () => {
  assert.ok(validateAmount('19.999'));
  assert.ok(validateAmount('abc'));
  assert.ok(validateAmount('19.'));
  assert.ok(validateAmount('19,99'));
});

test('validateAmount rejects values at or beyond the +/-5,000,000,000 boundary', () => {
  assert.equal(validateAmount('4999999999.99'), null);
  assert.equal(validateAmount('-4999999999.99'), null);
  assert.ok(validateAmount('5000000000'));
  assert.ok(validateAmount('-5000000000'));
});

// --- validateRequiredText ------------------------------------------------------

test('validateRequiredText accepts non-blank text within the max length', () => {
  assert.equal(validateRequiredText('Invoice #123'), null);
});

test('validateRequiredText rejects blank text and text over the max length', () => {
  assert.ok(validateRequiredText(''));
  assert.ok(validateRequiredText('   '));
  assert.ok(validateRequiredText('a'.repeat(251)));
  assert.equal(validateRequiredText('a'.repeat(250)), null);
});

// --- validateCountryCode -------------------------------------------------------

test('validateCountryCode accepts a recognized code including GR and EL', () => {
  assert.equal(validateCountryCode('SI'), null);
  assert.equal(validateCountryCode('GR'), null);
  assert.equal(validateCountryCode('EL'), null);
});

test('validateCountryCode required=true rejects blank; required=false allows blank', () => {
  assert.ok(validateCountryCode(''));
  assert.equal(validateCountryCode('', { required: false }), null);
});

test('validateCountryCode rejects an unrecognized code', () => {
  assert.ok(validateCountryCode('US'));
});

// --- validateVatId ---------------------------------------------------------------

test('validateVatId accepts an ID without a country prefix', () => {
  assert.equal(validateVatId('12345678'), null);
});

test('validateVatId required=true rejects blank; required=false allows blank', () => {
  assert.ok(validateVatId(''));
  assert.equal(validateVatId('', { required: false }), null);
});

test('validateVatId rejects a leading 2-letter-then-digit country-code prefix', () => {
  assert.ok(validateVatId('SI12345678'));
  assert.ok(validateVatId('DE123456789'));
});

test('validateVatId does not false-positive on IDs with letters that are not a country-code-then-digit prefix', () => {
  assert.equal(validateVatId('ABCDEFGH'), null); // letters only, no digit right after the first two
  assert.equal(validateVatId('123SI45678'), null); // digits first; prefix pattern only matches at the start
});

test('validateVatId rejects an ID over 25 characters', () => {
  assert.ok(validateVatId('1'.repeat(26)));
  assert.equal(validateVatId('1'.repeat(25)), null);
});

// --- validateGeneral ---------------------------------------------------------------

test('validateGeneral returns no errors for a fully valid general section', () => {
  const general = {
    taxPayerID: '12345678',
    periodType: 'monthly',
    periodUnit: 6,
    periodYear: '2026',
    vracilo: false,
    odbdelez: false,
  };
  assert.deepEqual(validateGeneral(general), {});
});

test('validateGeneral flags each invalid field by name', () => {
  const general = {
    taxPayerID: 'bad',
    periodType: 'yearly',
    periodUnit: 99,
    periodYear: 'abcd',
  };
  const errors = validateGeneral(general);
  assert.ok(errors.taxPayerID);
  assert.ok(errors.periodType);
  assert.ok(errors.periodUnit);
  assert.ok(errors.periodYear);
});

// --- validateKirEntry ---------------------------------------------------------------

function validKirEntry(overrides = {}) {
  return {
    postingDate: '2026-06-15',
    documentNumber: 'INV-001',
    documentDate: '2026-06-15',
    customerCountry: '',
    customerVatId: '',
    netValue: '100.00',
    vat22: '22.00',
    vat95: '',
    vat5: '',
    ...overrides,
  };
}

test('validateKirEntry returns no errors for a valid entry with blank optionals', () => {
  assert.deepEqual(validateKirEntry(validKirEntry()), {});
});

test('validateKirEntry returns no errors when customerCountry/customerVatId are both provided', () => {
  const entry = validKirEntry({ customerCountry: 'DE', customerVatId: '123456789' });
  assert.deepEqual(validateKirEntry(entry), {});
});

test('validateKirEntry flags customerCountry/customerVatId when only one is provided', () => {
  const onlyCountry = validateKirEntry(validKirEntry({ customerCountry: 'DE' }));
  assert.ok(onlyCountry.customerCountry);
  assert.ok(onlyCountry.customerVatId);

  const onlyVatId = validateKirEntry(validKirEntry({ customerVatId: '123456789' }));
  assert.ok(onlyVatId.customerCountry);
  assert.ok(onlyVatId.customerVatId);
});

test('validateKirEntry flags missing required fields and invalid amounts', () => {
  const entry = validKirEntry({
    postingDate: '',
    documentNumber: '',
    documentDate: '',
    netValue: '19.999',
  });
  const errors = validateKirEntry(entry);
  assert.ok(errors.postingDate);
  assert.ok(errors.documentNumber);
  assert.ok(errors.documentDate);
  assert.ok(errors.netValue);
});

// --- validateKprEntry ---------------------------------------------------------------

function validKprEntry(overrides = {}) {
  return {
    postingDate: '2026-06-15',
    documentNumber: 'BILL-001',
    dateReceived: '2026-06-16',
    documentDate: '2026-06-10',
    supplierName: 'Acme d.o.o.',
    supplierCountry: 'SI',
    supplierVatId: '12345678',
    netValue: '50.00',
    deductVat22: '11.00',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '',
    ...overrides,
  };
}

test('validateKprEntry returns no errors for a valid entry with blank optionals', () => {
  assert.deepEqual(validateKprEntry(validKprEntry()), {});
});

test('validateKprEntry flags missing required supplier fields', () => {
  const entry = validKprEntry({ supplierName: '', supplierCountry: '', supplierVatId: '' });
  const errors = validateKprEntry(entry);
  assert.ok(errors.supplierName);
  assert.ok(errors.supplierCountry);
  assert.ok(errors.supplierVatId);
});

test('validateKprEntry flags a supplierVatId with a country-code prefix', () => {
  const errors = validateKprEntry(validKprEntry({ supplierVatId: 'SI12345678' }));
  assert.ok(errors.supplierVatId);
});

// --- validateState / hasAnyErrors ---------------------------------------------------

test('validateState aggregates general section + every KIR/KPR entry; hasAnyErrors is false when clean', () => {
  const state = {
    general: {
      taxPayerID: '12345678',
      periodType: 'monthly',
      periodUnit: 6,
      periodYear: '2026',
      vracilo: false,
      odbdelez: false,
    },
    kir: [validKirEntry()],
    kpr: [validKprEntry()],
  };
  const result = validateState(state);
  assert.deepEqual(result.general, {});
  assert.deepEqual(result.kir, [{}]);
  assert.deepEqual(result.kpr, [{}]);
  assert.equal(hasAnyErrors(result), false);
});

test('hasAnyErrors is true when the general section has an error', () => {
  const state = {
    general: { taxPayerID: '', periodType: 'monthly', periodUnit: 6, periodYear: '2026' },
    kir: [],
    kpr: [],
  };
  assert.equal(hasAnyErrors(validateState(state)), true);
});

test('hasAnyErrors is true when any KIR or KPR entry has an error', () => {
  const validGeneral = {
    taxPayerID: '12345678',
    periodType: 'monthly',
    periodUnit: 6,
    periodYear: '2026',
  };

  const withBadKir = validateState({
    general: validGeneral,
    kir: [validKirEntry({ documentNumber: '' })],
    kpr: [],
  });
  assert.equal(hasAnyErrors(withBadKir), true);

  const withBadKpr = validateState({
    general: validGeneral,
    kir: [],
    kpr: [validKprEntry({ supplierName: '' })],
  });
  assert.equal(hasAnyErrors(withBadKpr), true);
});

test('hasAnyErrors is false for an only-KIR filing (empty KPR list) with a valid general section and KIR entry', () => {
  const state = {
    general: {
      taxPayerID: '12345678',
      periodType: 'quarterly',
      periodUnit: 2,
      periodYear: '2026',
    },
    kir: [validKirEntry()],
    kpr: [],
  };
  assert.equal(hasAnyErrors(validateState(state)), false);
});

// End-to-end tests for the full pure pipeline: state.js (createState/
// addKirEntry/addKprEntry/removeKirEntry/updateGeneral) -> validate.js
// (validateState/hasAnyErrors) -> derive.js (derivePeriod) -> serialize.js
// (serialize). Each per-module unit test file already covers its own
// module's rules in isolation with hand-built fixtures; this file instead
// wires the real modules together the way main.js's Download gate does, to
// catch gaps at the seams (e.g. state.js's zapSt renumbering staying in
// sync with serialize.js's independently-recomputed ZAPST).

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { derivePeriod } from './derive.js';
import { serialize } from './serialize.js';
import {
  addKirEntry,
  addKprEntry,
  createState,
  removeKirEntry,
  updateGeneral,
  updateKirEntry,
  updateKprEntry,
} from './state.js';
import { hasAnyErrors, validateState } from './validate.js';

function validKirFields(overrides = {}) {
  return {
    postingDate: '2026-06-01',
    documentNumber: 'INV-1',
    documentDate: '2026-06-01',
    customerCountry: '',
    customerVatId: '',
    netValue: '',
    vat22: '',
    vat95: '',
    vat5: '',
    ...overrides,
  };
}

test('full pipeline: a completely empty form (fresh state, no entries) fails validateState via the general section', () => {
  const state = createState();

  const validation = validateState(state);

  assert.equal(hasAnyErrors(validation), true);
  assert.ok(validation.general.taxPayerID);
  assert.ok(validation.general.periodUnit);
  assert.ok(validation.general.periodYear);
  assert.deepEqual(validation.kir, []);
  assert.deepEqual(validation.kpr, []);
});

test('full pipeline: only-KIR filing (kpr empty) validates clean and serializes with Glava.KPR false and Lista_KPR.KPR empty', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKirEntry(state, validKirFields());

  assert.equal(hasAnyErrors(validateState(state)), false);

  const doc = JSON.parse(serialize(state));
  assert.equal(doc.DDV_KIR_KPR.Glava.KIR, true);
  assert.equal(doc.DDV_KIR_KPR.Glava.KPR, false);
  assert.equal(doc.DDV_KIR_KPR.Lista_KIR.KIR.length, 1);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KPR.KPR, []);
});

test('full pipeline: only-KPR filing (kir empty) validates clean and serializes with Glava.KIR false and Lista_KIR.KIR empty', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKprEntry(state, {
    postingDate: '2026-06-01',
    documentNumber: 'BILL-1',
    dateReceived: '2026-06-02',
    documentDate: '2026-05-30',
    supplierName: 'Acme d.o.o.',
    supplierCountry: 'SI',
    supplierVatId: '11111111',
    netValue: '',
    deductVat22: '',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '',
  });

  assert.equal(hasAnyErrors(validateState(state)), false);

  const doc = JSON.parse(serialize(state));
  assert.equal(doc.DDV_KIR_KPR.Glava.KPR, true);
  assert.equal(doc.DDV_KIR_KPR.Glava.KIR, false);
  assert.equal(doc.DDV_KIR_KPR.Lista_KPR.KPR.length, 1);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KIR.KIR, []);
});

test('full pipeline: a realistic filing with multiple KIR and multiple KPR entries validates clean and serializes to the expected shape', () => {
  const state = createState();
  updateGeneral(state, {
    taxPayerID: '87654321',
    periodType: 'quarterly',
    periodUnit: 2,
    periodYear: '2026',
    vracilo: true,
    odbdelez: true,
  });

  addKirEntry(state, validKirFields({
    postingDate: '2026-04-10',
    documentNumber: 'INV-1',
    documentDate: '2026-04-09',
    customerCountry: 'DE',
    customerVatId: '123456789',
    netValue: '1000.00',
    vat22: '220.00',
  }));
  addKirEntry(state, validKirFields({
    postingDate: '2026-05-15',
    documentNumber: 'INV-2',
    documentDate: '2026-05-14',
  }));

  addKprEntry(state, {
    postingDate: '2026-04-20',
    documentNumber: 'BILL-1',
    dateReceived: '2026-04-21',
    documentDate: '2026-04-18',
    supplierName: 'Acme d.o.o.',
    supplierCountry: 'SI',
    supplierVatId: '11111111',
    netValue: '500.00',
    deductVat22: '110.00',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '',
  });
  addKprEntry(state, {
    postingDate: '2026-06-01',
    documentNumber: 'BILL-2',
    dateReceived: '2026-06-02',
    documentDate: '2026-05-30',
    supplierName: 'Kmetija Novak',
    supplierCountry: 'SI',
    supplierVatId: '22222222',
    netValue: '',
    deductVat22: '',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '80.00',
  });

  assert.equal(hasAnyErrors(validateState(state)), false);

  const period = derivePeriod({
    periodType: state.general.periodType,
    periodUnit: Number(state.general.periodUnit),
    periodYear: Number(state.general.periodYear),
  });

  const doc = JSON.parse(serialize(state));
  const glava = doc.DDV_KIR_KPR.Glava;
  assert.equal(glava.TaxPayerID, '87654321');
  assert.equal(glava.OBDOBJE_OD, period.OBDOBJE_OD);
  assert.equal(glava.OBDOBJE_DO, period.OBDOBJE_DO);
  assert.equal(glava.OBDOBJE_OD, '2026-04-01');
  assert.equal(glava.OBDOBJE_DO, '2026-06-30');
  assert.equal(glava.KIR, true);
  assert.equal(glava.KPR, true);
  assert.equal(glava.VRACILO, true);
  assert.equal(glava.ODBDELEZ, true);

  const kir = doc.DDV_KIR_KPR.Lista_KIR.KIR;
  assert.deepEqual(kir.map((e) => e.ZAPST), [1, 2]);
  assert.deepEqual(kir.map((e) => e.OBDOBJE), ['0406', '0406']);
  assert.equal(kir[0].P6, 'DE');
  assert.ok(!('P6' in kir[1]));

  const kpr = doc.DDV_KIR_KPR.Lista_KPR.KPR;
  assert.deepEqual(kpr.map((e) => e.ZAPST), [1, 2]);
  assert.equal(kpr[0].P8, 500);
  assert.equal(kpr[1].P21, 80);
  assert.ok(!('P18' in kpr[1]));
});

test('full pipeline: removing a middle KIR entry renumbers zapSt in state and produces consecutive ZAPST in the serialized output', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });

  const idA = addKirEntry(state, validKirFields({ documentNumber: 'A' }));
  const idB = addKirEntry(state, validKirFields({ documentNumber: 'B' }));
  addKirEntry(state, validKirFields({ documentNumber: 'C' }));

  removeKirEntry(state, idB);
  assert.deepEqual(state.kir.map((e) => e.zapSt), [1, 2]);
  assert.equal(idA, state.kir[0].id);

  assert.equal(hasAnyErrors(validateState(state)), false);

  const kir = JSON.parse(serialize(state)).DDV_KIR_KPR.Lista_KIR.KIR;
  assert.deepEqual(kir.map((e) => e.ZAPST), [1, 2]);
  assert.deepEqual(kir.map((e) => e.P3), ['A', 'C']);
});

function tomorrowLocalISODate() {
  // Uses local date parts (not toISOString, which is UTC and can shift the
  // calendar day near local midnight) — same approach as validate.test.js's
  // tomorrowISODate() helper, kept independent per test file.
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('full pipeline: a future postingDate on a KIR entry fails validateState, blocking the pipeline before serialize', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });

  addKirEntry(state, validKirFields({ postingDate: tomorrowLocalISODate() }));

  const validation = validateState(state);
  assert.equal(hasAnyErrors(validation), true);
  assert.ok(validation.kir[0].postingDate);
});

test('full pipeline: monthly February 2024 (leap year) derives and serializes OBDOBJE_DO as 2024-02-29', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 2, periodYear: '2024' });
  addKirEntry(state, validKirFields({ postingDate: '2024-02-10', documentDate: '2024-02-09' }));

  assert.equal(hasAnyErrors(validateState(state)), false);

  const doc = JSON.parse(serialize(state));
  assert.equal(doc.DDV_KIR_KPR.Glava.OBDOBJE_DO, '2024-02-29');
  assert.equal(doc.DDV_KIR_KPR.Lista_KIR.KIR[0].OBDOBJE, '0202');
});

test('full pipeline: EL (Greece\'s alternate code) is accepted end-to-end and preserved as-is in P6, not rewritten to GR', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKirEntry(state, validKirFields({ customerCountry: 'el', customerVatId: '123456789' }));

  assert.equal(hasAnyErrors(validateState(state)), false);

  const doc = JSON.parse(serialize(state));
  assert.equal(doc.DDV_KIR_KPR.Lista_KIR.KIR[0].P6, 'EL');
});

test('full pipeline: blank optional amounts are omitted and an explicit "0" is preserved as 0, for entries added via state.js', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKirEntry(state, validKirFields({ netValue: '0' }));

  assert.equal(hasAnyErrors(validateState(state)), false);

  const entry = JSON.parse(serialize(state)).DDV_KIR_KPR.Lista_KIR.KIR[0];
  assert.equal(entry.P7, 0);
  assert.ok(!('P14' in entry));
  assert.ok(!('P15' in entry));
  assert.ok(!('P16' in entry));
});

// --- Partner-backed row equivalence (plan 0006 §5.6/§7, §9.4) ----------------
//
// Partner-backed rows introduce no new state shape or output path: on
// selecting a partner, view/entryList.js calls the exact same
// updateKirEntry/updateKprEntry a manually-typed field's input event would
// call, with a patch built from the partner's countryCode/vatId(/name) —
// KIR's config.partner.copyFrom maps to customerCountry/customerVatId; KPR's
// also maps supplierName. These tests reproduce that patch directly against
// state.js (no DOM/view layer involved) and assert the pipeline is
// byte-for-byte indifferent to whether a row's identity values arrived by
// typing or by a partner-copy patch.

function partnerBackedCustomer(partner) {
  return { customerCountry: partner.countryCode, customerVatId: partner.vatId };
}

function partnerBackedSupplier(partner) {
  return { supplierName: partner.name, supplierCountry: partner.countryCode, supplierVatId: partner.vatId };
}

test('partner-backed vs. typed KIR row: identical serialized output for the same identity values', () => {
  const partner = { id: 1, name: 'Acme d.o.o.', countryCode: 'DE', vatId: '123456789' };

  const typedState = createState();
  updateGeneral(typedState, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKirEntry(typedState, validKirFields({ customerCountry: partner.countryCode, customerVatId: partner.vatId }));

  // A fresh partner-backed row starts blank (config.addEntry(state, emptyFields)),
  // then selecting the partner applies copyFrom(partner) via updateKirEntry —
  // exactly like a normal field's change handler.
  const partnerBackedState = createState();
  updateGeneral(partnerBackedState, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  const entryId = addKirEntry(partnerBackedState, validKirFields());
  updateKirEntry(partnerBackedState, entryId, partnerBackedCustomer(partner));

  assert.equal(hasAnyErrors(validateState(typedState)), false);
  assert.equal(hasAnyErrors(validateState(partnerBackedState)), false);
  assert.equal(serialize(typedState), serialize(partnerBackedState));
});

test('partner-backed vs. typed KPR row: identical serialized output for the same identity values (name/country/vatId all copied)', () => {
  const partner = { id: 1, name: 'Acme d.o.o.', countryCode: 'SI', vatId: '12345678' };
  const sharedFields = {
    postingDate: '2026-06-15',
    documentNumber: 'BILL-001',
    dateReceived: '2026-06-16',
    documentDate: '2026-06-10',
    netValue: '50.00',
    deductVat22: '11.00',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '',
  };

  const typedState = createState();
  updateGeneral(typedState, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKprEntry(typedState, {
    ...sharedFields,
    supplierName: partner.name,
    supplierCountry: partner.countryCode,
    supplierVatId: partner.vatId,
  });

  const partnerBackedState = createState();
  updateGeneral(partnerBackedState, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  const entryId = addKprEntry(partnerBackedState, { ...sharedFields, supplierName: '', supplierCountry: '', supplierVatId: '' });
  updateKprEntry(partnerBackedState, entryId, partnerBackedSupplier(partner));

  assert.equal(hasAnyErrors(validateState(typedState)), false);
  assert.equal(hasAnyErrors(validateState(partnerBackedState)), false);
  assert.equal(serialize(typedState), serialize(partnerBackedState));
});

test('a partner-backed KIR row with no partner selected (blank customer identity) does not block the Download gate — a valid optional pair, same as a typed row left blank', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKirEntry(state, validKirFields()); // blank customerCountry/customerVatId, as a fresh partner-backed row starts

  assert.equal(hasAnyErrors(validateState(state)), false);
});

test('a partner-backed KPR row with no partner selected (blank supplier identity) blocks the Download gate, same as a typed row left blank', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', periodType: 'monthly', periodUnit: 6, periodYear: '2026' });
  addKprEntry(state, {
    postingDate: '2026-06-15',
    documentNumber: 'BILL-001',
    dateReceived: '2026-06-16',
    documentDate: '2026-06-10',
    supplierName: '',
    supplierCountry: '',
    supplierVatId: '',
    netValue: '50.00',
    deductVat22: '',
    deductVat95: '',
    deductVat5: '',
    flatRate8: '',
  }); // blank supplier identity, as a fresh partner-backed row starts

  const validation = validateState(state);
  assert.equal(hasAnyErrors(validation), true);
  assert.ok(validation.kpr[0].supplierName);
  assert.ok(validation.kpr[0].supplierCountry);
  assert.ok(validation.kpr[0].supplierVatId);
});

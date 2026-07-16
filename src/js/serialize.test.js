import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDocument, serialize } from './serialize.js';

// A fixture mixing two KIR entries (one fully populated, one with every
// optional field left blank) and one KPR entry (partially populated
// optionals) for a monthly June 2026 period.
const mixedFixture = {
  general: {
    taxPayerID: '12345678',
    periodType: 'monthly',
    periodUnit: 6,
    periodYear: '2026',
    vracilo: true,
    odbdelez: false,
  },
  kir: [
    {
      postingDate: '2026-06-05',
      documentNumber: 'INV-1001',
      documentDate: '2026-06-04',
      customerCountry: 'DE',
      customerVatId: '123456789',
      netValue: '1000.00',
      vat22: '220.00',
      vat95: '',
      vat5: '',
    },
    {
      postingDate: '2026-06-10',
      documentNumber: 'INV-1002',
      documentDate: '2026-06-09',
      customerCountry: '',
      customerVatId: '',
      netValue: '',
      vat22: '',
      vat95: '',
      vat5: '',
    },
  ],
  kpr: [
    {
      postingDate: '2026-06-12',
      documentNumber: 'BILL-500',
      dateReceived: '2026-06-13',
      documentDate: '2026-06-11',
      supplierName: 'Acme d.o.o.',
      supplierCountry: 'SI',
      supplierVatId: '87654321',
      netValue: '500.50',
      deductVat22: '110.11',
      deductVat95: '',
      deductVat5: '',
      flatRate8: '',
    },
  ],
};

const expectedMixedDocument = {
  DDV_KIR_KPR: {
    Glava: {
      TaxPayerID: '12345678',
      OBDOBJE_OD: '2026-06-01',
      OBDOBJE_DO: '2026-06-30',
      KIR: true,
      KPR: true,
      VRACILO: true,
      ODBDELEZ: false,
    },
    Lista_KIR: {
      KIR: [
        {
          ZAPST: 1,
          OBDOBJE: '0606',
          OBRAVNAVA: '1',
          P2: '2026-06-05',
          P3: 'INV-1001',
          P4: '2026-06-04',
          P6: 'DE',
          P6DS: '123456789',
          P7: 1000,
          P14: 220,
        },
        {
          ZAPST: 2,
          OBDOBJE: '0606',
          OBRAVNAVA: '1',
          P2: '2026-06-10',
          P3: 'INV-1002',
          P4: '2026-06-09',
        },
      ],
    },
    Lista_KPR: {
      KPR: [
        {
          ZAPST: 1,
          OBDOBJE: '0606',
          OBRAVNAVA: '1',
          P2: '2026-06-12',
          P3: 'BILL-500',
          P4: '2026-06-13',
          P5: '2026-06-11',
          P6: 'Acme d.o.o.',
          P7: 'SI',
          P7DS: '87654321',
          P8: 500.5,
          P18: 110.11,
        },
      ],
    },
  },
};

test('buildDocument: golden fixture mixing KIR + KPR with blank optionals matches hand-verified shape', () => {
  assert.deepEqual(buildDocument(mixedFixture), expectedMixedDocument);
});

test('serialize: golden fixture round-trips through JSON.stringify/parse to the same shape', () => {
  const json = serialize(mixedFixture);
  assert.deepEqual(JSON.parse(json), expectedMixedDocument);
});

test('serialize: output is pretty-printed (human-inspectable before submission)', () => {
  const json = serialize(mixedFixture);
  assert.ok(json.includes('\n'));
  assert.ok(json.startsWith('{\n'));
});

test('buildDocument: only-KIR filing leaves Lista_KPR.KPR empty and Glava.KPR false', () => {
  const onlyKir = { ...mixedFixture, kpr: [] };
  const doc = buildDocument(onlyKir);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KPR.KPR, []);
  assert.equal(doc.DDV_KIR_KPR.Glava.KPR, false);
  assert.equal(doc.DDV_KIR_KPR.Glava.KIR, true);
});

test('buildDocument: only-KPR filing leaves Lista_KIR.KIR empty and Glava.KIR false', () => {
  const onlyKpr = { ...mixedFixture, kir: [] };
  const doc = buildDocument(onlyKpr);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KIR.KIR, []);
  assert.equal(doc.DDV_KIR_KPR.Glava.KIR, false);
  assert.equal(doc.DDV_KIR_KPR.Glava.KPR, true);
});

test('buildDocument: both lists empty produce both flags false and both arrays empty', () => {
  const empty = { ...mixedFixture, kir: [], kpr: [] };
  const doc = buildDocument(empty);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KIR.KIR, []);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KPR.KPR, []);
  assert.equal(doc.DDV_KIR_KPR.Glava.KIR, false);
  assert.equal(doc.DDV_KIR_KPR.Glava.KPR, false);
});

test('buildDocument: an explicit "0" amount is kept as 0, not omitted like a blank value', () => {
  const state = {
    ...mixedFixture,
    kir: [{ ...mixedFixture.kir[0], netValue: '0', vat22: '0' }],
    kpr: [],
  };
  const entry = buildDocument(state).DDV_KIR_KPR.Lista_KIR.KIR[0];
  assert.equal(entry.P7, 0);
  assert.equal(entry.P14, 0);
});

test('buildDocument: OBRAVNAVA is always the string "1"', () => {
  const doc = buildDocument(mixedFixture);
  assert.equal(doc.DDV_KIR_KPR.Lista_KIR.KIR[0].OBRAVNAVA, '1');
  assert.equal(doc.DDV_KIR_KPR.Lista_KPR.KPR[0].OBRAVNAVA, '1');
});

test('buildDocument: ZAPST is consecutive starting at 1 within each list, independent of the other list', () => {
  const doc = buildDocument(mixedFixture);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KIR.KIR.map((e) => e.ZAPST), [1, 2]);
  assert.deepEqual(doc.DDV_KIR_KPR.Lista_KPR.KPR.map((e) => e.ZAPST), [1]);
});

test('buildDocument: quarterly period derives OBDOBJE_OD/DO/OBDOBJE for the general section and every entry', () => {
  const state = {
    general: { ...mixedFixture.general, periodType: 'quarterly', periodUnit: 2, periodYear: '2026' },
    kir: [mixedFixture.kir[0]],
    kpr: [],
  };
  const doc = buildDocument(state);
  assert.equal(doc.DDV_KIR_KPR.Glava.OBDOBJE_OD, '2026-04-01');
  assert.equal(doc.DDV_KIR_KPR.Glava.OBDOBJE_DO, '2026-06-30');
  assert.equal(doc.DDV_KIR_KPR.Lista_KIR.KIR[0].OBDOBJE, '0406');
});

test('buildDocument: general-section booleans serialize as native JSON true/false', () => {
  const doc = buildDocument(mixedFixture);
  const json = JSON.stringify(doc);
  assert.ok(json.includes('"VRACILO":true'));
  assert.ok(json.includes('"ODBDELEZ":false'));
  assert.ok(json.includes('"KIR":true'));
  assert.ok(json.includes('"KPR":true'));
});

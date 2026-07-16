import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addKirEntry,
  addKprEntry,
  createState,
  removeKirEntry,
  removeKprEntry,
  updateGeneral,
  updateKirEntry,
  updateKprEntry,
} from './state.js';

test('createState returns empty lists and general-section defaults', () => {
  const state = createState();
  assert.deepEqual(state.kir, []);
  assert.deepEqual(state.kpr, []);
  assert.deepEqual(state.general, {
    taxPayerID: '',
    periodType: 'monthly',
    periodUnit: '',
    periodYear: '',
    vracilo: false,
    odbdelez: false,
  });
});

test('updateGeneral merges given fields without touching untouched ones', () => {
  const state = createState();
  updateGeneral(state, { taxPayerID: '12345678', vracilo: true });
  assert.equal(state.general.taxPayerID, '12345678');
  assert.equal(state.general.vracilo, true);
  assert.equal(state.general.periodType, 'monthly');
});

// --- KIR entries -------------------------------------------------------------

test('addKirEntry appends the entry, assigns an id, and returns that id', () => {
  const state = createState();
  const id = addKirEntry(state, { postingDate: '2026-06-01' });
  assert.equal(state.kir.length, 1);
  assert.equal(state.kir[0].id, id);
  assert.equal(state.kir[0].postingDate, '2026-06-01');
  assert.ok(id);
});

test('addKirEntry assigns consecutive zapSt starting at 1', () => {
  const state = createState();
  addKirEntry(state, { documentNumber: 'A' });
  addKirEntry(state, { documentNumber: 'B' });
  addKirEntry(state, { documentNumber: 'C' });
  assert.deepEqual(state.kir.map((e) => e.zapSt), [1, 2, 3]);
});

test('addKirEntry assigns unique ids to each entry', () => {
  const state = createState();
  const idA = addKirEntry(state, { documentNumber: 'A' });
  const idB = addKirEntry(state, { documentNumber: 'B' });
  assert.notEqual(idA, idB);
});

test('updateKirEntry merges a patch into the entry matching id, leaving others untouched', () => {
  const state = createState();
  const idA = addKirEntry(state, { documentNumber: 'A', netValue: '100' });
  const idB = addKirEntry(state, { documentNumber: 'B' });
  updateKirEntry(state, idA, { netValue: '200' });
  assert.equal(state.kir.find((e) => e.id === idA).netValue, '200');
  assert.equal(state.kir.find((e) => e.id === idA).documentNumber, 'A');
  assert.equal(state.kir.find((e) => e.id === idB).documentNumber, 'B');
});

test('updateKirEntry throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => updateKirEntry(state, 'missing-id', { documentNumber: 'X' }));
});

test('removeKirEntry removes the matching entry and renumbers the rest consecutively', () => {
  const state = createState();
  const idA = addKirEntry(state, { documentNumber: 'A' });
  const idB = addKirEntry(state, { documentNumber: 'B' });
  const idC = addKirEntry(state, { documentNumber: 'C' });

  removeKirEntry(state, idB);

  assert.equal(state.kir.length, 2);
  assert.deepEqual(state.kir.map((e) => e.id), [idA, idC]);
  assert.deepEqual(state.kir.map((e) => e.zapSt), [1, 2]);
});

test('removeKirEntry throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => removeKirEntry(state, 'missing-id'));
});

// --- KPR entries -------------------------------------------------------------

test('addKprEntry appends the entry, assigns an id, and returns that id', () => {
  const state = createState();
  const id = addKprEntry(state, { supplierName: 'Acme' });
  assert.equal(state.kpr.length, 1);
  assert.equal(state.kpr[0].id, id);
  assert.equal(state.kpr[0].supplierName, 'Acme');
});

test('addKprEntry assigns consecutive zapSt starting at 1', () => {
  const state = createState();
  addKprEntry(state, { supplierName: 'A' });
  addKprEntry(state, { supplierName: 'B' });
  assert.deepEqual(state.kpr.map((e) => e.zapSt), [1, 2]);
});

test('updateKprEntry merges a patch into the entry matching id', () => {
  const state = createState();
  const id = addKprEntry(state, { supplierName: 'Acme', netValue: '50' });
  updateKprEntry(state, id, { netValue: '75' });
  assert.equal(state.kpr[0].netValue, '75');
  assert.equal(state.kpr[0].supplierName, 'Acme');
});

test('updateKprEntry throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => updateKprEntry(state, 'missing-id', { supplierName: 'X' }));
});

test('removeKprEntry removes the matching entry and renumbers the rest consecutively', () => {
  const state = createState();
  const idA = addKprEntry(state, { supplierName: 'A' });
  const idB = addKprEntry(state, { supplierName: 'B' });
  const idC = addKprEntry(state, { supplierName: 'C' });

  removeKprEntry(state, idA);

  assert.equal(state.kpr.length, 2);
  assert.deepEqual(state.kpr.map((e) => e.id), [idB, idC]);
  assert.deepEqual(state.kpr.map((e) => e.zapSt), [1, 2]);
});

test('removeKprEntry throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => removeKprEntry(state, 'missing-id'));
});

// --- Independence between the two lists ---------------------------------------

test('KIR and KPR lists are independent: mutating one does not affect the other', () => {
  const state = createState();
  const kirId = addKirEntry(state, { documentNumber: 'KIR-1' });
  addKprEntry(state, { supplierName: 'KPR-1' });
  addKprEntry(state, { supplierName: 'KPR-2' });

  removeKirEntry(state, kirId);

  assert.equal(state.kir.length, 0);
  assert.equal(state.kpr.length, 2);
  assert.deepEqual(state.kpr.map((e) => e.zapSt), [1, 2]);
});

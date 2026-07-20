import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  addKirEntry,
  addKprEntry,
  addPartner,
  createState,
  removeKirEntry,
  removeKprEntry,
  removePartner,
  seedPartners,
  updateGeneral,
  updateKirEntry,
  updateKprEntry,
  updatePartner,
} from './state.js';

test('createState returns empty lists and general-section defaults', () => {
  const state = createState();
  assert.deepEqual(state.kir, []);
  assert.deepEqual(state.kpr, []);
  assert.deepEqual(state.partners, []);
  assert.equal(state.nextPartnerId, 1);
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

// --- Partners (plan 0006 §3, §5.2) ------------------------------------------

test('addPartner appends the partner, assigns id 1 to the first partner, and returns that id', () => {
  const state = createState();
  const id = addPartner(state, { name: 'Acme d.o.o.', countryCode: 'SI', vatId: '11111111' });
  assert.equal(id, 1);
  assert.deepEqual(state.partners, [{ id: 1, name: 'Acme d.o.o.', countryCode: 'SI', vatId: '11111111' }]);
});

test('addPartner assigns consecutive ids starting at 1, ordered by id ascending', () => {
  const state = createState();
  const idA = addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  const idB = addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });
  const idC = addPartner(state, { name: 'C', countryCode: 'AT', vatId: '33333333' });
  assert.deepEqual([idA, idB, idC], [1, 2, 3]);
  assert.deepEqual(state.partners.map((p) => p.id), [1, 2, 3]);
});

test('updatePartner merges a patch into the partner matching id, leaving others untouched', () => {
  const state = createState();
  const idA = addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  const idB = addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });
  updatePartner(state, idA, { name: 'A updated' });
  assert.equal(state.partners.find((p) => p.id === idA).name, 'A updated');
  assert.equal(state.partners.find((p) => p.id === idA).countryCode, 'SI');
  assert.equal(state.partners.find((p) => p.id === idB).name, 'B');
});

test('updatePartner throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => updatePartner(state, 999, { name: 'X' }));
});

test('removePartner removes the matching partner and leaves the rest, without renumbering ids', () => {
  const state = createState();
  const idA = addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  const idB = addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });
  const idC = addPartner(state, { name: 'C', countryCode: 'AT', vatId: '33333333' });

  removePartner(state, idB);

  assert.deepEqual(state.partners.map((p) => p.id), [idA, idC]);
});

test('removePartner throws when the id does not exist', () => {
  const state = createState();
  assert.throws(() => removePartner(state, 999));
});

test('removePartner does not decrement nextPartnerId (no in-session id reuse)', () => {
  const state = createState();
  const idA = addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });

  removePartner(state, idA);
  const idC = addPartner(state, { name: 'C', countryCode: 'AT', vatId: '33333333' });

  assert.equal(idC, 3);
});

test('deleting the highest-id partner then adding another in the same session does not reuse its id', () => {
  const state = createState();
  addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  const idB = addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });

  removePartner(state, idB);
  const idNext = addPartner(state, { name: 'C', countryCode: 'AT', vatId: '33333333' });

  assert.equal(idNext, 3);
});

test('seedPartners replaces state.partners and seeds nextPartnerId to one past the highest loaded id', () => {
  const state = createState();
  seedPartners(state, [
    { id: 2, name: 'A', countryCode: 'SI', vatId: '11111111' },
    { id: 5, name: 'B', countryCode: 'DE', vatId: '22222222' },
  ]);
  assert.equal(state.partners.length, 2);
  assert.equal(state.nextPartnerId, 6);

  const newId = addPartner(state, { name: 'C', countryCode: 'AT', vatId: '33333333' });
  assert.equal(newId, 6);
});

test('seedPartners with an empty array seeds nextPartnerId to 1', () => {
  const state = createState();
  seedPartners(state, []);
  assert.equal(state.partners.length, 0);
  assert.equal(state.nextPartnerId, 1);
});

test('reload reuse: seeding from a stored list after deleting the highest-id partner reuses that id (acceptable per plan §3.3)', () => {
  const state = createState();
  addPartner(state, { name: 'A', countryCode: 'SI', vatId: '11111111' });
  const idB = addPartner(state, { name: 'B', countryCode: 'DE', vatId: '22222222' });
  removePartner(state, idB);

  // Simulate a reload: a fresh state seeded from what remains in storage.
  const reloaded = createState();
  seedPartners(reloaded, state.partners.map((p) => ({ ...p })));
  const reusedId = addPartner(reloaded, { name: 'C', countryCode: 'AT', vatId: '33333333' });

  assert.equal(reusedId, 2);
});

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { forgetGeneral, hasSavedGeneral, loadGeneral, saveGeneral } from './generalStore.js';
import { createState } from './state.js';

// generalStore.js reads/writes through storage.js's default backend
// (globalThis.localStorage), so tests install a Map-backed fake there —
// there is no real localStorage under Node's test runner.
function installFakeLocalStorage() {
  const map = new Map();
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

beforeEach(() => {
  installFakeLocalStorage();
});

const FULL_GENERAL = {
  taxPayerID: '12345678',
  periodType: 'quarterly',
  periodUnit: '2',
  periodYear: '2026',
  vracilo: true,
  odbdelez: true,
};

test('hasSavedGeneral is false when nothing has been saved', () => {
  assert.equal(hasSavedGeneral(), false);
});

test('saveGeneral then loadGeneral round-trips exactly the six Glava fields', () => {
  saveGeneral(FULL_GENERAL);
  assert.deepEqual(loadGeneral(), FULL_GENERAL);
});

test('saveGeneral reports success', () => {
  assert.equal(saveGeneral(FULL_GENERAL), true);
});

test('saveGeneral saves values as-is, with no validation gate', () => {
  const incomplete = {
    taxPayerID: '',
    periodType: 'monthly',
    periodUnit: '',
    periodYear: '',
    vracilo: false,
    odbdelez: false,
  };
  saveGeneral(incomplete);
  assert.deepEqual(loadGeneral(), incomplete);
});

test('saveGeneral picks only the six whitelisted fields, ignoring anything else on the source object', () => {
  saveGeneral({ ...FULL_GENERAL, id: 'e1', zapSt: 1 });
  const loaded = loadGeneral();
  assert.deepEqual(Object.keys(loaded).sort(), Object.keys(FULL_GENERAL).sort());
});

test('saveGeneral overwrites a previously saved record', () => {
  saveGeneral(FULL_GENERAL);
  saveGeneral({ ...FULL_GENERAL, taxPayerID: '87654321' });
  assert.equal(loadGeneral().taxPayerID, '87654321');
});

test('hasSavedGeneral is true once a record has been saved', () => {
  saveGeneral(FULL_GENERAL);
  assert.equal(hasSavedGeneral(), true);
});

test('loadGeneral returns null when nothing is saved', () => {
  assert.equal(loadGeneral(), null);
});

test('loadGeneral falls back to defaults for fields missing from an older/partial saved record', () => {
  globalThis.localStorage.setItem(
    'ddvReporter.general',
    JSON.stringify({ version: 1, data: { taxPayerID: '12345678' } }),
  );
  assert.deepEqual(loadGeneral(), {
    ...createState().general,
    taxPayerID: '12345678',
  });
});

test('loadGeneral ignores unrecognized fields in a saved record', () => {
  globalThis.localStorage.setItem(
    'ddvReporter.general',
    JSON.stringify({ version: 1, data: { ...FULL_GENERAL, futureField: 'unknown' } }),
  );
  const loaded = loadGeneral();
  assert.deepEqual(loaded, FULL_GENERAL);
  assert.equal('futureField' in loaded, false);
});

test('loadGeneral returns null (treated as nothing saved) for a corrupt saved record', () => {
  globalThis.localStorage.setItem('ddvReporter.general', '{not valid json');
  assert.equal(loadGeneral(), null);
});

test('forgetGeneral removes the saved record and reports success', () => {
  saveGeneral(FULL_GENERAL);
  assert.equal(forgetGeneral(), true);
  assert.equal(hasSavedGeneral(), false);
  assert.equal(loadGeneral(), null);
});

test('forgetGeneral does not alter values already loaded into memory', () => {
  saveGeneral(FULL_GENERAL);
  const state = createState();
  Object.assign(state.general, loadGeneral());
  forgetGeneral();
  assert.deepEqual(state.general, FULL_GENERAL);
});

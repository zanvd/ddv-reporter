import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { loadPartners, savePartners } from './partnerStore.js';

// partnerStore.js reads/writes through storage.js's default backend
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

function installThrowingLocalStorage() {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error('getItem unavailable');
    },
    setItem: () => {
      throw new Error('setItem unavailable');
    },
    removeItem: () => {
      throw new Error('removeItem unavailable');
    },
  };
}

beforeEach(() => {
  installFakeLocalStorage();
});

const PARTNERS = [
  { id: 1, name: 'Acme d.o.o.', countryCode: 'SI', vatId: '11111111' },
  { id: 2, name: 'Beta GmbH', countryCode: 'DE', vatId: '123456789' },
];

test('loadPartners returns [] when nothing has been saved', () => {
  assert.deepEqual(loadPartners(), []);
});

test('savePartners then loadPartners round-trips the partner list', () => {
  savePartners(PARTNERS);
  assert.deepEqual(loadPartners(), PARTNERS);
});

test('savePartners reports success', () => {
  assert.equal(savePartners(PARTNERS), true);
});

test('savePartners overwrites a previously saved list (whole-list write-through)', () => {
  savePartners(PARTNERS);
  savePartners([{ id: 3, name: 'Gamma', countryCode: 'AT', vatId: '99999999' }]);
  assert.deepEqual(loadPartners(), [{ id: 3, name: 'Gamma', countryCode: 'AT', vatId: '99999999' }]);
});

test('savePartners persists an empty list (e.g. after deleting the last partner)', () => {
  savePartners(PARTNERS);
  savePartners([]);
  assert.deepEqual(loadPartners(), []);
});

test('savePartners picks only the four recognized fields, ignoring anything else on each item', () => {
  savePartners([{ ...PARTNERS[0], zapSt: 1, staleSelected: true }]);
  const loaded = loadPartners();
  assert.deepEqual(Object.keys(loaded[0]).sort(), ['countryCode', 'id', 'name', 'vatId']);
});

test('loadPartners ignores unrecognized fields in a saved record', () => {
  globalThis.localStorage.setItem(
    'ddvReporter.partners',
    JSON.stringify({ version: 1, data: { partners: [{ ...PARTNERS[0], futureField: 'unknown' }] } }),
  );
  const loaded = loadPartners();
  assert.deepEqual(loaded, [PARTNERS[0]]);
  assert.equal('futureField' in loaded[0], false);
});

test('loadPartners returns [] (treated as nothing saved) for a corrupt saved record', () => {
  globalThis.localStorage.setItem('ddvReporter.partners', '{not valid json');
  assert.deepEqual(loadPartners(), []);
});

test('loadPartners returns [] when the stored partners field is not an array', () => {
  globalThis.localStorage.setItem(
    'ddvReporter.partners',
    JSON.stringify({ version: 1, data: { partners: 'not-an-array' } }),
  );
  assert.deepEqual(loadPartners(), []);
});

test('savePartners returns false when the storage backend fails (write blocked)', () => {
  installThrowingLocalStorage();
  assert.equal(savePartners(PARTNERS), false);
});

test('loadPartners returns [] when the storage backend fails (read blocked)', () => {
  installThrowingLocalStorage();
  assert.deepEqual(loadPartners(), []);
});

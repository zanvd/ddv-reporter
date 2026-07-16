import assert from 'node:assert/strict';
import { test } from 'node:test';

import { keyFor, readRecord, removeRecord, writeRecord } from './storage.js';

/** A Map-backed fake localStorage for round-trip tests. */
function createFakeBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    _map: map,
  };
}

/** A fake localStorage whose every method throws, for failure-path tests. */
function createThrowingBackend() {
  return {
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

// --- keyFor ------------------------------------------------------------------

test('keyFor namespaces the domain under ddvReporter.<domain>', () => {
  assert.equal(keyFor('general'), 'ddvReporter.general');
  assert.equal(keyFor('somethingElse'), 'ddvReporter.somethingElse');
});

// --- writeRecord / readRecord round-trip --------------------------------------

test('writeRecord then readRecord round-trips the version and data', () => {
  const backend = createFakeBackend();
  const ok = writeRecord('general', 1, { taxPayerID: '12345678' }, backend);
  assert.equal(ok, true);
  assert.deepEqual(readRecord('general', backend), {
    version: 1,
    data: { taxPayerID: '12345678' },
  });
});

test('writeRecord stores the envelope as JSON under the namespaced key', () => {
  const backend = createFakeBackend();
  writeRecord('general', 1, { taxPayerID: '12345678' }, backend);
  assert.deepEqual(JSON.parse(backend._map.get('ddvReporter.general')), {
    version: 1,
    data: { taxPayerID: '12345678' },
  });
});

test('writeRecord overwrites a previously stored record for the same domain', () => {
  const backend = createFakeBackend();
  writeRecord('general', 1, { taxPayerID: '11111111' }, backend);
  writeRecord('general', 1, { taxPayerID: '22222222' }, backend);
  assert.deepEqual(readRecord('general', backend).data, { taxPayerID: '22222222' });
});

test('writeRecord for one domain does not affect another domain', () => {
  const backend = createFakeBackend();
  writeRecord('general', 1, { a: 1 }, backend);
  writeRecord('other', 1, { b: 2 }, backend);
  assert.deepEqual(readRecord('general', backend).data, { a: 1 });
  assert.deepEqual(readRecord('other', backend).data, { b: 2 });
});

// --- readRecord tolerant-read cases --------------------------------------------

test('readRecord returns null when nothing is stored for the domain', () => {
  const backend = createFakeBackend();
  assert.equal(readRecord('general', backend), null);
});

test('readRecord returns null for corrupt (unparseable) JSON', () => {
  const backend = createFakeBackend();
  backend.setItem(keyFor('general'), '{not valid json');
  assert.equal(readRecord('general', backend), null);
});

test('readRecord returns null when the stored value is not a { data } envelope', () => {
  const backend = createFakeBackend();
  backend.setItem(keyFor('general'), JSON.stringify({ version: 1 }));
  assert.equal(readRecord('general', backend), null);
});

test('readRecord returns null when the stored value is a JSON scalar or array', () => {
  const backend = createFakeBackend();
  backend.setItem(keyFor('general'), JSON.stringify(42));
  assert.equal(readRecord('general', backend), null);
});

// --- removeRecord --------------------------------------------------------------

test('removeRecord removes the stored record so a later readRecord returns null', () => {
  const backend = createFakeBackend();
  writeRecord('general', 1, { taxPayerID: '12345678' }, backend);
  const ok = removeRecord('general', backend);
  assert.equal(ok, true);
  assert.equal(readRecord('general', backend), null);
});

test('removeRecord for one domain does not affect another domain', () => {
  const backend = createFakeBackend();
  writeRecord('general', 1, { a: 1 }, backend);
  writeRecord('other', 1, { b: 2 }, backend);
  removeRecord('general', backend);
  assert.equal(readRecord('general', backend), null);
  assert.deepEqual(readRecord('other', backend).data, { b: 2 });
});

// --- failure paths (throwing backend) -------------------------------------------

test('readRecord returns null when the backend throws (storage unavailable)', () => {
  assert.equal(readRecord('general', createThrowingBackend()), null);
});

test('writeRecord returns false when the backend throws (quota/private mode)', () => {
  assert.equal(writeRecord('general', 1, { a: 1 }, createThrowingBackend()), false);
});

test('removeRecord returns false when the backend throws', () => {
  assert.equal(removeRecord('general', createThrowingBackend()), false);
});

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { loadTheme, saveTheme } from './themeStore.js';

// themeStore.js reads/writes through storage.js's default backend
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

test('saveTheme then loadTheme round-trips through the { version, data } envelope', () => {
  saveTheme('dark');
  assert.equal(loadTheme(), 'dark');
});

test('saveTheme reports success', () => {
  assert.equal(saveTheme('light'), true);
});

test('loadTheme returns null when nothing is saved', () => {
  assert.equal(loadTheme(), null);
});

test('loadTheme returns null for a stored but unrecognized theme value', () => {
  globalThis.localStorage.setItem('ddvReporter.theme', JSON.stringify({ version: 1, data: { theme: 'blue' } }));
  assert.equal(loadTheme(), null);
});

test('loadTheme returns null for a stored envelope that is not a theme record', () => {
  globalThis.localStorage.setItem('ddvReporter.theme', JSON.stringify({ version: 1, data: { taxPayerID: '12345678' } }));
  assert.equal(loadTheme(), null);
});

test('loadTheme returns null for a corrupt stored record', () => {
  globalThis.localStorage.setItem('ddvReporter.theme', '{not valid json');
  assert.equal(loadTheme(), null);
});

test('saveTheme overwrites a previously saved choice', () => {
  saveTheme('light');
  saveTheme('dark');
  assert.equal(loadTheme(), 'dark');
});

test('saveTheme returns false when the backend throws (storage unavailable)', () => {
  installThrowingLocalStorage();
  assert.equal(saveTheme('dark'), false);
});

test('loadTheme returns null when the backend throws (storage unavailable)', () => {
  installThrowingLocalStorage();
  assert.equal(loadTheme(), null);
});

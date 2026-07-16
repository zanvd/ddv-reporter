import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTouchTracker } from './touch.js';

test('a fresh tracker reports every field as untouched', () => {
  const tracker = createTouchTracker();
  assert.equal(tracker.isTouched('a'), false);
  assert.equal(tracker.isTouched('b'), false);
});

test('touch marks only the given field id as touched', () => {
  const tracker = createTouchTracker();
  tracker.touch('a');
  assert.equal(tracker.isTouched('a'), true);
  assert.equal(tracker.isTouched('b'), false);
});

test('touch is idempotent for the same field id', () => {
  const tracker = createTouchTracker();
  tracker.touch('a');
  tracker.touch('a');
  assert.equal(tracker.isTouched('a'), true);
});

test('touchAll marks every given field id as touched, leaving others untouched', () => {
  const tracker = createTouchTracker();
  tracker.touchAll(['a', 'b']);
  assert.equal(tracker.isTouched('a'), true);
  assert.equal(tracker.isTouched('b'), true);
  assert.equal(tracker.isTouched('c'), false);
});

test('touchAll composes with individual touch calls', () => {
  const tracker = createTouchTracker();
  tracker.touch('a');
  tracker.touchAll(['b', 'c']);
  assert.equal(tracker.isTouched('a'), true);
  assert.equal(tracker.isTouched('b'), true);
  assert.equal(tracker.isTouched('c'), true);
});

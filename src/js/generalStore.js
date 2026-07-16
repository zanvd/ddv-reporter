// Glava-specific persistence glue (plan 0002 §5 "generalStore.js").
//
// The one piece of Glava-specific domain knowledge for persistence — the
// six-field whitelist (spec §4) — lives here, on top of the generic,
// domain-agnostic storage.js. Save picks exactly these six fields off
// state.general; load overlays exactly these fields onto the default
// general state, ignoring anything else a stored record might contain
// (older/foreign record shapes, spec §8).
//
// No DOM access. No validation gate on save (spec §6.1: save-as-is).

import { createState } from './state.js';
import { readRecord, removeRecord, writeRecord } from './storage.js';

const DOMAIN = 'general';
const VERSION = 1;

// The full contents of the general section (spec §4) — nothing more.
const FIELD_KEYS = ['taxPayerID', 'periodType', 'periodUnit', 'periodYear', 'vracilo', 'odbdelez'];

/** Picks only the recognized Glava fields present in `source`. */
function pickFields(source) {
  const picked = {};
  for (const key of FIELD_KEYS) {
    if (key in source) picked[key] = source[key];
  }
  return picked;
}

/**
 * Saves a snapshot of the six Glava fields from `general` (typically
 * `state.general`), overwriting any previously saved Glava record.
 *
 * @returns {boolean} `true` on success, `false` on failure (spec §6.1).
 */
export function saveGeneral(general) {
  return writeRecord(DOMAIN, VERSION, pickFields(general));
}

/**
 * Reads the saved Glava record, if any, overlaid onto the application's
 * default general-section state (spec §6.4, §8).
 *
 * @returns {object|null} the six-field general-section values (missing
 *   fields defaulted, unknown fields ignored), or `null` if nothing is
 *   saved or the saved record is corrupt/unparseable.
 */
export function loadGeneral() {
  const record = readRecord(DOMAIN);
  if (!record) return null;

  return { ...createState().general, ...pickFields(record.data) };
}

/**
 * Removes the saved Glava record, if any.
 *
 * @returns {boolean} `true` on success, `false` on failure (spec §6.2).
 */
export function forgetGeneral() {
  return removeRecord(DOMAIN);
}

/** Whether a saved Glava record currently exists (spec §6.3). */
export function hasSavedGeneral() {
  return readRecord(DOMAIN) !== null;
}

// Partner-specific persistence glue (plan 0006 §5.1), mirroring
// generalStore.js on top of the generic, domain-agnostic storage.js.
//
// Unlike Glava (a single record), the partner list is a whole-list
// write-through: the entire array is re-persisted on every create/update/
// delete. This is the simplest correct model for a small, never-paginated
// list (plan §5.1) — there is no partial-write concern to optimize for.
//
// No DOM access. No validation gate here — validation happens in the view
// before calling save (plan §5.4 "Validation gate").

import { readRecord, writeRecord } from './storage.js';

const DOMAIN = 'partners';
const VERSION = 1;

// The four recognized partner fields (plan §3.1) — nothing more.
const FIELD_KEYS = ['id', 'name', 'countryCode', 'vatId'];

/** Picks only the recognized partner fields present in `source`. */
function pickFields(source) {
  const picked = {};
  for (const key of FIELD_KEYS) {
    if (key in source) picked[key] = source[key];
  }
  return picked;
}

/**
 * Reads the saved partner list, if any.
 *
 * @returns {object[]} the saved partners, each reduced to the four
 *   recognized fields (unknown fields ignored), or `[]` if nothing is saved
 *   or the saved record is corrupt/unparseable/not an array.
 */
export function loadPartners() {
  const record = readRecord(DOMAIN);
  if (!record || !Array.isArray(record.data.partners)) return [];

  return record.data.partners.map(pickFields);
}

/**
 * Saves `partners` (typically `state.partners`) as-is, overwriting any
 * previously saved partner list.
 *
 * @returns {boolean} `true` on success, `false` on failure (plan §5.1, §6).
 */
export function savePartners(partners) {
  return writeRecord(DOMAIN, VERSION, { partners: partners.map(pickFields) });
}

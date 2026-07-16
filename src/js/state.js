// In-memory application state: general + kir[] + kpr[], with add/update/remove
// operations for both entry lists (plan §4 "state" module responsibility).
//
// No DOM access. Feeds derive.js/validate.js/serialize.js but does not depend
// on them.
//
// Each stored entry carries two bookkeeping fields beyond its form-state
// fields (postingDate, documentNumber, etc.):
//   - id: a stable identifier (from a simple session-local counter, shared
//     across both lists) so the view layer can target a specific entry for
//     update/remove regardless of its current position in the list. It is
//     an opaque string with no meaning beyond uniqueness within the session.
//   - zapSt: the entry's current 1-indexed line number, recomputed for the
//     whole list after every add/remove (spec §6: ZAPST must be strictly
//     consecutive). This is for live UI display; serialize.js independently
//     (re-)computes ZAPST from array position at serialize time, so the two
//     always agree.

let idCounter = 0;

/** A simple, session-local, monotonically increasing id; unique across both lists. */
function nextEntryId() {
  return `e${++idCounter}`;
}

/** A fresh, empty application state with general-section defaults. */
export function createState() {
  return {
    general: {
      taxPayerID: '',
      periodType: 'monthly',
      periodUnit: '',
      periodYear: '',
      vracilo: false,
      odbdelez: false,
    },
    kir: [],
    kpr: [],
  };
}

/** Merges the given field values into the general section. */
export function updateGeneral(state, patch) {
  Object.assign(state.general, patch);
}

function renumber(entries) {
  entries.forEach((entry, index) => {
    entry.zapSt = index + 1;
  });
}

function addEntry(list, fields) {
  const entry = { id: nextEntryId(), ...fields };
  list.push(entry);
  renumber(list);
  return entry.id;
}

function updateEntry(list, id, patch) {
  const entry = list.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`No entry with id: ${id}`);
  }
  Object.assign(entry, patch);
}

function removeEntry(list, id) {
  const index = list.findIndex((candidate) => candidate.id === id);
  if (index === -1) {
    throw new Error(`No entry with id: ${id}`);
  }
  list.splice(index, 1);
  renumber(list);
}

/** Appends a new KIR (charged/output) entry; returns its generated id. */
export function addKirEntry(state, fields) {
  return addEntry(state.kir, fields);
}

/** Merges field values into the KIR entry with the given id. */
export function updateKirEntry(state, id, patch) {
  updateEntry(state.kir, id, patch);
}

/** Removes the KIR entry with the given id and renumbers the remaining ones. */
export function removeKirEntry(state, id) {
  removeEntry(state.kir, id);
}

/** Appends a new KPR (deducted/input) entry; returns its generated id. */
export function addKprEntry(state, fields) {
  return addEntry(state.kpr, fields);
}

/** Merges field values into the KPR entry with the given id. */
export function updateKprEntry(state, id, patch) {
  updateEntry(state.kpr, id, patch);
}

/** Removes the KPR entry with the given id and renumbers the remaining ones. */
export function removeKprEntry(state, id) {
  removeEntry(state.kpr, id);
}

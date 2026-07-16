// Reusable per-field "touched" tracking for inline validation display.
//
// validate.js (the single source of truth for field errors, spec §7) always
// computes every field's error regardless of user interaction; this module
// decides WHEN to show that error: only after the field has been touched
// (or every field has been revealed at once, e.g. by the Download gate).
// Shared by every form/list view (general section, KIR entries, KPR entries)
// so they all follow the same show/hide rule.
//
// No DOM access — plain bookkeeping over field ids.

/** Creates a fresh touch tracker with no fields touched yet. */
export function createTouchTracker() {
  const touchedIds = new Set();

  return {
    /** Marks a single field id as touched. */
    touch(fieldId) {
      touchedIds.add(fieldId);
    },

    /** True if the field id has been touched (individually or via touchAll). */
    isTouched(fieldId) {
      return touchedIds.has(fieldId);
    },

    /** Marks every given field id as touched in one call (e.g. "reveal all"). */
    touchAll(fieldIds) {
      for (const fieldId of fieldIds) touchedIds.add(fieldId);
    },
  };
}

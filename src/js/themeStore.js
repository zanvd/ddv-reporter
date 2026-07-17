// Theme persistence glue (plan 0004 §3.4 "themeStore.js").
//
// A dedicated key under the ddvReporter.* namespace, independent of and not
// co-mingled with the Glava record (spec §5) — mirrors generalStore.js, but
// for the single theme string rather than the six Glava fields. No DOM.

import { readRecord, writeRecord } from './storage.js';

const DOMAIN = 'theme';
const VERSION = 1;
const VALID_THEMES = ['light', 'dark'];

/**
 * Reads the saved theme choice, if any.
 *
 * @returns {'light'|'dark'|null} the stored theme, or `null` if nothing is
 *   saved or the saved value is not a recognized theme.
 */
export function loadTheme() {
  const record = readRecord(DOMAIN);
  const theme = record && record.data && record.data.theme;
  return VALID_THEMES.includes(theme) ? theme : null;
}

/**
 * Saves the given theme choice, overwriting any previously saved choice.
 *
 * @returns {boolean} `true` on success, `false` on failure (spec §5, §9 —
 *   the toggle still works for the current session; it just isn't remembered).
 */
export function saveTheme(theme) {
  return writeRecord(DOMAIN, VERSION, { theme });
}

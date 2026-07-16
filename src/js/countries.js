// Static country-code data for the DDV_KIR_KPR customer/supplier country fields
// (P6 on KIR entries, P7 on KPR entries).
//
// Per spec §7, the allowed set is: EU member states + SI + XI (Northern Ireland),
// 2-letter ISO-3166 codes, uppercase. Greece may be entered/validated as either
// GR or EL — both are accepted, but the app's own country dropdown (built from
// COUNTRIES below) offers a single "Grčija" entry using GR as the emitted value.
//
// No lookups, no network calls — this table is exhaustive and fixed for v1 (§9
// forbids FURS online lookups).

// Names are Slovenian (settled decision: all user-facing text is Slovenian),
// since this list feeds the KIR/KPR country <select> dropdowns directly.
// Ordered alphabetically by the Slovenian name for a sensible dropdown order.
export const COUNTRIES = [
  { code: 'AT', name: 'Avstrija' },
  { code: 'BE', name: 'Belgija' },
  { code: 'BG', name: 'Bolgarija' },
  { code: 'CY', name: 'Ciper' },
  { code: 'CZ', name: 'Češka' },
  { code: 'DK', name: 'Danska' },
  { code: 'EE', name: 'Estonija' },
  { code: 'FI', name: 'Finska' },
  { code: 'FR', name: 'Francija' },
  { code: 'GR', name: 'Grčija' },
  { code: 'HR', name: 'Hrvaška' },
  { code: 'IE', name: 'Irska' },
  { code: 'IT', name: 'Italija' },
  { code: 'LV', name: 'Latvija' },
  { code: 'LT', name: 'Litva' },
  { code: 'LU', name: 'Luksemburg' },
  { code: 'HU', name: 'Madžarska' },
  { code: 'MT', name: 'Malta' },
  { code: 'DE', name: 'Nemčija' },
  { code: 'NL', name: 'Nizozemska' },
  { code: 'PL', name: 'Poljska' },
  { code: 'PT', name: 'Portugalska' },
  { code: 'RO', name: 'Romunija' },
  { code: 'XI', name: 'Severna Irska' },
  { code: 'SK', name: 'Slovaška' },
  { code: 'SI', name: 'Slovenija' },
  { code: 'ES', name: 'Španija' },
  { code: 'SE', name: 'Švedska' },
];

// Codes accepted as valid input beyond COUNTRIES' canonical list. Greece's
// alternate code EL is accepted for validation even though the dropdown only
// ever emits GR.
const EXTRA_VALID_CODES = ['EL'];

const VALID_CODES = new Set([
  ...COUNTRIES.map((country) => country.code),
  ...EXTRA_VALID_CODES,
]);

/**
 * Uppercases and trims a raw country-code string for comparison/storage.
 * Returns '' for non-string/empty input.
 */
export function normalizeCountryCode(rawCode) {
  return typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
}

/**
 * True if the (normalized) code is one of the allowed ISO-3166 codes for v1
 * (EU member states + SI + XI, with GR/EL both valid for Greece).
 */
export function isValidCountryCode(rawCode) {
  return VALID_CODES.has(normalizeCountryCode(rawCode));
}

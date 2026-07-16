// KIR (charged/output) entry list view: field spec + config for the generic
// entry-list renderer (view/entryList.js), per spec §6.1. ZAPST/OBDOBJE/
// OBRAVNAVA are auto-managed (state.js, serialize.js) and are never
// editable fields here — see view/entryList.js for the shared rendering
// behavior (add/edit/remove, touched/reveal-all, zapSt renumbering).

import { addKirEntry, removeKirEntry, updateKirEntry } from '../state.js';
import { validateKirEntry } from '../validate.js';
import { renderEntryList } from './entryList.js';

const KIR_FIELDS = [
  { key: 'postingDate', label: 'Datum knjiženja listine', type: 'date' },
  { key: 'documentNumber', label: 'Številka listine', type: 'text', maxLength: 250 },
  { key: 'documentDate', label: 'Datum listine', type: 'date' },
  { key: 'customerCountry', label: 'Koda države kupca', type: 'country' },
  {
    key: 'customerVatId',
    label: 'Identifikacijska številka kupca za DDV (brez kode države)',
    type: 'text',
    maxLength: 25,
  },
  { key: 'netValue', label: 'Vrednost dobav blaga in storitev (brez DDV)', type: 'amount' },
  { key: 'vat22', label: 'Obračunan DDV po 22 %', type: 'amount' },
  { key: 'vat95', label: 'Obračunan DDV po 9,5 %', type: 'amount' },
  { key: 'vat5', label: 'Obračunan DDV po 5 %', type: 'amount' },
];

const KIR_CONFIG = {
  fields: KIR_FIELDS,
  idPrefix: 'kir',
  listKey: 'kir',
  emptyText: 'Trenutno ni vnesenih izdanih računov.',
  addLabel: 'Dodaj izdani račun',
  addEntry: addKirEntry,
  updateEntry: updateKirEntry,
  removeEntry: removeKirEntry,
  validateEntry: validateKirEntry,
};

/**
 * Renders the KIR (charged/output) entry list into `container`, bound to
 * `state.kir`.
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 * @returns {{revealErrors: () => void}}
 */
export function renderKirList(container, state) {
  return renderEntryList(container, state, KIR_CONFIG);
}

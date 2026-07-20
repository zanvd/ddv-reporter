// KIR (charged/output) entry list view: field spec + config for the generic
// entry-list renderer (view/entryList.js), per spec §6.1. ZAPST/OBDOBJE/
// OBRAVNAVA are auto-managed (state.js, serialize.js) and are never
// editable fields here — see view/entryList.js for the shared rendering
// behavior (add/edit/remove, touched/reveal-all, zapSt renumbering).
//
// Partner integration (plan 0006 §5.7, spec §9): a KIR row has no customer-
// name FURS field, so only customerCountry/customerVatId (P6/P6DS) are
// hidden behind the "Partner" dropdown on a partner-backed row — a partner's
// name is used only as the dropdown's option label, never copied into the
// entry.

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
 * @returns {{revealErrors: () => void, refreshPartnerButton: () => void}}
 */
export function renderKirList(container, state) {
  const config = {
    ...KIR_CONFIG,
    partner: {
      addLabel: 'Dodaj izdani račun partnerja',
      identityKeys: ['customerCountry', 'customerVatId'],
      copyFrom: (partner) => ({ customerCountry: partner.countryCode, customerVatId: partner.vatId }),
      currentPartners: () => state.partners,
    },
  };
  return renderEntryList(container, state, config);
}

// KPR (deducted/input) entry list view: field spec + config for the generic
// entry-list renderer (view/entryList.js), per spec §6.2. ZAPST/OBDOBJE/
// OBRAVNAVA are auto-managed (state.js, serialize.js) and are never
// editable fields here — see view/entryList.js for the shared rendering
// behavior (add/edit/remove, touched/reveal-all, zapSt renumbering).
//
// KPR differences from KIR, carried entirely by this config: supplierCountry
// and supplierVatId are always required (validateKprEntry enforces this —
// no view-level special-casing needed), there are two distinct date fields
// beyond postingDate (dateReceived P4, documentDate P5), and there's an
// extra flatRate8/P21 amount.
//
// Partner integration (plan 0006 §5.7, spec §9): a KPR row's supplier name
// IS a FURS field (P6), unlike KIR, so all three of supplierName/
// supplierCountry/supplierVatId are hidden behind the "Partner" dropdown on
// a partner-backed row, and a selected partner's name is copied in
// alongside its country/VAT id.

import { addKprEntry, removeKprEntry, updateKprEntry } from '../state.js';
import { validateKprEntry } from '../validate.js';
import { renderEntryList } from './entryList.js';

const KPR_FIELDS = [
  { key: 'postingDate', label: 'Datum knjiženja listine', type: 'date' },
  { key: 'documentNumber', label: 'Številka listine', type: 'text', maxLength: 250 },
  { key: 'dateReceived', label: 'Datum prejema listine', type: 'date' },
  { key: 'documentDate', label: 'Datum listine', type: 'date' },
  { key: 'supplierName', label: 'Firma / ime in sedež dobavitelja', type: 'text', maxLength: 250 },
  { key: 'supplierCountry', label: 'Koda države dobavitelja', type: 'country' },
  {
    key: 'supplierVatId',
    label: 'Identifikacijska številka dobavitelja za DDV (brez kode države)',
    type: 'text',
    maxLength: 25,
  },
  { key: 'netValue', label: 'Vrednost nabav blaga in storitev (brez DDV)', type: 'amount' },
  { key: 'deductVat22', label: 'Odbitni DDV po 22 %', type: 'amount' },
  { key: 'deductVat95', label: 'Odbitni DDV po 9,5 %', type: 'amount' },
  { key: 'deductVat5', label: 'Odbitni DDV po 5 %', type: 'amount' },
  { key: 'flatRate8', label: 'Pavšalno nadomestilo 8 %', type: 'amount' },
];

const KPR_CONFIG = {
  fields: KPR_FIELDS,
  idPrefix: 'kpr',
  listKey: 'kpr',
  emptyText: 'Trenutno ni vnesenih prejetih računov.',
  addLabel: 'Dodaj prejeti račun',
  addEntry: addKprEntry,
  updateEntry: updateKprEntry,
  removeEntry: removeKprEntry,
  validateEntry: validateKprEntry,
};

/**
 * Renders the KPR (deducted/input) entry list into `container`, bound to
 * `state.kpr`.
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 * @returns {{revealErrors: () => void, refreshPartnerButton: () => void}}
 */
export function renderKprList(container, state) {
  const config = {
    ...KPR_CONFIG,
    partner: {
      addLabel: 'Dodaj prejeti račun partnerja',
      identityKeys: ['supplierName', 'supplierCountry', 'supplierVatId'],
      copyFrom: (partner) => ({
        supplierName: partner.name,
        supplierCountry: partner.countryCode,
        supplierVatId: partner.vatId,
      }),
      currentPartners: () => state.partners,
    },
  };
  return renderEntryList(container, state, config);
}

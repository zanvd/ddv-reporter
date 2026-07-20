// Generic, config-driven entry-list view: renders a dynamic list of "cards"
// (add/edit/remove) for either the KIR or the KPR entry type, driven
// entirely by a field-spec + config object. view/kirList.js and
// view/kprList.js are thin wrappers that supply their own field spec and
// config, and re-export the renderKirList/renderKprList signatures main.js
// depends on — this module owns everything that used to be duplicated
// between them.
//
// Behavior (identical for both entry types):
//   - Build-once/patch-in-place: editing a field only updates that field's
//     value + its own error text; no row is ever wholesale re-rendered, so
//     typing never loses focus/cursor position.
//   - Per-row "touched" gating (view/touch.js): a field's error is hidden
//     until that field is touched (input/change, or blur), or
//     revealErrors() reveals every field in every row at once (for the
//     future Download gate).
//   - ZAPST is never a directly editable field; each row shows a read-only
//     "Vnos {zapSt}" heading, kept in sync via setZapSt/syncZapStLabels
//     whenever config.removeEntry renumbers the remaining entries.
//   - All field errors come solely from config.validateEntry — this module
//     has no validation logic of its own. In particular, cross-field rules
//     like the KIR P6/P6DS pairing need no special handling here:
//     validateKirEntry already returns errors keyed by field.key (e.g.
//     both customerCountry and customerVatId when only one is provided),
//     and this generic per-field "show errors[field.key] iff that field is
//     touched" loop reproduces the exact prior behavior, including that an
//     untouched partner field's error stays hidden until it is itself
//     touched or revealed.
//
// Partner-backed rows (plan 0006 §5.6, spec §9): a config-gated branch, inert
// unless config.partner is supplied. When a row is built with
// { partnerBacked: true }, its config.partner.identityKeys field groups are
// not rendered at all — a single "Partner" dropdown takes their place in the
// grid, and selecting an option copies (config.partner.copyFrom) or clears
// those identity keys via the same config.updateEntry the normal fields use.
// The identity fields' own error text is never shown on such a row; instead
// the dropdown carries at most one message ("Partner ne obstaja." for a
// stale/removed selection, persistent and independent of the Download gate;
// "Izberite partnerja." when the (now-empty) identity fields fail validation
// and the row has been touched/revealed). validateEntry/validateState are
// untouched — the Download gate keeps blocking/passing exactly as it would
// for a manually-typed row with the same (blank or filled) identity values.

import { buildFieldGroup, buildPartnerFieldGroup, changeEventFor, emptyFieldsFromSpec } from './fieldBuilders.js';
import { createTouchTracker } from './touch.js';

const PARTNER_FIELD_ID = 'partner';
const PARTNER_NOT_FOUND_MESSAGE = 'Partner ne obstaja.';
const PARTNER_REQUIRED_MESSAGE = 'Izberite partnerja.';

/**
 * Builds one entry's card: fields (per config.fields), inline errors, and a
 * per-row touch tracker. `entry` is the live object stored in the bound
 * state list (mutated in place by config.updateEntry), so reading it always
 * reflects the latest values.
 *
 * @param {{partnerBacked?: boolean, partnerOptions?: {id: number, name: string}[]}} rowOptions
 * @returns {{element: HTMLElement, revealErrors: () => void, setZapSt: (n: number) => void}}
 */
function buildEntryRow(entry, state, config, { onRemove }, rowOptions = {}) {
  const { partnerBacked = false, partnerOptions = [] } = rowOptions;
  const identityKeys = new Set(partnerBacked ? config.partner.identityKeys : []);

  const touch = createTouchTracker();
  const fieldKeys = config.fields.map((field) => field.key);

  const card = document.createElement('div');
  card.className = 'entry-card';

  const heading = document.createElement('h3');
  heading.className = 'entry-heading';
  heading.textContent = `Vnos ${entry.zapSt}`;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove-entry-button';
  removeButton.textContent = 'Odstrani';
  removeButton.addEventListener('click', onRemove);

  const cardHeader = document.createElement('div');
  cardHeader.className = 'entry-card-header';
  cardHeader.append(heading, removeButton);

  const grid = document.createElement('div');
  grid.className = 'entry-form';

  // key -> { wrapper, input, error }
  const groups = new Map();
  let partnerGroup = null;
  // Set at selection time only (spec §9.4) — never recomputed reactively, so
  // a partner deleted/edited after this row copied its data leaves an
  // untouched row's indicator alone.
  let staleSelected = false;

  function shownError(key, message) {
    return touch.isTouched(key) ? message ?? '' : '';
  }

  function anyIdentityKeyHasError(errors) {
    for (const key of identityKeys) {
      if (errors[key]) return true;
    }
    return false;
  }

  function partnerDropdownMessage(errors) {
    if (staleSelected) return PARTNER_NOT_FOUND_MESSAGE;
    if (touch.isTouched(PARTNER_FIELD_ID) && anyIdentityKeyHasError(errors)) return PARTNER_REQUIRED_MESSAGE;
    return '';
  }

  function refreshErrors() {
    const errors = config.validateEntry(entry);
    for (const field of config.fields) {
      if (identityKeys.has(field.key)) continue; // not rendered on a partner-backed row
      groups.get(field.key).error.textContent = shownError(field.key, errors[field.key]);
    }
    if (partnerBacked) {
      partnerGroup.error.textContent = partnerDropdownMessage(errors);
    }
  }

  function clearedIdentityFields() {
    return Object.fromEntries([...identityKeys].map((key) => [key, '']));
  }

  function handlePartnerChange() {
    const selectedId = partnerGroup.input.value;
    if (selectedId === '') {
      staleSelected = false;
      config.updateEntry(state, entry.id, clearedIdentityFields());
    } else {
      const partner = config.partner.currentPartners().find((candidate) => String(candidate.id) === selectedId);
      if (partner) {
        staleSelected = false;
        config.updateEntry(state, entry.id, config.partner.copyFrom(partner));
      } else {
        staleSelected = true;
        config.updateEntry(state, entry.id, clearedIdentityFields());
      }
    }
    touch.touch(PARTNER_FIELD_ID);
    refreshErrors();
  }

  let partnerGroupBuilt = false;
  for (const field of config.fields) {
    if (identityKeys.has(field.key)) {
      if (!partnerGroupBuilt) {
        const id = `${config.idPrefix}-${entry.id}-${PARTNER_FIELD_ID}`;
        partnerGroup = buildPartnerFieldGroup(id, partnerOptions, '');
        grid.appendChild(partnerGroup.wrapper);
        partnerGroup.input.addEventListener('change', handlePartnerChange);
        partnerGroup.input.addEventListener('blur', () => {
          touch.touch(PARTNER_FIELD_ID);
          refreshErrors();
        });
        partnerGroupBuilt = true;
      }
      continue;
    }

    const id = `${config.idPrefix}-${entry.id}-${field.key}`;
    const group = buildFieldGroup(id, field, entry[field.key]);
    groups.set(field.key, group);
    grid.appendChild(group.wrapper);

    group.input.addEventListener(changeEventFor(field), () => {
      config.updateEntry(state, entry.id, { [field.key]: group.input.value });
      touch.touch(field.key);
      refreshErrors();
    });
    group.input.addEventListener('blur', () => {
      touch.touch(field.key);
      refreshErrors();
    });
  }

  /**
   * Marks every field in this row touched and re-renders its errors. Called
   * by renderEntryList's own revealErrors(), which the Download gate
   * invokes across every row. Touching the partner dropdown (even on a
   * non-partner-backed row, harmlessly a no-op) surfaces "Izberite
   * partnerja." on a blocked partner-backed row exactly as the Download
   * gate reveals any other required field.
   */
  function revealErrors() {
    touch.touchAll(fieldKeys);
    touch.touch(PARTNER_FIELD_ID);
    refreshErrors();
  }

  refreshErrors();

  card.append(cardHeader, grid);

  return {
    element: card,
    revealErrors,
    setZapSt(zapSt) {
      heading.textContent = `Vnos ${zapSt}`;
    },
  };
}

/**
 * Renders a generic KIR/KPR-shaped entry list into `container`, bound to
 * `state[config.listKey]`, per the given field-spec + config.
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 * @param {{
 *   fields: {key: string, label: string, type: 'text'|'date'|'country'|'amount', maxLength?: number}[],
 *   idPrefix: string,
 *   listKey: string,
 *   emptyText: string,
 *   addLabel: string,
 *   addEntry: (state: object, fields: object) => string,
 *   updateEntry: (state: object, id: string, patch: object) => void,
 *   removeEntry: (state: object, id: string) => void,
 *   validateEntry: (entry: object) => Record<string, string>,
 *   partner?: {
 *     addLabel: string,
 *     identityKeys: string[],
 *     copyFrom: (partner: {id: number, name: string, countryCode: string, vatId: string}) => object,
 *     currentPartners: () => {id: number, name: string, countryCode: string, vatId: string}[],
 *   },
 * }} config
 * @returns {{revealErrors: () => void, refreshPartnerButton: () => void}}
 *   `revealErrors` reveals every remaining error in every row; the Download
 *   gate calls this. `refreshPartnerButton` re-evaluates the "add … partnerja"
 *   button's disabled state from config.partner.currentPartners().length
 *   (plan §5.7); a no-op when config.partner is absent.
 */
export function renderEntryList(container, state, config) {
  container.replaceChildren();

  const listElement = document.createElement('div');
  listElement.className = 'entry-list';

  const emptyMessage = document.createElement('p');
  emptyMessage.className = 'empty-state';
  emptyMessage.textContent = config.emptyText;

  const addButtons = document.createElement('div');
  addButtons.className = 'entry-add-buttons';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-entry-button';
  addButton.textContent = config.addLabel;
  addButtons.appendChild(addButton);

  let partnerAddButton = null;
  if (config.partner) {
    partnerAddButton = document.createElement('button');
    partnerAddButton.type = 'button';
    partnerAddButton.className = 'add-entry-button add-partner-entry-button';
    partnerAddButton.textContent = config.partner.addLabel;
    addButtons.appendChild(partnerAddButton);
  }

  const rows = new Map();

  function entries() {
    return state[config.listKey];
  }

  function updateEmptyState() {
    if (entries().length === 0) {
      if (!emptyMessage.isConnected) listElement.appendChild(emptyMessage);
    } else if (emptyMessage.isConnected) {
      emptyMessage.remove();
    }
  }

  function syncZapStLabels() {
    for (const entry of entries()) {
      rows.get(entry.id)?.setZapSt(entry.zapSt);
    }
  }

  function addRow(entryId, rowOptions) {
    let row;
    const handleRemove = () => {
      config.removeEntry(state, entryId);
      row.element.remove();
      rows.delete(entryId);
      syncZapStLabels();
      updateEmptyState();
    };

    const entry = entries().find((candidate) => candidate.id === entryId);
    row = buildEntryRow(entry, state, config, { onRemove: handleRemove }, rowOptions);
    rows.set(entryId, row);
    listElement.appendChild(row.element);
  }

  addButton.addEventListener('click', () => {
    const entryId = config.addEntry(state, emptyFieldsFromSpec(config.fields));
    addRow(entryId);
    updateEmptyState();
  });

  function refreshPartnerButton() {
    if (!partnerAddButton) return;
    partnerAddButton.disabled = config.partner.currentPartners().length === 0;
  }

  if (partnerAddButton) {
    refreshPartnerButton();
    partnerAddButton.addEventListener('click', () => {
      const entryId = config.addEntry(state, emptyFieldsFromSpec(config.fields));
      // A frozen, point-in-time snapshot (plan §9.3) — never re-synced as
      // partners are later added/edited/removed.
      const partnerOptions = config.partner.currentPartners().map((partner) => ({
        id: partner.id,
        name: partner.name,
      }));
      addRow(entryId, { partnerBacked: true, partnerOptions });
      updateEmptyState();
    });
  }

  for (const entry of entries()) {
    addRow(entry.id);
  }
  updateEmptyState();

  container.append(listElement, addButtons);

  function revealErrors() {
    for (const row of rows.values()) row.revealErrors();
  }

  return { revealErrors, refreshPartnerButton };
}

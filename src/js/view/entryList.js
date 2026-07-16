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

import { buildFieldGroup, changeEventFor, emptyFieldsFromSpec } from './fieldBuilders.js';
import { createTouchTracker } from './touch.js';

/**
 * Builds one entry's card: fields (per config.fields), inline errors, and a
 * per-row touch tracker. `entry` is the live object stored in the bound
 * state list (mutated in place by config.updateEntry), so reading it always
 * reflects the latest values.
 *
 * @returns {{element: HTMLElement, revealErrors: () => void, setZapSt: (n: number) => void}}
 */
function buildEntryRow(entry, state, config, { onRemove }) {
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

  function shownError(key, message) {
    return touch.isTouched(key) ? message ?? '' : '';
  }

  function refreshErrors() {
    const errors = config.validateEntry(entry);
    for (const field of config.fields) {
      groups.get(field.key).error.textContent = shownError(field.key, errors[field.key]);
    }
  }

  for (const field of config.fields) {
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
   * (Chunk 8) will invoke across every row.
   */
  function revealErrors() {
    touch.touchAll(fieldKeys);
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
 * }} config
 * @returns {{revealErrors: () => void}} `revealErrors` reveals every
 *   remaining error in every row; the Download gate calls this.
 */
export function renderEntryList(container, state, config) {
  container.replaceChildren();

  const listElement = document.createElement('div');
  listElement.className = 'entry-list';

  const emptyMessage = document.createElement('p');
  emptyMessage.className = 'empty-state';
  emptyMessage.textContent = config.emptyText;

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-entry-button';
  addButton.textContent = config.addLabel;

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

  function addRow(entryId) {
    let row;
    const handleRemove = () => {
      config.removeEntry(state, entryId);
      row.element.remove();
      rows.delete(entryId);
      syncZapStLabels();
      updateEmptyState();
    };

    const entry = entries().find((candidate) => candidate.id === entryId);
    row = buildEntryRow(entry, state, config, { onRemove: handleRemove });
    rows.set(entryId, row);
    listElement.appendChild(row.element);
  }

  addButton.addEventListener('click', () => {
    const entryId = config.addEntry(state, emptyFieldsFromSpec(config.fields));
    addRow(entryId);
    updateEmptyState();
  });

  for (const entry of entries()) {
    addRow(entry.id);
  }
  updateEmptyState();

  container.append(listElement, addButton);

  function revealErrors() {
    for (const row of rows.values()) row.revealErrors();
  }

  return { revealErrors };
}

// Partnerji tab view (plan 0006 §5.4): a table of saved partners with inline
// add/edit/delete, dirty-gated save, and write-through persistence with
// rollback on a storage failure. Renders into #partner-content, bound to
// state.partners.
//
// Unlike the KIR/KPR entry rows (view/entryList.js), editing a field here
// does NOT mutate state.partners on every keystroke — each row keeps its own
// local "draft" of the three editable fields, compared against a "snapshot"
// of the last-persisted values (for dirty-tracking and, on a failed save,
// for reverting the state.js mutation). Only a successful Save commits the
// draft into state.partners (and persists it); Cancel/an unsaved edit never
// touches state at all.
//
// Row-level submit gate (plan §5.4, spec §8): a field's error is quiet until
// that field is touched (view/touch.js), and clicking that row's Save button
// reveals every remaining error in that row at once — the row-scoped analog
// of the Download gate.

import { savePartners } from '../partnerStore.js';
import { addPartner, removePartner, updatePartner } from '../state.js';
import { hasPartnerErrors, validatePartner } from '../validate.js';
import { buildCountrySelect, buildErrorText } from './fieldBuilders.js';
import { createTouchTracker } from './touch.js';

const VAT_ID_ARIA_LABEL = 'Identifikacijska številka za DDV (brez kode države)';
const FIELD_KEYS = ['name', 'countryCode', 'vatId'];

let rowSeq = 0;
/** A DOM-id-safe sequence for a not-yet-saved row (a partner has no id yet). */
function nextNewRowSeq() {
  return ++rowSeq;
}

function buildTextCell(id, value, { maxLength, ariaLabel } = {}) {
  const cell = document.createElement('td');

  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.name = id;
  input.value = value ?? '';
  input.setAttribute('aria-describedby', `${id}-error`);
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
  if (maxLength) input.maxLength = maxLength;

  const error = buildErrorText(id);
  cell.append(input, error);

  return { cell, input, error };
}

function buildCountryCell(id, value) {
  const cell = document.createElement('td');

  const select = buildCountrySelect(id, value);
  select.setAttribute('aria-label', 'Koda države');

  const error = buildErrorText(id);
  cell.append(select, error);

  return { cell, input: select, error };
}

function buildIconButton(className, ariaLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `partner-icon-button ${className}`;
  button.setAttribute('aria-label', ariaLabel);

  const icon = document.createElement('span');
  icon.className = 'partner-icon-button-icon';
  icon.setAttribute('aria-hidden', 'true');
  button.appendChild(icon);

  return button;
}

/**
 * Builds one partner's row: either a freshly added, not-yet-persisted row
 * (`isNew: true`, `partner` a blank `{ id: null, name: '', countryCode: '',
 * vatId: '' }`) or an existing, persisted row (`isNew: false`, `partner` the
 * live object from `state.partners`).
 *
 * @returns {{element: HTMLElement, scrollIntoView: () => void}}
 */
function buildPartnerRow(
  partner,
  isNewInitially,
  state,
  { showMessage, onPartnersChanged, onCancel, onSaved, onDeleted },
) {
  let isNew = isNewInitially;
  let partnerId = partner.id;
  // The last-persisted values (for dirty-tracking + revert-on-failure); for
  // a new row this starts blank, same as the draft.
  let snapshot = { name: partner.name, countryCode: partner.countryCode, vatId: partner.vatId };
  // The row's in-progress edit, independent of state.partners until Save
  // succeeds (plan §5.4).
  const draft = { ...snapshot };

  const touch = createTouchTracker();
  const idPrefix = isNew ? `partner-new-${nextNewRowSeq()}` : `partner-${partnerId}`;

  const row = document.createElement('tr');
  row.className = 'partner-row';

  const idCell = document.createElement('td');
  idCell.className = 'partner-id-cell';
  idCell.textContent = isNew ? '' : String(partnerId);

  const nameCell = buildTextCell(`${idPrefix}-name`, draft.name, { maxLength: 250, ariaLabel: 'Naziv' });
  const countryCell = buildCountryCell(`${idPrefix}-country-code`, draft.countryCode);
  const vatIdCell = buildTextCell(`${idPrefix}-vat-id`, draft.vatId, { maxLength: 25, ariaLabel: VAT_ID_ARIA_LABEL });

  const fieldCells = { name: nameCell, countryCode: countryCell, vatId: vatIdCell };

  const saveButton = buildIconButton(
    'partner-save-button',
    isNew ? 'Shrani partnerja' : 'Posodobi partnerja',
  );
  const secondaryButton = buildIconButton(
    isNew ? 'partner-cancel-button' : 'partner-delete-button',
    isNew ? 'Prekliči dodajanje partnerja' : 'Odstrani partnerja',
  );

  const saveCell = document.createElement('td');
  saveCell.appendChild(saveButton);
  const secondaryCell = document.createElement('td');
  secondaryCell.appendChild(secondaryButton);

  row.append(idCell, nameCell.cell, countryCell.cell, vatIdCell.cell, saveCell, secondaryCell);

  function isDirty() {
    return FIELD_KEYS.some((key) => draft[key] !== snapshot[key]);
  }

  function refreshSaveEnabled() {
    saveButton.disabled = !isNew && !isDirty();
  }

  function shownError(key, message) {
    return touch.isTouched(key) ? message ?? '' : '';
  }

  function refreshErrors() {
    const errors = validatePartner(draft);
    for (const key of FIELD_KEYS) {
      fieldCells[key].error.textContent = shownError(key, errors[key]);
    }
    return errors;
  }

  function revealErrors() {
    touch.touchAll(FIELD_KEYS);
    return refreshErrors();
  }

  for (const key of FIELD_KEYS) {
    const { input } = fieldCells[key];
    const eventName = key === 'countryCode' ? 'change' : 'input';
    input.addEventListener(eventName, () => {
      draft[key] = input.value;
      touch.touch(key);
      refreshErrors();
      refreshSaveEnabled();
    });
    input.addEventListener('blur', () => {
      touch.touch(key);
      refreshErrors();
    });
  }

  function morphToSavedRow(id) {
    isNew = false;
    partnerId = id;
    idCell.textContent = String(id);
    saveButton.setAttribute('aria-label', 'Posodobi partnerja');
    secondaryButton.className = 'partner-icon-button partner-delete-button';
    secondaryButton.setAttribute('aria-label', 'Odstrani partnerja');
  }

  function handleSave() {
    const errors = revealErrors();
    if (hasPartnerErrors(errors)) return;

    if (isNew) {
      const id = addPartner(state, { ...draft });
      const success = savePartnersOrRollback(state, () => removePartner(state, id));
      if (success) {
        snapshot = { ...draft };
        morphToSavedRow(id);
        refreshSaveEnabled();
        onSaved(); // this row is no longer "the" unsaved new row, but stays on screen
        showMessage('Partner dodan', { success: true });
        onPartnersChanged();
      } else {
        showMessage('Pri dodajanju partnerja je prišlo do napake.', { success: false });
      }
    } else {
      const previous = { ...snapshot };
      updatePartner(state, partnerId, { ...draft });
      const success = savePartnersOrRollback(state, () => updatePartner(state, partnerId, previous));
      if (success) {
        snapshot = { ...draft };
        refreshSaveEnabled();
        showMessage('Partner posodobljen', { success: true });
        onPartnersChanged();
      } else {
        showMessage('Pri posodabljanju partnerja je prišlo do napake.', { success: false });
      }
    }
  }

  function handleDelete() {
    const index = state.partners.findIndex((candidate) => candidate.id === partnerId);
    const removed = state.partners[index];
    removePartner(state, partnerId);
    const success = savePartnersOrRollback(state, () => state.partners.splice(index, 0, removed));
    if (success) {
      showMessage('Partner odstranjen', { success: true });
      onPartnersChanged();
    } else {
      showMessage('Pri odstranjevanju partnerja je prišlo do napake.', { success: false });
    }
    return success;
  }

  saveButton.addEventListener('click', handleSave);
  secondaryButton.addEventListener('click', () => {
    if (isNew) {
      onCancel();
      return;
    }
    if (handleDelete()) {
      row.remove();
      onDeleted();
    }
  });

  refreshSaveEnabled();
  refreshErrors();

  return {
    element: row,
    scrollIntoView() {
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
  };
}

/**
 * Persists `state.partners` (whole-list write-through, plan §5.1); on
 * failure, runs `revert` to undo the just-applied in-memory mutation before
 * returning (plan §5.4 "Persistence + feedback").
 */
function savePartnersOrRollback(state, revert) {
  const success = savePartners(state.partners);
  if (!success) revert();
  return success;
}

// --- Rendering ---------------------------------------------------------------

/**
 * Renders the Partnerji tab's partner list into `container`, bound to
 * `state.partners`.
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 * @param {{
 *   showMessage: (text: string, options: {success: boolean}) => void,
 *   onPartnersChanged: () => void,
 * }} deps
 */
export function renderPartnerList(container, state, { showMessage, onPartnersChanged }) {
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'partner-list-wrapper';

  const toolbar = document.createElement('div');
  toolbar.className = 'partner-toolbar';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'partner-add-button';
  addButton.setAttribute('aria-label', 'Dodaj partnerja');
  addButton.textContent = '+';

  toolbar.appendChild(addButton);

  const table = document.createElement('table');
  table.className = 'partner-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  for (const label of ['ID', 'Naziv', 'Koda države', 'ID za DDV', '', '']) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  table.append(thead, tbody);

  const emptyMessage = document.createElement('p');
  emptyMessage.className = 'empty-state';
  emptyMessage.textContent = 'Brez shranjenih partnerjev.';

  let renderedRowCount = 0;
  let activeNewRow = null;

  function updateEmptyState() {
    emptyMessage.hidden = renderedRowCount > 0;
  }

  function addRowForPartner(partner) {
    const row = buildPartnerRow(partner, false, state, {
      showMessage,
      onPartnersChanged,
      onCancel: () => {}, // never called for a saved row (no cancel button)
      onSaved: () => {}, // never called for an already-saved row
      onDeleted: () => {
        renderedRowCount -= 1;
        updateEmptyState();
      },
    });
    tbody.appendChild(row.element);
    renderedRowCount += 1;
    updateEmptyState();
  }

  addButton.addEventListener('click', () => {
    if (activeNewRow) {
      activeNewRow.scrollIntoView();
      return;
    }

    const blankPartner = { id: null, name: '', countryCode: '', vatId: '' };
    const row = buildPartnerRow(blankPartner, true, state, {
      showMessage,
      onPartnersChanged,
      onCancel: () => {
        row.element.remove();
        activeNewRow = null;
        renderedRowCount -= 1;
        updateEmptyState();
      },
      onSaved: () => {
        // Row stays on screen, now representing the saved partner — only
        // the "one unsaved new row" tracking is cleared.
        activeNewRow = null;
      },
      onDeleted: () => {
        renderedRowCount -= 1;
        updateEmptyState();
      },
    });
    tbody.appendChild(row.element);
    renderedRowCount += 1;
    activeNewRow = row;
    updateEmptyState();
    row.scrollIntoView();
  });

  for (const partner of state.partners) {
    addRowForPartner(partner);
  }
  updateEmptyState();

  wrapper.append(toolbar, table, emptyMessage);
  container.appendChild(wrapper);
}

// General-section form view: renders the Glava fields (spec §5) and binds
// them to `state`, using the finalized Slovenian "Naziv polja" labels.
//
// The only DOM-touching module for the general section. Re-validates on
// every change via validate.js (single source of truth for both live inline
// errors and the eventual Download gate, plan §4) and updates only the
// affected error text in place — the form is built once and never
// wholesale re-rendered, so typing never loses focus or cursor position.
//
// Error visibility follows the shared "touched" rule (view/touch.js): a
// field's error stays hidden until the user has interacted with that field
// (input/change, or blur without a change), and `revealErrors()` (returned
// from renderGeneral) lets the future Download gate reveal every remaining
// error at once, regardless of what the user has touched.

import { updateGeneral } from '../state.js';
import { validateGeneral } from '../validate.js';
import { createTouchTracker } from './touch.js';

const MONTH_LABELS = [
  'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
  'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December',
];

const QUARTER_LABELS = ['1. četrtletje', '2. četrtletje', '3. četrtletje', '4. četrtletje'];

function periodUnitLabelText(periodType) {
  return periodType === 'quarterly' ? 'Četrtletje' : 'Mesec';
}

function periodUnitOptions(periodType) {
  const labels = periodType === 'quarterly' ? QUARTER_LABELS : MONTH_LABELS;
  return labels.map((label, index) => ({ value: index + 1, label }));
}

function buildField(id, labelText) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  wrapper.appendChild(label);

  return wrapper;
}

function buildCheckboxField(id, labelText, checked) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field field-checkbox';

  const label = document.createElement('label');

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.name = id;
  input.checked = Boolean(checked);

  const text = document.createElement('span');
  text.textContent = labelText;

  label.append(input, text);
  wrapper.appendChild(label);

  return { wrapper, input };
}

function buildError(id) {
  const error = document.createElement('p');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('role', 'alert');
  return error;
}

function buildTextInput(id, value) {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.name = id;
  input.value = value ?? '';
  input.setAttribute('aria-describedby', `${id}-error`);
  return input;
}

function populateSelectOptions(select, options, { placeholder = true } = {}) {
  select.replaceChildren();
  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '— izberite —';
    select.appendChild(placeholderOption);
  }
  for (const { value, label } of options) {
    const option = document.createElement('option');
    option.value = String(value);
    option.textContent = label;
    select.appendChild(option);
  }
}

function buildSelect(id, options, config) {
  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  select.setAttribute('aria-describedby', `${id}-error`);
  populateSelectOptions(select, options, config);
  return select;
}

// Field ids that carry a validation error (i.e. every field except the two
// plain checkboxes, which have no rule to enforce — spec §7).
const VALIDATED_FIELD_IDS = ['tax-payer-id', 'period-type', 'period-unit', 'period-year'];

/**
 * Renders the general-section form into `container`, bound to `state.general`.
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 * @returns {{revealErrors: () => void}} `revealErrors` marks every general
 *   field touched and re-renders errors; the Download gate calls this so
 *   clicking Download surfaces all remaining errors at once.
 */
export function renderGeneral(container, state) {
  container.replaceChildren();

  const touch = createTouchTracker();

  const form = document.createElement('div');
  form.className = 'general-form';

  // Davčna številka zavezanca (TaxPayerID)
  const taxPayerIdField = buildField('tax-payer-id', 'Davčna številka zavezanca');
  const taxPayerIdInput = buildTextInput('tax-payer-id', state.general.taxPayerID);
  taxPayerIdInput.inputMode = 'numeric';
  taxPayerIdInput.maxLength = 8;
  const taxPayerIdError = buildError('tax-payer-id');
  taxPayerIdField.append(taxPayerIdInput, taxPayerIdError);
  taxPayerIdInput.addEventListener('input', () => {
    updateGeneral(state, { taxPayerID: taxPayerIdInput.value });
    touch.touch('tax-payer-id');
    refreshErrors();
  });
  taxPayerIdInput.addEventListener('blur', () => {
    touch.touch('tax-payer-id');
    refreshErrors();
  });

  // Vrsta obdobja poročanja (periodType) — Mesečno / Četrtletno
  const periodTypeField = buildField('period-type', 'Vrsta obdobja poročanja');
  const periodTypeSelect = buildSelect(
    'period-type',
    [
      { value: 'monthly', label: 'Mesečno' },
      { value: 'quarterly', label: 'Četrtletno' },
    ],
    { placeholder: false },
  );
  periodTypeSelect.value = state.general.periodType;
  const periodTypeError = buildError('period-type');
  periodTypeField.append(periodTypeSelect, periodTypeError);

  // Mesec / Četrtletje (periodUnit) — label and option set depend on periodType
  const periodUnitField = buildField('period-unit', periodUnitLabelText(state.general.periodType));
  const periodUnitLabel = periodUnitField.querySelector('label');
  const periodUnitSelect = buildSelect('period-unit', periodUnitOptions(state.general.periodType));
  periodUnitSelect.value = state.general.periodUnit ? String(state.general.periodUnit) : '';
  const periodUnitError = buildError('period-unit');
  periodUnitField.append(periodUnitSelect, periodUnitError);

  periodTypeSelect.addEventListener('change', () => {
    updateGeneral(state, { periodType: periodTypeSelect.value, periodUnit: '' });
    periodUnitLabel.textContent = periodUnitLabelText(state.general.periodType);
    populateSelectOptions(periodUnitSelect, periodUnitOptions(state.general.periodType));
    periodUnitSelect.value = '';
    touch.touch('period-type');
    // periodUnit's value/options were just reset as a side effect of this
    // change; surface its required error immediately rather than waiting
    // for a separate touch on that field.
    touch.touch('period-unit');
    refreshErrors();
  });
  periodTypeSelect.addEventListener('blur', () => {
    touch.touch('period-type');
    refreshErrors();
  });

  periodUnitSelect.addEventListener('change', () => {
    updateGeneral(state, { periodUnit: periodUnitSelect.value });
    touch.touch('period-unit');
    refreshErrors();
  });
  periodUnitSelect.addEventListener('blur', () => {
    touch.touch('period-unit');
    refreshErrors();
  });

  // Leto (periodYear)
  const periodYearField = buildField('period-year', 'Leto');
  const periodYearInput = buildTextInput('period-year', state.general.periodYear);
  periodYearInput.inputMode = 'numeric';
  periodYearInput.maxLength = 4;
  const periodYearError = buildError('period-year');
  periodYearField.append(periodYearInput, periodYearError);
  periodYearInput.addEventListener('input', () => {
    updateGeneral(state, { periodYear: periodYearInput.value });
    touch.touch('period-year');
    refreshErrors();
  });
  periodYearInput.addEventListener('blur', () => {
    touch.touch('period-year');
    refreshErrors();
  });

  // Zahtevam vračilo presežka DDV (VRACILO) — no validation rule, plain checkbox
  const vraciloField = buildCheckboxField(
    'vracilo',
    'Zahtevam vračilo presežka DDV',
    state.general.vracilo,
  );
  vraciloField.input.addEventListener('change', () => {
    updateGeneral(state, { vracilo: vraciloField.input.checked });
  });

  // Izračunavam odbitni delež (ODBDELEZ) — no validation rule, plain checkbox
  const odbdelezField = buildCheckboxField(
    'odbdelez',
    'Izračunavam odbitni delež',
    state.general.odbdelez,
  );
  odbdelezField.input.addEventListener('change', () => {
    updateGeneral(state, { odbdelez: odbdelezField.input.checked });
  });

  function shownError(fieldId, message) {
    return touch.isTouched(fieldId) ? message ?? '' : '';
  }

  function refreshErrors() {
    const errors = validateGeneral(state.general);
    taxPayerIdError.textContent = shownError('tax-payer-id', errors.taxPayerID);
    periodTypeError.textContent = shownError('period-type', errors.periodType);
    periodUnitError.textContent = shownError('period-unit', errors.periodUnit);
    periodYearError.textContent = shownError('period-year', errors.periodYear);
  }

  /**
   * Marks every general-section field touched and re-renders errors. Called
   * by the Download gate (Chunk 8) so clicking Download reveals all
   * remaining errors at once, including fields the user never interacted with.
   */
  function revealErrors() {
    touch.touchAll(VALIDATED_FIELD_IDS);
    refreshErrors();
  }

  refreshErrors();

  form.append(
    taxPayerIdField,
    periodTypeField,
    periodUnitField,
    periodYearField,
    vraciloField.wrapper,
    odbdelezField.wrapper,
  );
  container.appendChild(form);

  return { revealErrors };
}

// Pure(-ish) field-spec -> DOM builders shared by every entry-list view
// (view/entryList.js, and transitively view/kirList.js / view/kprList.js).
//
// A "field spec" is a plain object { key, label, type, maxLength? } where
// type is one of 'text' | 'date' | 'country' | 'amount' (view/entryList.js's
// config.fields). This module knows how to turn one field spec + a current
// value into a fully-wired-for-display (but not yet event-bound) DOM group,
// and how to derive an all-blank fields object from a field-spec array.
//
// No touch/validation/state logic lives here — this is presentation only.

import { COUNTRIES } from '../countries.js';

function todayLocalISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildLabel(id, labelText) {
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = labelText;
  return label;
}

/**
 * Builds a field's inline error paragraph: `role="alert"`, id `{id}-error`
 * (the target of the field's `aria-describedby`). Shared by every view that
 * needs a standalone error slot outside a full buildFieldGroup() trio (e.g.
 * view/partnerList.js's table cells).
 */
export function buildErrorText(id) {
  const error = document.createElement('p');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('role', 'alert');
  return error;
}

function buildTextInput(id, value, { maxLength } = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.name = id;
  input.value = value ?? '';
  input.setAttribute('aria-describedby', `${id}-error`);
  if (maxLength) input.maxLength = maxLength;
  return input;
}

function buildAmountInput(id, value) {
  const input = buildTextInput(id, value);
  input.inputMode = 'decimal';
  return input;
}

function buildDateInput(id, value) {
  const input = document.createElement('input');
  input.type = 'date';
  input.id = id;
  input.name = id;
  input.value = value ?? '';
  input.max = todayLocalISODate();
  input.setAttribute('aria-describedby', `${id}-error`);
  return input;
}

/**
 * Builds the shared country `<select>` (the same control/option set as the
 * KIR/KPR country fields): a "— izberite —" placeholder plus one option per
 * COUNTRIES entry, emitting ISO codes as values. Reused as-is by
 * view/partnerList.js for the "Koda države" column (plan 0006 §5.4).
 */
export function buildCountrySelect(id, value) {
  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  select.setAttribute('aria-describedby', `${id}-error`);

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = '— izberite —';
  select.appendChild(placeholderOption);

  for (const country of COUNTRIES) {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    select.appendChild(option);
  }

  select.value = value ?? '';
  return select;
}

function buildInputForField(id, field, value) {
  switch (field.type) {
    case 'date':
      return buildDateInput(id, value);
    case 'country':
      return buildCountrySelect(id, value);
    case 'amount':
      return buildAmountInput(id, value);
    case 'text':
    default:
      return buildTextInput(id, value, { maxLength: field.maxLength });
  }
}

/**
 * Builds one field's { wrapper, input, error } trio for a field spec
 * ({ key, label, type, maxLength? }) and its current value. The caller
 * attaches its own event listeners to `input` and appends `wrapper` into
 * the row's grid.
 *
 * @param {string} id - unique DOM id for this field within the whole page
 * @param {{key: string, label: string, type: 'text'|'date'|'country'|'amount', maxLength?: number}} field
 * @param {*} value - the field's current stored value
 */
export function buildFieldGroup(id, field, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const input = buildInputForField(id, field, value);
  const error = buildErrorText(id);

  wrapper.append(buildLabel(id, field.label), input, error);

  return { wrapper, input, error };
}

/**
 * The DOM event that signals a value change for a field of this type
 * (selects fire 'change'; text/date/amount inputs fire 'input' as the user
 * types).
 */
export function changeEventFor(field) {
  return field.type === 'country' ? 'change' : 'input';
}

/**
 * Derives a fresh, all-blank fields object from a field-spec array — e.g.
 * for seeding a newly added entry before the user has typed anything.
 *
 * @param {{key: string}[]} fields
 * @returns {Record<string, ''>}
 */
export function emptyFieldsFromSpec(fields) {
  const emptyFields = {};
  for (const field of fields) emptyFields[field.key] = '';
  return emptyFields;
}

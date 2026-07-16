// Persist-controls view: renders the "Zapomni si" / "Pozabi" action row for
// the Glava section (spec §5, §6). The only DOM-touching module for this
// feature's controls — save/forget calls go straight to generalStore.js,
// which has no DOM access of its own.
//
// Owns three small pieces of UI state per plan §6.3/§6.5/§6.6:
//   - "Pozabi" enabled/disabled, computed from hasSavedGeneral() and
//     refreshed after every *successful* save/forget (a failed action
//     leaves it unchanged).
//   - Each button's own transient feedback slot (green check on success,
//     red circle-with-X + "Poskusite znova." on failure), auto-hidden after
//     3 seconds; a fresh click on the same button resets the timer to the
//     latest outcome.

import { forgetGeneral, hasSavedGeneral, saveGeneral } from '../generalStore.js';

const FEEDBACK_DURATION_MS = 3000;

/**
 * Builds one feedback slot: an aria-hidden icon + an accessible text span,
 * wrapped in a role="status" live region. Returns a `show(success, message)`
 * function that displays the outcome for FEEDBACK_DURATION_MS, resetting
 * any pending hide timer on repeat calls.
 */
function createFeedbackSlot() {
  const element = document.createElement('span');
  element.className = 'persist-feedback';
  element.setAttribute('role', 'status');
  element.hidden = true;

  const icon = document.createElement('span');
  icon.className = 'persist-feedback-icon';
  icon.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'persist-feedback-text';

  element.append(icon, text);

  let hideTimer = null;

  function show(success, message) {
    element.classList.toggle('persist-feedback-success', success);
    element.classList.toggle('persist-feedback-error', !success);
    text.textContent = message;
    element.hidden = false;

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      element.hidden = true;
    }, FEEDBACK_DURATION_MS);
  }

  return { element, show };
}

/**
 * Renders the "Zapomni si" / "Pozabi" persist-controls row into `container`,
 * bound to `state.general` (plan §5).
 *
 * @param {HTMLElement} container
 * @param {object} state - the full application state (plan §4 "state")
 */
export function renderPersistControls(container, state) {
  container.replaceChildren();

  const row = document.createElement('div');
  row.className = 'persist-row';

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'persist-button';
  saveButton.textContent = 'Zapomni si';
  const saveFeedback = createFeedbackSlot();

  const forgetButton = document.createElement('button');
  forgetButton.type = 'button';
  forgetButton.className = 'persist-button forget';
  forgetButton.textContent = 'Pozabi';
  const forgetFeedback = createFeedbackSlot();

  function refreshForgetEnabled() {
    forgetButton.disabled = !hasSavedGeneral();
  }

  saveButton.addEventListener('click', () => {
    const success = saveGeneral(state.general);
    saveFeedback.show(success, success ? 'Shranjeno' : 'Poskusite znova.');
    if (success) refreshForgetEnabled();
  });

  forgetButton.addEventListener('click', () => {
    const success = forgetGeneral();
    forgetFeedback.show(success, success ? 'Pozabljeno' : 'Poskusite znova.');
    if (success) refreshForgetEnabled();
  });

  refreshForgetEnabled();

  row.append(saveButton, saveFeedback.element, forgetButton, forgetFeedback.element);
  container.appendChild(row);
}

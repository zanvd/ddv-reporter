// Shared bottom-right transient message bubble (plan 0006 §5.5), used by the
// three partner actions (add/update/remove) to show a success/error message.
//
// Structurally close to persistControls.js's createFeedbackSlot() (same
// last-action-wins single slot, same 3000 ms auto-dismiss, same role="status"
// live region), but mounted once as a page-level fixed bubble rather than an
// inline slot next to a specific pair of buttons — so any view can share it
// via the single showMessage() call returned here.
//
// No last-action-wins queueing/stacking: a new message immediately replaces
// whatever is currently showing and restarts the auto-dismiss timer (spec §6).

const FEEDBACK_DURATION_MS = 3000;

/**
 * Renders the shared message bubble into `container` (plan §5.9: an empty
 * `<div id="message-bubble">` under `<main>`).
 *
 * @param {HTMLElement} container
 * @returns {{showMessage: (text: string, options: {success: boolean}) => void}}
 */
export function renderMessageBubble(container) {
  container.replaceChildren();

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.setAttribute('role', 'status');
  bubble.hidden = true;

  container.appendChild(bubble);

  let hideTimer = null;

  function showMessage(text, { success }) {
    bubble.classList.toggle('message-bubble-success', success);
    bubble.classList.toggle('message-bubble-error', !success);
    bubble.textContent = text;
    bubble.hidden = false;

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubble.hidden = true;
    }, FEEDBACK_DURATION_MS);
  }

  return { showMessage };
}

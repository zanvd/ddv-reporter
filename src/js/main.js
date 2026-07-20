// Bootstraps the app: owns the single in-memory state instance and wires it
// to the view layer (plan §4 "Data flow"). No logic of its own beyond
// wiring — derivation, validation, and serialization stay in their own
// pure modules.

import { derivePeriod } from './derive.js';
import { buildDownloadFilename, downloadJson } from './download.js';
import { loadGeneral } from './generalStore.js';
import { loadPartners } from './partnerStore.js';
import { serialize } from './serialize.js';
import { createState, seedPartners, updateGeneral } from './state.js';
import { hasAnyErrors, validateState } from './validate.js';
import { renderGeneral } from './view/general.js';
import { renderKirList } from './view/kirList.js';
import { renderKprList } from './view/kprList.js';
import { renderMessageBubble } from './view/messageBubble.js';
import { renderPartnerList } from './view/partnerList.js';
import { renderPersistControls } from './view/persistControls.js';
import { initTabs } from './view/tabs.js';
import { initThemeToggle } from './view/themeToggle.js';

const state = createState();

// Auto-restore the saved Glava record (if any) before the general view is
// built, so the form renders already prefilled (spec 0002 §6.4). KIR/KPR
// are never restored — they always start empty.
const restoredGeneral = loadGeneral();
if (restoredGeneral) updateGeneral(state, restoredGeneral);

// Partners, unlike Glava, are always restored (plan 0006 §5.2) — the
// Partnerji tab is itself a persisted list, not an opt-in "remembered" copy.
seedPartners(state, loadPartners());

// Each view mounts into an inner content <div>, not the whole <section>,
// so its container.replaceChildren() never wipes out the section's static
// <h2> heading.
const generalContainer = document.getElementById('general-content');
const kirContainer = document.getElementById('kir-content');
const kprContainer = document.getElementById('kpr-content');
const generalPersistContainer = document.getElementById('general-persist');
const partnerContainer = document.getElementById('partner-content');
const messageBubbleContainer = document.getElementById('message-bubble');

// The Download gate calls revealErrors() on all three report-form views so
// clicking Download surfaces every remaining error at once, even for fields
// the user never touched.
const generalView = renderGeneral(generalContainer, state);
const kirView = renderKirList(kirContainer, state);
const kprView = renderKprList(kprContainer, state);

// Restored Glava fields are treated as already "touched", so any stale or
// now-invalid restored value surfaces its error immediately rather than
// staying quiet until the user happens to interact with that field (spec
// 0002 §6.4 — a deliberate, feature-specific deviation from the app's
// normal quiet-until-touched rule; a fresh, non-restored form is unaffected).
if (restoredGeneral) generalView.revealErrors();

renderPersistControls(generalPersistContainer, state);

const { showMessage } = renderMessageBubble(messageBubbleContainer);

// Chunk 5 wires the KIR/KPR "add … partnerja" buttons' enabled state to this
// callback (kirView.refreshPartnerButton()/kprView.refreshPartnerButton()),
// so adding the first partner here enables those buttons on the Poročilo
// tab (plan §5.8). No-op until that wiring lands.
function onPartnersChanged() {}

renderPartnerList(partnerContainer, state, { showMessage, onPartnersChanged });

initTabs(document.querySelector('[role="tablist"]'));
initThemeToggle(document.getElementById('theme-toggle'));

const downloadButton = document.getElementById('download-button');
const downloadMessage = document.getElementById('download-message');

// One delegated listener (not the per-view onChange hook we removed): while
// the "form has errors" banner is showing, clear it as soon as the form
// becomes fully valid again, without waiting for another Download click.
// 'input'/'change' bubble up from every text/date input and country
// <select> in all three views, so a single document-level listener suffices.
function clearDownloadMessageIfNowValid() {
  if (!downloadMessage.textContent) return;
  if (!hasAnyErrors(validateState(state))) {
    downloadMessage.textContent = '';
  }
}
document.addEventListener('input', clearDownloadMessageIfNowValid);
document.addEventListener('change', clearDownloadMessageIfNowValid);

downloadButton.addEventListener('click', () => {
  const validation = validateState(state);

  if (hasAnyErrors(validation)) {
    generalView.revealErrors();
    kirView.revealErrors();
    kprView.revealErrors();
    downloadMessage.textContent = 'Obrazec vsebuje napake. Popravite označena polja.';
    return;
  }

  downloadMessage.textContent = '';

  const period = derivePeriod({
    periodType: state.general.periodType,
    periodUnit: Number(state.general.periodUnit),
    periodYear: Number(state.general.periodYear),
  });
  const filename = buildDownloadFilename(
    String(state.general.taxPayerID).trim(),
    period.OBDOBJE_OD,
    period.OBDOBJE_DO,
  );

  downloadJson(filename, serialize(state));
});

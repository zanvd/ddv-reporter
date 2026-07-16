// Bootstraps the app: owns the single in-memory state instance and wires it
// to the view layer (plan §4 "Data flow"). No logic of its own beyond
// wiring — derivation, validation, and serialization stay in their own
// pure modules.

import { derivePeriod } from './derive.js';
import { buildDownloadFilename, downloadJson } from './download.js';
import { serialize } from './serialize.js';
import { createState } from './state.js';
import { hasAnyErrors, validateState } from './validate.js';
import { renderGeneral } from './view/general.js';
import { renderKirList } from './view/kirList.js';
import { renderKprList } from './view/kprList.js';

const state = createState();

// Each view mounts into an inner content <div>, not the whole <section>,
// so its container.replaceChildren() never wipes out the section's static
// <h2> heading.
const generalContainer = document.getElementById('general-content');
const kirContainer = document.getElementById('kir-content');
const kprContainer = document.getElementById('kpr-content');

// The Download gate calls revealErrors() on all three views so clicking
// Download surfaces every remaining error at once, even for fields the
// user never touched.
const generalView = renderGeneral(generalContainer, state);
const kirView = renderKirList(kirContainer, state);
const kprView = renderKprList(kprContainer, state);

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

// Tab controller for the Poročilo / Pomoč tab bar (plan §4). DOM-only, no
// state module, no storage, no URL — switching tabs is a pure show/hide of
// already-mounted panels via the native `hidden` attribute, so the Poročilo
// form's in-progress state (values, validation, revealed errors) survives a
// round-trip to Pomoč untouched (spec §4).

const ARROW_STEP = { ArrowLeft: -1, ArrowRight: 1 };

export function initTabs(tablistEl) {
  const tabs = Array.from(tablistEl.querySelectorAll('[role="tab"]'));

  function selectTab(tab) {
    for (const candidate of tabs) {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(candidate.getAttribute('aria-controls'));
      panel.hidden = !selected;
    }
    tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab));
  }

  tablistEl.addEventListener('keydown', (event) => {
    const step = ARROW_STEP[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const currentIndex = tabs.indexOf(document.activeElement);
    const nextIndex = (currentIndex + step + tabs.length) % tabs.length;
    selectTab(tabs[nextIndex]);
  });
}

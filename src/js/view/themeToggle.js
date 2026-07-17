// Theme-toggle controller (plan 0004 §3.3). DOM-only: flips the resolved
// data-theme attribute, persists the explicit choice (best-effort), and
// keeps the button's accessible name in sync with the active theme. Touches
// nothing else — no app data, validation state, active tab, or scroll
// position (spec §5, §9).

import { saveTheme } from '../themeStore.js';

const LABEL = {
  light: 'Preklopi na temni način', // light active -> offer dark
  dark: 'Preklopi na svetli način', // dark active  -> offer light
};

export function initThemeToggle(buttonEl) {
  const root = document.documentElement;

  function sync() {
    buttonEl.setAttribute('aria-label', LABEL[root.dataset.theme] || LABEL.light);
  }

  sync(); // correct the static (light-mode) label to the pre-paint-resolved theme

  buttonEl.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next; // instant visual swap; all tokens re-resolve
    saveTheme(next); // failure-tolerant; return value ignored (spec §5)
    sync();
  });
}

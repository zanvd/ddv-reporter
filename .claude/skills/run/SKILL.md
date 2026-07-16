---
name: run
description: Launch and drive the DDV Reporter app in a real (headless) browser to confirm it works end-to-end — renders, validates, gates, and downloads a correct FURS DDV_KIR_KPR JSON file. Use when asked to run/start/smoke-test the app or to verify a UI change in the real app (not just the unit tests).
---

# Running the DDV Reporter

The app is a **standalone client-side web app** (vanilla HTML/CSS/ES-modules,
no build step) under `src/`. "Running it" means serving `src/`, driving a real
browser against it, and confirming the full flow: form renders → validation
gates the Download → a correctly-named, correctly-shaped JSON file is produced.

There is **no `chromium-cli` or Playwright** in this environment, but
`google-chrome-stable` is present, so we drive headless Chrome over the DevTools
Protocol with a small Node script (`smoke.mjs`, next to this file). Node 18+
only — it uses global `fetch`/`WebSocket`, no dependencies.

## 1. Serve the app (ES modules require http, not file://)

From the repo root:

```bash
python3 -m http.server 8137 --directory src &
timeout 15 bash -c 'until curl -sf http://localhost:8137/index.html >/dev/null; do sleep 0.5; done'
```

Stop it when done with `pkill -f "http.server 8137"` (or `kill <pid>`). Relaunch
after killing, or you hit `Address already in use`.

## 2. Launch headless Chrome with remote debugging

```bash
rm -rf /tmp/ddv-chrome-profile
nohup google-chrome-stable --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9222 --user-data-dir=/tmp/ddv-chrome-profile \
  about:blank >/tmp/ddv-chrome.log 2>&1 &
timeout 20 bash -c 'until curl -sf http://localhost:9222/json/version >/dev/null; do sleep 0.5; done'
```

Stop with `pkill -f "remote-debugging-port=9222"`. (`--no-sandbox` is required
in this container.)

## 3. Drive it + assert

```bash
node .claude/skills/run/smoke.mjs
```

Exits `0` if all checks pass, `1` on a failed check, `2` on a driver error.
Screenshots land in `/tmp/ddv-smoke/screenshots/` (override with `OUT_DIR=…`),
the downloaded file in `/tmp/ddv-smoke/downloads/`. Env overrides: `APP_URL`,
`CDP_PORT`, `OUT_DIR`.

**Look at the screenshots** — `01-initial` (blank, no errors), `02`/`04`
(gated with revealed errors), `05` (filled), `06` (post-download). A blank frame
means the app failed to load.

## What the smoke run covers (one representative path)

Renders the three sections (Glava / Izdani računi (KIR) / Prejeti računi (KPR));
confirms **quiet-until-touched** (no errors on load); clicks Download on an empty
form and asserts it's **gated** with all required errors revealed and no file
written; fills the general section and one KIR entry, asserting the error banner
**auto-clears** once valid; then downloads and validates the file name
(`DDV_KIR_KPR_<TaxPayerID>_<OD>_<DO>.json`) and JSON shape (wrapped
`DDV_KIR_KPR` root, `Glava` flags, `ZAPST`/`OBRAVNAVA`, amounts as numbers, blank
optionals omitted, empty `Lista_KPR`). Finally asserts **no console errors**.

## Gotchas

- **Serve over http, not `file://`** — ES-module imports (`<script type="module">`)
  are blocked by CORS on `file://`, so serve the app (any static server) rather
  than opening it from disk.
- **`--no-sandbox`** is required for Chrome in this container.
- **Fill inputs via value + dispatched `input`/`change` events** (as `smoke.mjs`
  does) — the views listen for those; setting `.value` alone won't update state.
- **Kill Chrome and the server between runs** to avoid a stale profile lock and
  `Address already in use`.

## For pure logic, prefer the test suite

The domain logic (derive/validate/serialize/state) is covered by
`npm test` (run `node --test` from `src/`). Use this browser smoke test for the
UI/DOM/download paths the unit tests can't reach.

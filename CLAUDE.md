# DDV Reporter

A standalone, fully client-side web app that lets a Slovenian VAT payer enter
their VAT data and download a FURS-formatted **`DDV_KIR_KPR`** JSON file (the
KIR/KPR evidence records — *not* the DDV-O return). No backend, no persistence,
nothing leaves the browser.

## Workflow pipeline

Work flows through three custom agents (`.claude/agents/`), each producing the
input for the next. Every artifact shares a zero-padded numeric prefix and
basename across the three folders (e.g. `0001-...`):

1. **spec-planner** → `specs/NNNN-*.html` — product/requirements spec (the *what*).
2. **impl-planner** → `impls/NNNN-*.html` — technical/architecture plan (the *how*).
3. **implementer** → `src/` — working code + tests, built chunk-by-chunk with
   user approval after each chunk.

Specs and plans are self-contained HTML documents (inline `<style>`, no assets).

## Tech stack

- **Vanilla HTML + CSS + ES-module JavaScript. No build step, no framework, no
  runtime dependencies.** The app runs by opening/serving `src/` directly.
- Tests use Node's built-in runner. All test config lives under `src/`
  (`src/package.json`); there is intentionally **no `package.json` at the repo
  root**.

## Commands

- **Run tests:** `cd src && npm test` (i.e. `node --test`). Pure logic modules
  (`derive`, `validate`, `serialize`, `state`, `countries`) are unit-tested,
  plus `integration.test.js` for the full pipeline.
- **Run / smoke-test the app in a real browser:** see `.claude/skills/run/` —
  serve `src/`, drive headless Chrome over CDP with `node .claude/skills/run/smoke.mjs`.
  Use this for UI/DOM/download paths the unit tests can't reach.

## Conventions

- **Language.** ALL user-facing text is **Slovenian**, using FURS's official
  "Naziv polja" terminology for field labels (see spec §5/§6). This includes
  labels, validation/error messages, buttons, hints, and empty states. **Code
  itself stays English** — identifiers, comments, and developer-facing/internal
  error text (e.g. wiring-bug `Error()` throws) never seen by a user.
- **FURS wire-format identifiers stay verbatim** in the JSON output and as the
  canonical field names: P-codes (`P2`, `P14`, …), `Glava`, `Lista_KIR`,
  `Lista_KPR`, `OBDOBJE`, `OBRAVNAVA`, `ZAPST`, `TaxPayerID`, `VRACILO`,
  `ODBDELEZ`. In camelCase code identifiers, abbreviations keep their word
  boundaries — e.g. `ZAPST` (ZAporedna ŠTevilka) → `zapSt`/`setZapSt`, not
  `zapst`/`Zapst`. Never translate or rename these.
- **Import ordering.** Three blocks separated by a single blank line, in order:
  (1) Node built-ins (`node:*`), (2) external packages, (3) project-local
  (`./`/`../`). Omit empty groups. Within a group, sort statements alphabetically
  by module path; within a statement, sort named imports alphabetically
  (case-insensitive).
- **Architecture.** Pure logic modules (`derive`/`validate`/`serialize`/`state`/
  `countries`) are DOM-free and isolated from the `view/` layer. `validate.js` is
  the **single source of truth** for field errors (used for both live inline
  errors and the Download gate) — no parallel validation elsewhere. The two entry
  lists are data-driven: `view/entryList.js` + `view/fieldBuilders.js` render from
  per-type field-spec configs (`view/kirList.js`, `view/kprList.js`).
- **Output JSON.** Wrapped root `{ "DDV_KIR_KPR": { Glava, Lista_KIR, Lista_KPR } }`;
  header flags as native `true`/`false`; `OBRAVNAVA` always the string `"1"`;
  blank optional amounts **omitted** (not `0`); pretty-printed (2-space).
- **Validation UX.** Errors are quiet until a field is touched (input/change or
  blur); the Download gate reveals every remaining error at once via each view's
  `revealErrors()`.
- **KISS / YAGNI.** Simplest thing that satisfies the spec/plan. No speculative
  hooks, layers, or dependencies — every added piece of complexity must earn its
  place against a requirement.
- **Commit messages.** Follow Commitizen/Conventional Commits: `type: subject`
  (e.g. `feat:`, `fix:`, `test:`, `chore:`, `ci:`, `docs:`, `refactor:`), imperative
  mood, no capitalized first letter after the colon, no trailing period.

## Domain gotchas

- The **KIR/KPR evidence records are not the DDV-O return.** DDV-O is a separate
  summary form (whole-euro amounts, XML-only). The KIR/KPR records here carry
  actual invoice values and **allow up to 2 decimal places**; do not apply
  DDV-O's whole-euro rule to them.
- Greece: validation accepts both `GR` and `EL`; the country dropdown offers
  Greece once and emits `GR`.
- Amounts are stored/validated as strings and serialized as JSON **numbers**.
- Validation is hand-rolled per FURS's rules. The authoritative FURS artifacts
  live in `reference/`: `DDV_KIR_KPR_schema.json` (official JSON Schema),
  `KIR_KPR_rules.xlsx` (business rules), `DDV_KIR_KPR_fields.xlsx` (field
  definitions), and `KIR_KPR_example.json` (example). The app's output has been
  validated against the official schema, and its validation rules confirmed
  against the pravila. See `reference/README.md` for how to validate a produced
  file.

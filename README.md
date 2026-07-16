# DDV Reporter

A standalone, client-side web app for producing Slovenian VAT (DDV) KIR/KPR
evidence records. You enter your issued (KIR) and received (KPR) invoice data in
a form and download a FURS-formatted `DDV_KIR_KPR` JSON file. Everything runs in
the browser; no data leaves your machine and there is no backend.

Live version is available at: https://zanvd.github.io/ddv-reporter/

## Usage

The app is plain HTML/CSS/JavaScript with no build step. Because it uses ES
modules, serve the `src/` directory over HTTP rather than opening the file
directly:

```bash
cd src
python3 -m http.server 8137
```

Then open http://localhost:8137 and:

1. Fill in the header (Glava): tax number, reporting period, and the two flags.
2. Add any number of issued-invoice (KIR) and received-invoice (KPR) entries.
3. Click "Prenesi JSON" to download the file. If the form has errors, they are
   highlighted and the download is blocked until they are fixed.

The downloaded file is named `DDV_KIR_KPR_<taxNumber>_<periodStart>_<periodEnd>.json`.

## Development

No dependencies to install. Tests use Node's built-in runner:

```bash
cd src
npm test
```

Source and tests live under `src/`. See `CLAUDE.md` for project conventions and
`.claude/skills/run/` for the browser smoke test.

# FURS reference artifacts

Authoritative source documents for the `DDV_KIR_KPR` (KIR/KPR) evidence records,
from the FURS eDavki technical package ("Priloge"):
https://beta.edavki.durs.si/EdavkiPortal/OpenPortal/CommonPages/Opdynp/PageD.aspx?category=spletni_servis_za_sprejem_kir_kpr

These are references only; the app does not read them at runtime.

Files are locally renamed for clarity; the original FURS package name is noted
in each description.

| File | What it is |
|------|------------|
| `DDV_KIR_KPR_schema.json` | The official JSON Schema for the output file (FURS: `DDV_KIR_KPR_1.json`). The compliance contract. |
| `KIR_KPR_rules.xlsx` | The business validation rules "Kontrole" the app's `validate.js` implements (FURS: `KIR_KPR_pravila.xlsx`). |
| `DDV_KIR_KPR_fields.xlsx` | Field definitions: each P-code, its meaning, obligation (required/optional), and DDV-O box mapping (FURS: `DDV_KIR_KPR_Polja.xlsx`). |
| `KIR_KPR_example.json` | An official example document, every field populated (FURS: `primer_KIR_KPR.json`). |

Only the JSON-relevant artifacts are kept here. The package's XSDs, XML/CSV
examples, WSDLs, `swagger.json`, and web-service docs concern the submission API,
which is out of scope for this download-only app.

## Validating a produced file against the official schema

The schema is JSON Schema draft-04 and uses the `date-time` format, so a
format-aware validator is required. `rfc3339-validator` makes the `date-time`
check real (without it, the date `oneOf` branches both match and report false
errors).

```bash
pip install jsonschema rfc3339-validator

python3 - path/to/downloaded.json <<'PY'
import json, sys
from jsonschema import Draft4Validator, FormatChecker
schema = json.load(open('reference/DDV_KIR_KPR_schema.json'))
doc = json.load(open(sys.argv[1]))
errs = sorted(Draft4Validator(schema, format_checker=FormatChecker()).iter_errors(doc),
              key=lambda e: list(e.path))
for e in errs:
    print('/'.join(map(str, e.path)) or '<root>', ':', e.message)
print('VALID' if not errs else f'{len(errs)} error(s)')
PY
```

The schema is intentionally loose in places the rules file tightens (e.g. it
accepts any 2-letter country code, while `KIR_KPR_rules.xlsx` restricts the set
to EU + SI + XI, with GR/EL for Greece). The app enforces the stricter rules.

// Pure state -> DDV_KIR_KPR JSON serialization.
//
// Assumes the state has already passed validate.js's Download gate (plan §4
// "Data flow"): this module does not re-validate, it maps form-state field
// names to FURS field codes and produces the exact document shape FURS
// expects, then JSON.stringify's it.
//
// Kept independent of validate.js — derive/validate/serialize are parallel
// pure modules per the plan's architecture, each fed directly from state.

import { normalizeCountryCode } from './countries.js';
import { deriveFlags, derivePeriod } from './derive.js';

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

/** Parses a validated amount string/number into a JSON-safe number. */
function toAmount(value) {
  return Number(String(value).trim());
}

/**
 * Maps one KIR (charged/output) form-state entry to its FURS-coded object
 * (plan §3.2). Blank optional amounts and the P6/P6DS pair are omitted
 * entirely rather than written as 0/"" (spec §6, §8).
 */
function buildKirEntry(entry, index, obdobje) {
  const out = {
    ZAPST: index + 1,
    OBDOBJE: obdobje,
    OBRAVNAVA: '1',
    P2: entry.postingDate,
    P3: String(entry.documentNumber).trim(),
    P4: entry.documentDate,
  };

  if (!isBlank(entry.customerCountry)) out.P6 = normalizeCountryCode(entry.customerCountry);
  if (!isBlank(entry.customerVatId)) out.P6DS = String(entry.customerVatId).trim();
  if (!isBlank(entry.netValue)) out.P7 = toAmount(entry.netValue);
  if (!isBlank(entry.vat22)) out.P14 = toAmount(entry.vat22);
  if (!isBlank(entry.vat95)) out.P15 = toAmount(entry.vat95);
  if (!isBlank(entry.vat5)) out.P16 = toAmount(entry.vat5);

  return out;
}

/**
 * Maps one KPR (deducted/input) form-state entry to its FURS-coded object
 * (plan §3.3). Blank optional amounts are omitted entirely.
 */
function buildKprEntry(entry, index, obdobje) {
  const out = {
    ZAPST: index + 1,
    OBDOBJE: obdobje,
    OBRAVNAVA: '1',
    P2: entry.postingDate,
    P3: String(entry.documentNumber).trim(),
    P4: entry.dateReceived,
    P5: entry.documentDate,
    P6: String(entry.supplierName).trim(),
    P7: normalizeCountryCode(entry.supplierCountry),
    P7DS: String(entry.supplierVatId).trim(),
  };

  if (!isBlank(entry.netValue)) out.P8 = toAmount(entry.netValue);
  if (!isBlank(entry.deductVat22)) out.P18 = toAmount(entry.deductVat22);
  if (!isBlank(entry.deductVat95)) out.P19 = toAmount(entry.deductVat95);
  if (!isBlank(entry.deductVat5)) out.P20 = toAmount(entry.deductVat5);
  if (!isBlank(entry.flatRate8)) out.P21 = toAmount(entry.flatRate8);

  return out;
}

/**
 * Builds the DDV_KIR_KPR document object (pre-stringification) from the full
 * application state. The document is wrapped under a single top-level
 * "DDV_KIR_KPR" key, per the confirmed FURS document shape.
 *
 * @param {{general: object, kir: object[], kpr: object[]}} state
 */
export function buildDocument(state) {
  const period = derivePeriod({
    periodType: state.general.periodType,
    periodUnit: Number(state.general.periodUnit),
    periodYear: Number(state.general.periodYear),
  });

  const kirEntries = state.kir.map((entry, index) => buildKirEntry(entry, index, period.OBDOBJE));
  const kprEntries = state.kpr.map((entry, index) => buildKprEntry(entry, index, period.OBDOBJE));
  const flags = deriveFlags(state.kir, state.kpr);

  return {
    DDV_KIR_KPR: {
      Glava: {
        TaxPayerID: String(state.general.taxPayerID).trim(),
        OBDOBJE_OD: period.OBDOBJE_OD,
        OBDOBJE_DO: period.OBDOBJE_DO,
        KIR: flags.KIR,
        KPR: flags.KPR,
        VRACILO: Boolean(state.general.vracilo),
        ODBDELEZ: Boolean(state.general.odbdelez),
      },
      Lista_KIR: { KIR: kirEntries },
      Lista_KPR: { KPR: kprEntries },
    },
  };
}

/**
 * Builds the DDV_KIR_KPR document and serializes it to a pretty-printed JSON
 * string, ready to hand to download.js.
 */
export function serialize(state) {
  return JSON.stringify(buildDocument(state), null, 2);
}

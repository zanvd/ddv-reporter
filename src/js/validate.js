// Pure §7 format-validation rules for the general section and the KIR/KPR
// entry lists.
//
// Every function here is presentation-agnostic: it returns error strings (or
// a field -> error-message map), never touches the DOM, and is the single
// source of truth for both live inline validation and the Download gate
// (spec §7, §8; plan §4 "Data flow").
//
// v1 performs format validation only — no FURS online/tax-register checks
// (spec §7, §9).

import { isValidCountryCode } from './countries.js';

const TAX_PAYER_ID_PATTERN = /^[0-9]{8}$/;
const YEAR_PATTERN = /^\d{4}$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const AMOUNT_LIMIT = 5_000_000_000; // strictly within (-5e9, +5e9), spec §7
const TEXT_MAX_LENGTH = 250;
const VAT_ID_MAX_LENGTH = 25;
// A 2-letter alphabetic prefix immediately followed by a digit looks like a
// leading country code (e.g. "SI12345678", "DE123456789") that the user
// should have omitted (spec §7).
const VAT_ID_COUNTRY_PREFIX_PATTERN = /^[A-Za-z]{2}\d/;
const PERIOD_TYPES = new Set(['monthly', 'quarterly']);

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function todayLocalISODate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealCalendarDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// ---------------------------------------------------------------------------
// Field-level validators. Each returns an error message string, or null if
// the value is valid.
// ---------------------------------------------------------------------------

/** Exactly 8 digits, no "SI" prefix (TaxPayerID, spec §5/§7). */
export function validateTaxPayerID(value) {
  if (isBlank(value)) return 'Davčna številka je obvezna.';
  if (!TAX_PAYER_ID_PATTERN.test(String(value).trim())) {
    return 'Davčna številka mora vsebovati natanko 8 številk, brez predpone "SI".';
  }
  return null;
}

/** 'monthly' or 'quarterly'. */
export function validatePeriodType(value) {
  if (isBlank(value)) return 'Vrsta obdobja poročanja je obvezna.';
  if (!PERIOD_TYPES.has(value)) return 'Vrsta obdobja poročanja mora biti mesečna ali četrtletna.';
  return null;
}

/** The specific month (1-12) or quarter (1-4), depending on periodType. */
export function validatePeriodUnit(periodType, periodUnit) {
  if (isBlank(periodUnit)) return 'Mesec/četrtletje je obvezno.';
  const unit = Number(periodUnit);
  if (!Number.isInteger(unit)) return 'Mesec/četrtletje mora biti celo število.';
  if (periodType === 'monthly') {
    return unit >= 1 && unit <= 12 ? null : 'Mesec mora biti med 1 in 12.';
  }
  if (periodType === 'quarterly') {
    return unit >= 1 && unit <= 4 ? null : 'Četrtletje mora biti med 1 in 4.';
  }
  return 'Pred izbiro meseca/četrtletja izberite vrsto obdobja poročanja.';
}

/** A 4-digit reporting year. */
export function validatePeriodYear(value) {
  if (isBlank(value)) return 'Leto je obvezno.';
  if (!YEAR_PATTERN.test(String(value).trim())) {
    return 'Leto mora biti 4-mestno število.';
  }
  return null;
}

/**
 * A YYYY-MM-DD line-level date (P2/P4/P5): correct shape, a real calendar
 * date, and not in the future relative to the local system date (spec §7;
 * plan §7 assumption).
 */
export function validateDateNotFuture(value) {
  if (isBlank(value)) return 'Datum je obvezen.';
  const trimmed = String(value).trim();
  const match = DATE_PATTERN.exec(trimmed);
  if (!match) return 'Datum mora biti v obliki YYYY-MM-DD.';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealCalendarDate(year, month, day)) {
    return 'Datum ni veljaven koledarski datum.';
  }
  if (trimmed > todayLocalISODate()) {
    return 'Datum ne sme biti v prihodnosti.';
  }
  return null;
}

/**
 * An optional amount field: blank is valid (omitted from the JSON entirely).
 * When present: numeric, at most 2 decimal places, strictly within
 * (-5,000,000,000, +5,000,000,000) (spec §7).
 */
export function validateAmount(value) {
  if (isBlank(value)) return null;
  const trimmed = String(value).trim();
  if (!AMOUNT_PATTERN.test(trimmed)) {
    return 'Znesek mora biti število z največ 2 decimalnima mestoma.';
  }
  const numeric = Number(trimmed);
  if (!(numeric > -AMOUNT_LIMIT && numeric < AMOUNT_LIMIT)) {
    return 'Znesek mora biti strogo med -5.000.000.000 in 5.000.000.000.';
  }
  return null;
}

/** A required text field, max length 250 by default (P3, supplier name, etc.). */
export function validateRequiredText(value, maxLength = TEXT_MAX_LENGTH) {
  if (isBlank(value)) return 'To polje je obvezno.';
  if (String(value).trim().length > maxLength) {
    return `Lahko vsebuje največ ${maxLength} znakov.`;
  }
  return null;
}

/** A 2-letter ISO country code (P6/P7), required unless {required: false}. */
export function validateCountryCode(value, { required = true } = {}) {
  if (isBlank(value)) {
    return required ? 'Država je obvezna.' : null;
  }
  if (!isValidCountryCode(value)) {
    return 'Koda države ni prepoznana kot država članica EU, SI ali XI.';
  }
  return null;
}

/** A VAT ID (P6DS/P7DS): max 25 chars, no leading country-code prefix. */
export function validateVatId(value, { required = true } = {}) {
  if (isBlank(value)) {
    return required ? 'Identifikacijska številka za DDV je obvezna.' : null;
  }
  const trimmed = String(value).trim();
  if (trimmed.length > VAT_ID_MAX_LENGTH) {
    return `Identifikacijska številka za DDV lahko vsebuje največ ${VAT_ID_MAX_LENGTH} znakov.`;
  }
  if (VAT_ID_COUNTRY_PREFIX_PATTERN.test(trimmed)) {
    return 'Identifikacijska številka za DDV mora biti vnesena brez predpone kode države (npr. "SI").';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aggregate validators: form state -> field-error map.
// ---------------------------------------------------------------------------

/** Validates the general-section form state; returns a field-name -> message map. */
export function validateGeneral(general) {
  const errors = {};

  const taxPayerIDError = validateTaxPayerID(general.taxPayerID);
  if (taxPayerIDError) errors.taxPayerID = taxPayerIDError;

  const periodTypeError = validatePeriodType(general.periodType);
  if (periodTypeError) errors.periodType = periodTypeError;

  const periodUnitError = validatePeriodUnit(general.periodType, general.periodUnit);
  if (periodUnitError) errors.periodUnit = periodUnitError;

  const periodYearError = validatePeriodYear(general.periodYear);
  if (periodYearError) errors.periodYear = periodYearError;

  return errors;
}

/** Validates one KIR (charged/output) entry; returns a field-name -> message map. */
export function validateKirEntry(entry) {
  const errors = {};

  const postingDateError = validateDateNotFuture(entry.postingDate);
  if (postingDateError) errors.postingDate = postingDateError;

  const documentNumberError = validateRequiredText(entry.documentNumber);
  if (documentNumberError) errors.documentNumber = documentNumberError;

  const documentDateError = validateDateNotFuture(entry.documentDate);
  if (documentDateError) errors.documentDate = documentDateError;

  // P6/P6DS: both present or both empty (spec §7).
  const countryProvided = !isBlank(entry.customerCountry);
  const vatIdProvided = !isBlank(entry.customerVatId);
  if (countryProvided !== vatIdProvided) {
    const pairingMessage = 'Država kupca in identifikacijska številka kupca za DDV morata biti obe izpolnjeni ali obe prazni.';
    errors.customerCountry = pairingMessage;
    errors.customerVatId = pairingMessage;
  } else {
    const countryError = validateCountryCode(entry.customerCountry, { required: false });
    if (countryError) errors.customerCountry = countryError;

    const vatIdError = validateVatId(entry.customerVatId, { required: false });
    if (vatIdError) errors.customerVatId = vatIdError;
  }

  const netValueError = validateAmount(entry.netValue);
  if (netValueError) errors.netValue = netValueError;

  const vat22Error = validateAmount(entry.vat22);
  if (vat22Error) errors.vat22 = vat22Error;

  const vat95Error = validateAmount(entry.vat95);
  if (vat95Error) errors.vat95 = vat95Error;

  const vat5Error = validateAmount(entry.vat5);
  if (vat5Error) errors.vat5 = vat5Error;

  return errors;
}

/** Validates one KPR (deducted/input) entry; returns a field-name -> message map. */
export function validateKprEntry(entry) {
  const errors = {};

  const postingDateError = validateDateNotFuture(entry.postingDate);
  if (postingDateError) errors.postingDate = postingDateError;

  const documentNumberError = validateRequiredText(entry.documentNumber);
  if (documentNumberError) errors.documentNumber = documentNumberError;

  const dateReceivedError = validateDateNotFuture(entry.dateReceived);
  if (dateReceivedError) errors.dateReceived = dateReceivedError;

  const documentDateError = validateDateNotFuture(entry.documentDate);
  if (documentDateError) errors.documentDate = documentDateError;

  const supplierNameError = validateRequiredText(entry.supplierName);
  if (supplierNameError) errors.supplierName = supplierNameError;

  const supplierCountryError = validateCountryCode(entry.supplierCountry, { required: true });
  if (supplierCountryError) errors.supplierCountry = supplierCountryError;

  const supplierVatIdError = validateVatId(entry.supplierVatId, { required: true });
  if (supplierVatIdError) errors.supplierVatId = supplierVatIdError;

  const netValueError = validateAmount(entry.netValue);
  if (netValueError) errors.netValue = netValueError;

  const deductVat22Error = validateAmount(entry.deductVat22);
  if (deductVat22Error) errors.deductVat22 = deductVat22Error;

  const deductVat95Error = validateAmount(entry.deductVat95);
  if (deductVat95Error) errors.deductVat95 = deductVat95Error;

  const deductVat5Error = validateAmount(entry.deductVat5);
  if (deductVat5Error) errors.deductVat5 = deductVat5Error;

  const flatRate8Error = validateAmount(entry.flatRate8);
  if (flatRate8Error) errors.flatRate8 = flatRate8Error;

  return errors;
}

/**
 * Validates one partner record (plan 0006 §3.1, §5.3); returns a
 * field-name -> message map keyed name/countryCode/vatId. All three fields
 * are required for both the add and edit flows — reuses the same rules as
 * the KIR/KPR identity fields, with no partner-specific carve-out.
 *
 * Deliberately not part of validateState()/hasAnyErrors(): partners are
 * invisible to the DDV_KIR_KPR output and the Download gate (plan §3.2).
 */
export function validatePartner(partner) {
  const errors = {};

  const nameError = validateRequiredText(partner.name);
  if (nameError) errors.name = nameError;

  const countryCodeError = validateCountryCode(partner.countryCode, { required: true });
  if (countryCodeError) errors.countryCode = countryCodeError;

  const vatIdError = validateVatId(partner.vatId, { required: true });
  if (vatIdError) errors.vatId = vatIdError;

  return errors;
}

/** True if a validatePartner() result contains any field errors. */
export function hasPartnerErrors(errorMap) {
  return Object.keys(errorMap).length > 0;
}

/**
 * Validates the full application state (general section + every KIR/KPR
 * entry). Used as the single Download gate (spec §7/§8) as well as the
 * source for live inline errors.
 */
export function validateState(state) {
  return {
    general: validateGeneral(state.general),
    kir: state.kir.map(validateKirEntry),
    kpr: state.kpr.map(validateKprEntry),
  };
}

/** True if a validateState() result contains any field errors anywhere. */
export function hasAnyErrors(validationResult) {
  if (Object.keys(validationResult.general).length > 0) return true;
  if (validationResult.kir.some((entryErrors) => Object.keys(entryErrors).length > 0)) return true;
  if (validationResult.kpr.some((entryErrors) => Object.keys(entryErrors).length > 0)) return true;
  return false;
}

// Pure period-derivation and general-section flag logic.
//
// The user only picks a period type (monthly/quarterly), a specific month/quarter,
// and a year (spec §5, "Period selection"). Everything FURS-shaped is derived here:
// OBDOBJE_OD / OBDOBJE_DO (calendar-correct, including leap-year February) and each
// entry's OBDOBJE (MMMM = 2-digit start month + 2-digit end month, spec §6).
//
// No DOM access; no state mutation.

const PERIOD_TYPES = new Set(['monthly', 'quarterly']);

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Last calendar day of the given 1-indexed month/year (leap-year correct).
 */
function lastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Derives the general section's reporting-period fields from the user's period selection.
 *
 * @param {{periodType: 'monthly'|'quarterly', periodUnit: number, periodYear: number}} period
 * @returns {{OBDOBJE_OD: string, OBDOBJE_DO: string, OBDOBJE: string}}
 */
export function derivePeriod({ periodType, periodUnit, periodYear }) {
  if (!PERIOD_TYPES.has(periodType)) {
    throw new Error(`Unknown periodType: ${periodType}`);
  }
  if (!Number.isInteger(periodYear)) {
    throw new Error(`periodYear must be an integer, got: ${periodYear}`);
  }

  let startMonth;
  let endMonth;

  if (periodType === 'monthly') {
    if (!Number.isInteger(periodUnit) || periodUnit < 1 || periodUnit > 12) {
      throw new Error(`Monthly periodUnit must be 1-12, got: ${periodUnit}`);
    }
    startMonth = periodUnit;
    endMonth = periodUnit;
  } else {
    if (!Number.isInteger(periodUnit) || periodUnit < 1 || periodUnit > 4) {
      throw new Error(`Quarterly periodUnit must be 1-4, got: ${periodUnit}`);
    }
    startMonth = 3 * periodUnit - 2;
    endMonth = 3 * periodUnit;
  }

  const OBDOBJE_OD = `${periodYear}-${pad2(startMonth)}-01`;
  const OBDOBJE_DO = `${periodYear}-${pad2(endMonth)}-${pad2(lastDayOfMonth(periodYear, endMonth))}`;
  const OBDOBJE = `${pad2(startMonth)}${pad2(endMonth)}`;

  return { OBDOBJE_OD, OBDOBJE_DO, OBDOBJE };
}

/**
 * Derives the general section's KIR/KPR presence flags from the entry lists (spec §5:
 * true if the corresponding list has at least one entry).
 *
 * @param {unknown[]} kirEntries
 * @param {unknown[]} kprEntries
 * @returns {{KIR: boolean, KPR: boolean}}
 */
export function deriveFlags(kirEntries, kprEntries) {
  return {
    KIR: kirEntries.length > 0,
    KPR: kprEntries.length > 0,
  };
}

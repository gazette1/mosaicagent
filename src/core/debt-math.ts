/**
 * Debt math. Deterministic; no model ever touches this.
 */

/** Annualized mortgage loan constant for a fully-amortizing loan. */
export function loanConstant(annualRate: number, amortYears: number): number {
  const r = annualRate / 12;
  const n = amortYears * 12;
  if (r === 0) return 1 / amortYears;
  return ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) * 12;
}

/** Annual debt service. amortYears null/0 = interest-only. */
export function annualDebtService(loanAmount: number, annualRate: number, amortYears: number | null): number {
  if (!amortYears) return loanAmount * annualRate; // IO
  return loanAmount * loanConstant(annualRate, amortYears);
}

/** Max loan sized to a DSCR floor. */
export function sizeLoanToDscr(noi: number, minDscr: number, annualRate: number, amortYears: number | null): number {
  const dsCapacity = noi / minDscr;
  if (!amortYears) return dsCapacity / annualRate;
  return dsCapacity / loanConstant(annualRate, amortYears);
}

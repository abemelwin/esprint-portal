import type { FinancialCalcResult } from "../types";

export function computeFinancial(
  basePrice: number,
  downpayment: number,
  annualInterestRate: number,
  termsMonths: number
): FinancialCalcResult {
  const bp = Math.max(0, Number(basePrice) || 0);
  const dp = Math.max(0, Number(downpayment) || 0);
  const rate = Number(annualInterestRate) || 0;
  const terms = Number(termsMonths) || 0;

  const dpPercent = bp > 0 ? Math.round((dp / bp) * 100) : 0;
  const principalFinanced = Math.max(0, bp - dp);

  // 7%, 21% and 28% use flat rate (Principal × rate%)
  // Other rates use standard add-on (Principal × rate/12 × terms)
  let totalInterest = 0;
  if (rate === 7 || rate === 21 || rate === 28) {
    totalInterest = principalFinanced * (rate / 100);
  } else {
    totalInterest = principalFinanced * (rate / 100 / 12) * terms;
  }

  const contractPrice = dp + principalFinanced + totalInterest;
  const balance = Math.max(0, contractPrice - dp);
  const monthlyAmortization = terms > 0 ? balance / terms : 0;

  return {
    basePrice: bp,
    downpayment: dp,
    dpPercent,
    principalFinanced,
    annualInterestRate: rate,
    termsMonths: terms,
    totalInterest,
    contractPrice,
    balance,
    monthlyAmortization,
  };
}

export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  const n = Number(val) || 0;
  return "₱" + n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

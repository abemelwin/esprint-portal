/**
 * Enriched check rows for the All Checks table.
 *
 * Combines each check with its computed status/balance (from CHECKS_META)
 * plus client name + branch name for display. Mirrors the `enriched`
 * memo in the original checks page.
 */

import type { AppData, CheckStatus } from "./database.types";
import { STALE_DAYS } from "./format";

export interface EnrichedCheck {
  id: string;
  client: string;
  clientName: string;
  branch: string;
  branchName: string;
  subsidiary: string | null;
  ae: string | null;
  bank: string | null;
  checkNo: string;
  checkDate: string | null;
  originalAmount: number;
  balance: number;
  status: CheckStatus;
  reason: string | null;
  nextDeposit: string | null;
  aging: number | null;
  stale: boolean;
  paymentFor: string | null;
}

function todayISO(): string {
  // Philippine time (UTC+8) — runs server-side on Amplify (UTC), so shift to PHT.
  const nowPHT = new Date(Date.now() + 8 * 3600 * 1000);
  return nowPHT.toISOString().slice(0, 10);
}

export function enrichChecks(data: AppData): EnrichedCheck[] {
  const clientMap = new Map(data.CLIENTS.map((c) => [c.code, c]));
  const branchMap = new Map(data.BRANCHES.map((b) => [b.id, b.name]));
  const meta = data.CHECKS_META ?? {};
  const today = todayISO();

  return data.CHECKS.map((c) => {
    const m = meta[c.id];
    const status = (m?.status ?? c.finalStatus ?? "OPEN") as CheckStatus;
    const balance = m?.balance ?? c.originalAmount ?? 0;
    const nextDeposit = m?.nextDeposit ?? null;
    const reason = m?.reason ?? null;

    const aging = c.checkDate
      ? nextDeposit
        ? Math.floor((new Date(nextDeposit).getTime() - new Date(c.checkDate).getTime()) / 86400000)
        : Math.floor((new Date(today).getTime() - new Date(c.checkDate).getTime()) / 86400000)
      : null;

    const daysSinceCheck = c.checkDate
      ? Math.floor((new Date(today).getTime() - new Date(c.checkDate).getTime()) / 86400000)
      : 0;
    const stale =
      daysSinceCheck > STALE_DAYS &&
      !["CLEARED", "REPLACED", "SETTLED (PAID)", "CANCELLED"].includes(status);

    return {
      id: c.id,
      client: c.client,
      clientName: clientMap.get(c.client)?.name ?? "",
      branch: c.branch,
      branchName: branchMap.get(c.branch) ?? c.branch,
      subsidiary: c.subsidiary,
      ae: c.ae,
      bank: c.bank,
      checkNo: c.checkNo,
      checkDate: c.checkDate,
      originalAmount: c.originalAmount ?? 0,
      balance,
      status,
      reason,
      nextDeposit,
      aging,
      stale,
      paymentFor: c.paymentFor,
    };
  });
}

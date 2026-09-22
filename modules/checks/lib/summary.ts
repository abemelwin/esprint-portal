/**
 * Dashboard summary aggregation for Check Monitoring.
 *
 * Uses the derived CHECKS_META (from data.ts serverLoad) to compute the
 * 6 KPI totals, branch breakdown, and recent events — mirroring the
 * original dashboard's aggregation.
 */

import type { AppData, CheckStatus } from "./database.types";
import { STALE_DAYS } from "./format";

export interface KpiTotals {
  held: { count: number; amount: number };
  returned: { count: number; amount: number };
  partial: { count: number; amount: number };
  dueToday: { count: number };
  overdue: { count: number };
  stale: { count: number; amount: number };
}

export interface BranchRow {
  id: string;
  name: string;
  held: number;
  heldAmt: number;
  returned: number;
  retAmt: number;
  stale: number;
}

export interface StatusSlice {
  label: string;
  count: number;
  amount: number;
  color: string;
}

export interface RecentEvent {
  id: string;
  type: string;
  clientName: string;
  branchName: string;
  bank: string;
  checkNo: string;
  eventDate: string | null;
  amount: number | undefined;
}

export interface DashboardSummary {
  kpi: KpiTotals;
  branchRows: BranchRow[];
  statusChart: StatusSlice[];
  recentEvents: RecentEvent[];
  totalChecks: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isStale(checkDate: string | null): boolean {
  if (!checkDate) return false;
  const diff =
    (Date.now() - new Date(checkDate + "T00:00:00").getTime()) / 86400000;
  return diff > STALE_DAYS;
}

export function buildDashboardSummary(data: AppData): DashboardSummary {
  const meta = data.CHECKS_META ?? {};
  const today = todayISO();

  const kpi: KpiTotals = {
    held: { count: 0, amount: 0 },
    returned: { count: 0, amount: 0 },
    partial: { count: 0, amount: 0 },
    dueToday: { count: 0 },
    overdue: { count: 0 },
    stale: { count: 0, amount: 0 },
  };

  // Status chart buckets
  const buckets: Record<string, { count: number; amount: number }> = {
    Held: { count: 0, amount: 0 },
    Open: { count: 0, amount: 0 },
    Returned: { count: 0, amount: 0 },
    "Cleared / Paid": { count: 0, amount: 0 },
    Partial: { count: 0, amount: 0 },
    "Other / Stale": { count: 0, amount: 0 },
  };

  // Branch aggregation
  const branchMap = new Map<string, BranchRow>();
  const branchName = new Map<string, string>();
  for (const b of data.BRANCHES) branchName.set(b.id, b.name);

  for (const c of data.CHECKS) {
    const m = meta[c.id];
    if (!m) continue;
    const status = m.status as CheckStatus;
    const bal = m.balance;

    // KPI
    if (status === "HELD") {
      kpi.held.count++;
      kpi.held.amount += bal;
    } else if (status === "RETURNED") {
      kpi.returned.count++;
      kpi.returned.amount += bal;
    } else if (status === "PARTIAL") {
      kpi.partial.count++;
      kpi.partial.amount += bal;
    }
    if (m.nextDeposit === today) kpi.dueToday.count++;
    if (status === "HELD" && m.nextDeposit && m.nextDeposit < today) {
      kpi.overdue.count++;
    }
    if (isStale(c.checkDate)) {
      kpi.stale.count++;
      kpi.stale.amount += bal;
    }

    // Chart buckets
    if (["CLEARED", "SETTLED (PAID)", "DEPOSITED", "REPLACED"].includes(status)) {
      buckets["Cleared / Paid"].count++;
      buckets["Cleared / Paid"].amount += bal;
    } else if (status === "RETURNED") {
      buckets["Returned"].count++;
      buckets["Returned"].amount += bal;
    } else if (status === "PARTIAL") {
      buckets["Partial"].count++;
      buckets["Partial"].amount += bal;
    } else if (status === "HELD") {
      buckets["Held"].count++;
      buckets["Held"].amount += bal;
    } else if (status === "OPEN") {
      buckets["Open"].count++;
      buckets["Open"].amount += bal;
    } else {
      buckets["Other / Stale"].count++;
      buckets["Other / Stale"].amount += bal;
    }

    // Branch rows
    const bid = c.branch;
    let br = branchMap.get(bid);
    if (!br) {
      br = {
        id: bid,
        name: branchName.get(bid) ?? bid,
        held: 0,
        heldAmt: 0,
        returned: 0,
        retAmt: 0,
        stale: 0,
      };
      branchMap.set(bid, br);
    }
    if (status === "HELD") {
      br.held++;
      br.heldAmt += bal;
    }
    if (status === "RETURNED") {
      br.returned++;
      br.retAmt += bal;
    }
    if (isStale(c.checkDate)) br.stale++;
  }

  const colors: Record<string, string> = {
    Held: "#3b82f6",
    Open: "#06b6d4",
    Returned: "#ef4444",
    "Cleared / Paid": "#10b981",
    Partial: "#f59e0b",
    "Other / Stale": "#8b5cf6",
  };

  const statusChart: StatusSlice[] = Object.entries(buckets)
    .filter(([, v]) => v.count > 0)
    .map(([label, v]) => ({ label, count: v.count, amount: v.amount, color: colors[label] }));

  const branchRows = [...branchMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Recent events (last 10) — for the events feed
  const clientNameMap = new Map(data.CLIENTS.map((c) => [c.code, c.name]));
  const checkMap = new Map(data.CHECKS.map((c) => [c.id, c]));
  const recentEvents: RecentEvent[] = [...data.EVENTS]
    .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""))
    .slice(0, 10)
    .map((ev) => {
      const ck = checkMap.get(ev.checkId);
      return {
        id: ev.id,
        type: ev.type,
        clientName: ck ? clientNameMap.get(ck.client) ?? "" : "",
        branchName: ck ? branchName.get(ck.branch) ?? ck.branch : "",
        bank: ck?.bank ?? "",
        checkNo: ck?.checkNo ?? "",
        eventDate: ev.eventDate,
        amount: ev.amount,
      };
    });

  return {
    kpi,
    branchRows,
    statusChart,
    recentEvents,
    totalChecks: data.CHECKS.length,
  };
}

"use client";

import { useState, useMemo } from "react";
import StatusBadge from "./StatusBadge";
import { fmtPHP, fmtDate } from "../lib/format";
import type { EnrichedCheck } from "../lib/enrich";

const PAGE_SIZE = 50;

interface Props {
  title: string;
  description: string;
  /** Statuses this report includes. Empty = all (use custom filter). */
  statuses?: string[];
  /** Only stale checks. */
  staleOnly?: boolean;
  checks: EnrichedCheck[];
  branches: { id: string; name: string }[];
  aeList: string[];
}

export function ReportView({ title, description, statuses, staleOnly, checks, branches, aeList }: Props) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [aeFilter, setAeFilter] = useState("");
  const [page, setPage] = useState(1);

  // Pre-filter by report definition
  const scoped = useMemo(() => {
    let rows = checks;
    if (statuses && statuses.length > 0) {
      const set = new Set(statuses);
      rows = rows.filter((c) => set.has(c.status));
    }
    if (staleOnly) rows = rows.filter((c) => c.stale);
    return rows;
  }, [checks, statuses, staleOnly]);

  const filtered = useMemo(() => {
    let rows = scoped;
    if (branchFilter) rows = rows.filter((c) => c.branch === branchFilter);
    if (aeFilter) rows = rows.filter((c) => (c.ae ?? "") === aeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.clientName.toLowerCase().includes(q) ||
          c.checkNo.toLowerCase().includes(q) ||
          (c.bank ?? "").toLowerCase().includes(q) ||
          c.branchName.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [scoped, search, branchFilter, aeFilter]);

  const totalBalance = filtered.reduce((s, c) => s + c.balance, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600";

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase text-gray-400 font-semibold">Total Checks</p>
          <p className="text-2xl font-bold text-gray-800">{filtered.length.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <p className="text-[10px] uppercase text-gray-400 font-semibold">Total Balance</p>
          <p className="text-2xl font-bold text-blue-700">{fmtPHP(totalBalance)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search..." className={selCls + " w-64"} />
        <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }} className={selCls}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={aeFilter} onChange={(e) => { setAeFilter(e.target.value); setPage(1); }} className={selCls}>
          <option value="">All AEs</option>
          {aeList.map((ae) => <option key={ae} value={ae}>{ae}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Branch</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Client</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">AE</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Bank / Check #</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Check Date</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] text-right">Balance ₱</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Status</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] text-right">Aging</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Reason</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{c.branchName}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">{c.clientName || c.client}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.ae ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-gray-800">{c.bank} {c.checkNo}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{fmtDate(c.checkDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-mono font-bold text-gray-800">{fmtPHP(c.balance)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2 whitespace-nowrap text-right" style={{ color: (c.aging ?? 0) > 90 ? "#dc2626" : (c.aging ?? 0) > 30 ? "#d97706" : "#6b7280" }}>{c.aging != null ? `${c.aging}d` : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.reason ?? "—"}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-gray-400 italic">No checks in this report</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">←</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">→</button>
          </div>
        </div>
      </div>
    </div>
  );
}

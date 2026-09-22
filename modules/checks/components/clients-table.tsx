"use client";

import { useState, useMemo } from "react";

interface ClientRow {
  code: string;
  name: string;
  branch: string;
  branchName: string;
  ae: string | null;
  checkCount: number;
}

interface Props {
  clients: ClientRow[];
  branches: { id: string; name: string }[];
}

const PAGE_SIZE = 50;

export function ClientsTable({ clients, branches }: Props) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = clients;
    if (branchFilter) rows = rows.filter((c) => c.branch === branchFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.ae ?? "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, search, branchFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-600";

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Clients</h1>
        <span className="text-sm text-gray-400">{filtered.length.toLocaleString()} of {clients.length.toLocaleString()} clients</span>
      </div>

      <div className="flex flex-wrap gap-2 items-center bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search client name, code, AE..."
          className={selCls + " w-72"}
        />
        <select value={branchFilter} onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }} className={selCls}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Code</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Client Name</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Branch</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px]">AE</th>
                <th className="px-3 py-2.5 font-semibold uppercase tracking-wide text-[10px] text-right">Checks</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.code} className="border-t border-gray-50 hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-500">{c.code}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800">{c.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{c.branchName}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.ae ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-blue-700">{c.checkCount || "—"}</td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic">No clients match your filters</td></tr>
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

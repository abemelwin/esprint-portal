"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, TBAListItem, ReorderPoint } from "../types";

interface StockRow {
  key: string;
  brand: string;
  model: string;
  inStock: number;
  incoming: number;
  reserved: number;
  physical: number; // inStock + reserved (on hand)
  available: number; // inStock
  tba: number;
  rp: number;
  rank: number;
  label: string;
  cls: "crit" | "warn" | "ok" | "none";
}

export function StockMatrixClient() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [tbaList, setTbaList] = useState<TBAListItem[]>([]);
  const [reorderPts, setReorderPts] = useState<ReorderPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [rpOnly, setRpOnly] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [mRes, tRes, rRes] = await Promise.all([
        fetch("/api/machines"),
        fetch("/api/machines/tba"),
        fetch("/api/machines/lookups"),
      ]);
      const mData = await mRes.json();
      const tData = await tRes.json();
      const rData = await rRes.json();
      if (mData.machines) setMachines(mData.machines);
      if (tData.tba) setTbaList(tData.tba);
      if (rData.reorder_points) setReorderPts(rData.reorder_points);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const allBranches = useMemo(
    () => [...new Set(machines.map((m) => (m.branch || "").trim()).filter(Boolean))].sort(),
    [machines]
  );

  const allRows = useMemo(() => {
    const g: Record<string, StockRow> = {};
    (machines || []).forEach((m) => {
      if (fBranch && (m.branch || "") !== fBranch) return;
      const brand = (m.brand || "").trim() || "(no brand)";
      const model = (m.model || "").trim() || "(no model)";
      const key = `${brand}||${model}`;
      if (!g[key]) {
        g[key] = {
          key,
          brand,
          model,
          inStock: 0,
          incoming: 0,
          reserved: 0,
          physical: 0,
          available: 0,
          tba: 0,
          rp: 0,
          rank: 3,
          label: "—",
          cls: "none",
        };
      }
      const r = g[key];
      if (m.status === "In Stock") r.inStock++;
      if (m.status === "Incoming") r.incoming++;
      if (m.status === "Reserved") r.reserved++;
    });

    const rpMap: Record<string, number> = {};
    (reorderPts || []).forEach((rp) => {
      rpMap[`${rp.brand}||${rp.model}`] = rp.quantity;
    });

    const tbaCount: Record<string, number> = {};
    (tbaList || []).forEach((t) => {
      const k = `${(t.brand || "").trim() || "(no brand)"}||${(t.model || "").trim() || "(no model)"}`;
      tbaCount[k] = (tbaCount[k] || 0) + 1;
    });

    return Object.values(g).map((r) => {
      r.physical = r.inStock + r.reserved;
      r.available = r.inStock;
      r.tba = tbaCount[r.key] || 0;
      r.rp = rpMap[r.key] || 0;

      if (r.rp > 0) {
        if (r.physical <= r.rp) {
          if (r.incoming > 0) {
            r.rank = 1;
            r.label = `Replenish · ${r.incoming} incoming`;
            r.cls = "warn";
          } else {
            r.rank = 0;
            r.label = "⚠ Reorder now";
            r.cls = "crit";
          }
        } else {
          r.rank = 2;
          r.label = "OK";
          r.cls = "ok";
        }
      }
      return r;
    });
  }, [machines, tbaList, reorderPts, fBranch]);

  const allBrands = useMemo(() => [...new Set(allRows.map((r) => r.brand))].sort(), [allRows]);

  const filtered = useMemo(() => {
    let r = allRows.slice();
    if (q.trim()) {
      const lq = q.toLowerCase();
      r = r.filter((x) => `${x.brand} ${x.model}`.toLowerCase().includes(lq));
    }
    if (fBrand) r = r.filter((x) => x.brand === fBrand);
    if (rpOnly) r = r.filter((x) => x.cls === "crit" || x.cls === "warn");
    return r.sort((a, b) => a.rank - b.rank || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [allRows, q, fBrand, rpOnly]);

  const needReorderCount = allRows.filter((r) => r.cls === "crit" || r.cls === "warn").length;

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-4 max-w-[1700px] mx-auto">
      {/* Top Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📊</span> Stock Summary & Reorder Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Overview of on-hand inventory, incoming shipments, active reservations, and reorder alerts.
          </p>
        </div>

        {needReorderCount > 0 && (
          <div className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
            <span>⚠</span>
            <span>{needReorderCount} model(s) below reorder point</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2.5 text-xs">
        <input
          type="search"
          placeholder="🔍 Search brand, model…"
          className="bg-slate-50 border border-slate-300 text-slate-900 px-3 py-1.5 rounded-xl text-xs min-w-[260px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          value={fBrand}
          onChange={(e) => setFBrand(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All brands</option>
          {allBrands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          value={fBranch}
          onChange={(e) => setFBranch(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All branches</option>
          {allBranches.map((br) => (
            <option key={br} value={br}>
              {br}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl cursor-pointer select-none hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={rpOnly}
            onChange={(e) => setRpOnly(e.target.checked)}
            className="cursor-pointer accent-red-600 rounded"
          />
          <span>Reorder alert only</span>
        </label>

        <span className="flex-1" />

        <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
          {filtered.length} of {allRows.length} models
        </span>
      </div>

      {/* Stock Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Calculating inventory balances...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">
            No machine models matched the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-3.5">Brand</th>
                  <th className="py-3 px-3.5">Model</th>
                  <th className="py-3 px-3.5 text-center">Physical (On Hand)</th>
                  <th className="py-3 px-3.5 text-center">In Stock</th>
                  <th className="py-3 px-3.5 text-center">Incoming</th>
                  <th className="py-3 px-3.5 text-center">Reserved</th>
                  <th className="py-3 px-3.5 text-center">Available to Sell</th>
                  <th className="py-3 px-3.5 text-center">TBA List</th>
                  <th className="py-3 px-3.5 text-center">Reorder Level</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 whitespace-nowrap">
                {filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-blue-700">{r.brand}</td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">{r.model}</td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-900 bg-slate-50">
                      {r.physical}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-emerald-700">
                      {r.inStock}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-semibold text-blue-700">
                      {r.incoming || "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-amber-700">
                      {r.reserved || "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-black text-slate-900 bg-emerald-50/50">
                      {r.available}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-purple-700">
                      {r.tba || "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-center text-slate-500 font-semibold">
                      {r.rp > 0 ? r.rp : "—"}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      {r.cls === "crit" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          {r.label}
                        </span>
                      ) : r.cls === "warn" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {r.label}
                        </span>
                      ) : r.cls === "ok" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          OK
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

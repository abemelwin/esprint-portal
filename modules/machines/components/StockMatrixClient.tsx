"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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

  const allBrands = useMemo(
    () => [...new Set(machines.map((m) => (m.brand || "").trim()).filter(Boolean))].sort(),
    [machines]
  );

  // Compute Matrix rows
  const allRows = useMemo<StockRow[]>(() => {
    const map = new Map<string, { brand: string; model: string; inStock: number; incoming: number; reserved: number; tba: number }>();

    for (const m of machines) {
      if (fBranch && (m.branch || "").trim() !== fBranch) continue;
      if (m.status === "Delivered") continue;

      const brand = (m.brand || "Unknown").trim().toUpperCase();
      const model = (m.model || "Unknown").trim().toUpperCase();
      const key = `${brand}__${model}`;

      if (!map.has(key)) {
        map.set(key, { brand, model, inStock: 0, incoming: 0, reserved: 0, tba: 0 });
      }
      const entry = map.get(key)!;
      if (m.status === "In Stock") entry.inStock += 1;
      else if (m.status === "Incoming") entry.incoming += 1;
      else if (m.status === "Reserved") entry.reserved += 1;
    }

    for (const t of tbaList) {
      const brand = (t.brand || "Unknown").trim().toUpperCase();
      const model = (t.model || "Unknown").trim().toUpperCase();
      const key = `${brand}__${model}`;
      if (!map.has(key)) {
        map.set(key, { brand, model, inStock: 0, incoming: 0, reserved: 0, tba: 0 });
      }
      map.get(key)!.tba += 1;
    }

    const rpMap = new Map<string, number>();
    for (const rp of reorderPts) {
      const key = `${rp.brand.trim().toUpperCase()}__${rp.model.trim().toUpperCase()}`;
      rpMap.set(key, rp.quantity);
    }

    const rows: StockRow[] = [];
    for (const [key, val] of map.entries()) {
      const rp = rpMap.get(key) || 0;
      const physical = val.inStock + val.reserved;
      const available = val.inStock;

      let cls: "crit" | "warn" | "ok" | "none" = "none";
      let label = "Normal";
      let rank = 3;

      if (rp > 0) {
        if (available === 0) {
          cls = "crit";
          label = "OUT OF STOCK";
          rank = 0;
        } else if (available < rp) {
          cls = "warn";
          label = `LOW STOCK (<${rp})`;
          rank = 1;
        } else {
          cls = "ok";
          label = "OPTIMAL";
          rank = 2;
        }
      } else {
        if (available === 0 && val.incoming > 0) {
          label = "INCOMING ONLY";
        } else if (available === 0) {
          label = "NO STOCK";
        }
      }

      rows.push({
        key,
        brand: val.brand,
        model: val.model,
        inStock: val.inStock,
        incoming: val.incoming,
        reserved: val.reserved,
        physical,
        available,
        tba: val.tba,
        rp,
        rank,
        label,
        cls,
      });
    }

    return rows;
  }, [machines, tbaList, reorderPts, fBranch]);

  const filtered = useMemo(() => {
    let r = allRows.slice();
    if (q.trim()) {
      const lq = q.toLowerCase();
      r = r.filter((x) => x.brand.toLowerCase().includes(lq) || x.model.toLowerCase().includes(lq));
    }
    if (fBrand) r = r.filter((x) => x.brand === fBrand);
    if (rpOnly) r = r.filter((x) => x.cls === "crit" || x.cls === "warn");
    return r.sort((a, b) => a.rank - b.rank || a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
  }, [allRows, q, fBrand, rpOnly]);

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1800px] mx-auto select-none">
      {/* 1. Pill Tabs Navigation */}
      <div className="flex items-center gap-2">
        <Link
          href="/machines"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-slate-900 font-medium text-xs transition-colors"
        >
          <span>📊</span>
          <span>Machines</span>
        </Link>

        <Link
          href="/machines/stock"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs font-bold text-slate-900 text-xs"
        >
          <span>📈</span>
          <span>Stock Levels</span>
        </Link>

        <Link
          href="/machines/tba"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-slate-900 font-medium text-xs transition-colors"
        >
          <span>🔖</span>
          <span>TBA List</span>
        </Link>
      </div>

      {/* 2. Filter Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="🔍 Search brand, model…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-full px-3.5 py-1.5 min-w-[240px] shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <select
            value={fBrand}
            onChange={(e) => setFBrand(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
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
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All branches</option>
            {allBranches.map((br) => (
              <option key={br} value={br}>
                {br}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs cursor-pointer">
            <input
              type="checkbox"
              checked={rpOnly}
              onChange={(e) => setRpOnly(e.target.checked)}
              className="rounded accent-red-600"
            />
            <span>Reorder alert only</span>
          </label>
        </div>

        <div className="text-xs text-slate-400 font-medium shrink-0">
          {filtered.length} of {allRows.length} models
        </div>
      </div>

      {/* 3. Stock Matrix Table Container */}
      <div className="bg-[#f0f9fa] border border-[#d2eaec] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-semibold">
            Calculating stock levels...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs font-semibold">
            No machine models matched the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#d2eaec] text-slate-600 font-bold text-[11px] tracking-wider uppercase bg-[#e6f4f5]/80">
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
              <tbody className="divide-y divide-[#d8eef0] bg-[#f0f9fa]/50 font-medium text-slate-700 whitespace-nowrap">
                {filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-white/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-slate-800">{r.brand}</td>
                    <td className="py-2.5 px-3.5 font-black text-slate-900">{r.model}</td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-800">{r.physical}</td>
                    <td className="py-2.5 px-3.5 text-center font-black text-emerald-700">{r.inStock}</td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-sky-700">{r.incoming}</td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-amber-700">{r.reserved}</td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs ${
                        r.available > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {r.available}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-purple-700">{r.tba}</td>
                    <td className="py-2.5 px-3.5 text-center font-mono text-slate-500">{r.rp || "—"}</td>
                    <td className="py-2.5 px-3.5 text-center">
                      {r.cls === "crit" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800">
                          {r.label}
                        </span>
                      )}
                      {r.cls === "warn" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
                          {r.label}
                        </span>
                      )}
                      {r.cls === "ok" && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">
                          {r.label}
                        </span>
                      )}
                      {r.cls === "none" && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          {r.label}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 font-medium">
        ES Machine Monitoring System - ES Print Group of Companies
      </footer>
    </div>
  );
}

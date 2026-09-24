"use client";

import { useState, useEffect } from "react";
import type { StockSummaryRow } from "../types";

export function StockMatrixClient() {
  const [stock, setStock] = useState<StockSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAlert, setFilterAlert] = useState<"all" | "critical" | "low">("all");

  async function loadStock() {
    setLoading(true);
    try {
      const res = await fetch("/api/machines/stock");
      const data = await res.json();
      if (data.stock) setStock(data.stock);
    } catch (err) {
      console.error("Error loading stock summary:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  const filtered = stock.filter((row) => {
    if (filterAlert === "critical" && row.status_alert !== "critical") return false;
    if (filterAlert === "low" && row.status_alert !== "low" && row.status_alert !== "critical") return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return row.brand.toLowerCase().includes(q) || row.model.toLowerCase().includes(q);
    }
    return true;
  });

  const totals = {
    in_stock: stock.reduce((acc, r) => acc + r.in_stock, 0),
    recert: stock.reduce((acc, r) => acc + r.recertified, 0),
    demo: stock.reduce((acc, r) => acc + r.demo, 0),
    reserved: stock.reduce((acc, r) => acc + r.reserved, 0),
    incoming: stock.reduce((acc, r) => acc + r.incoming, 0),
    tba: stock.reduce((acc, r) => acc + r.tba_count, 0),
    critical_count: stock.filter((r) => r.status_alert === "critical").length,
    low_count: stock.filter((r) => r.status_alert === "low").length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-violet-600 animate-pulse" />
            Stock & Reorder Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated physical quantities per Brand & Model, cross-referenced with Reorder levels.
          </p>
        </div>

        <button
          onClick={loadStock}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Matrix
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Stock</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{totals.in_stock}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recertified</p>
          <p className="text-xl font-black text-purple-600 mt-1">{totals.recert}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reserved</p>
          <p className="text-xl font-black text-orange-600 mt-1">{totals.reserved}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Incoming</p>
          <p className="text-xl font-black text-blue-600 mt-1">{totals.incoming}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TBA Requests</p>
          <p className="text-xl font-black text-slate-700 mt-1">{totals.tba}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stock Alerts</p>
          <p className="text-xl font-black text-rose-600 mt-1">
            {totals.critical_count + totals.low_count}
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand or model..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-2.5 text-slate-400"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterAlert("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterAlert === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Models ({stock.length})
          </button>
          <button
            onClick={() => setFilterAlert("critical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterAlert === "critical"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
            }`}
          >
            Critical (0 Stock) ({totals.critical_count})
          </button>
          <button
            onClick={() => setFilterAlert("low")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterAlert === "low"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            Below Reorder Level ({totals.low_count})
          </button>
        </div>
      </div>

      {/* Stock Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Calculating stock balances...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">No machine models matched.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Model Description</th>
                  <th className="py-3.5 px-3 text-center">In Stock</th>
                  <th className="py-3.5 px-3 text-center">Recert</th>
                  <th className="py-3.5 px-3 text-center">Demo</th>
                  <th className="py-3.5 px-3 text-center">Reserved</th>
                  <th className="py-3.5 px-3 text-center">Incoming</th>
                  <th className="py-3.5 px-3 text-center">TBA Pending</th>
                  <th className="py-3.5 px-3 text-center">Total Avail.</th>
                  <th className="py-3.5 px-3 text-center">Reorder Lvl</th>
                  <th className="py-3.5 px-4 text-center">Alert Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filtered.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-blue-600">{row.brand}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{row.model}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                      {row.in_stock}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-purple-700">
                      {row.recertified || "—"}
                    </td>
                    <td className="py-3 px-3 text-center text-amber-700 font-semibold">
                      {row.demo || "—"}
                    </td>
                    <td className="py-3 px-3 text-center text-orange-700 font-bold bg-orange-50/40">
                      {row.reserved || "—"}
                    </td>
                    <td className="py-3 px-3 text-center text-blue-700 font-semibold">
                      {row.incoming || "—"}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700">
                      {row.tba_count || "—"}
                    </td>
                    <td className="py-3 px-3 text-center font-black text-slate-900 bg-slate-100/60">
                      {row.total_available}
                    </td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-500">
                      {row.reorder_point > 0 ? row.reorder_point : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.status_alert === "critical" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                          CRITICAL (0)
                        </span>
                      ) : row.status_alert === "low" ? (
                        <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          LOW STOCK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Adequate
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
    </div>
  );
}

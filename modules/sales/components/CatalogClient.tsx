"use client";

import { useState, useEffect } from "react";
import type { CatalogMachine } from "../types";
import { formatCurrency } from "../lib/calculator";

export function CatalogClient() {
  const [machines, setMachines] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedMachine, setSelectedMachine] = useState<CatalogMachine | null>(null);

  async function loadCatalog() {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/catalog");
      const data = await res.json();
      if (data.machines) setMachines(data.machines);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  const brands = Array.from(new Set(machines.map((m) => m.brand))).filter(Boolean);

  const filtered = machines.filter((m) => {
    if (selectedBrand !== "All" && m.brand !== selectedBrand) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return m.brand.toLowerCase().includes(q) || m.model.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
            Machine Catalog & Specifications
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse full printer & machine catalog with official SRP, Cash prices, warranty specs & consumables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">
            {filtered.length} Machines Listed
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-96 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brand or model name..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
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

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-thin">
          <button
            onClick={() => setSelectedBrand("All")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              selectedBrand === "All" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedBrand === b ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Cards Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Loading machine catalog...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-xs">No machines matching your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                      {m.brand}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug group-hover:text-red-600 transition-colors">
                      {m.model}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold shrink-0">
                    {m.unit_condition}
                  </span>
                </div>

                {/* Price Matrix */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block">Official SRP:</span>
                    <span className="font-extrabold text-slate-800">{formatCurrency(m.srp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 font-semibold block">Cash Promo:</span>
                    <span className="font-black text-emerald-700">{formatCurrency(m.cash_price || m.srp)}</span>
                  </div>
                </div>

                {/* Warranty */}
                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <p>
                    <span className="font-semibold text-slate-400">Machine Warranty:</span>{" "}
                    {m.machine_warranty_months} Months
                  </p>
                  <p>
                    <span className="font-semibold text-slate-400">Printhead:</span>{" "}
                    {m.printhead_warranty === "0" ? "None / Consumable" : `${m.printhead_warranty} Months`}
                  </p>
                </div>

                {/* Inclusions summary */}
                {m.inclusions.length > 0 && (
                  <div className="text-[10.5px] text-slate-500 line-clamp-2">
                    <span className="font-semibold text-slate-700">Inclusions:</span> {m.inclusions.join(", ")}
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{m.letterhead}</span>
                <button
                  onClick={() => setSelectedMachine(m)}
                  className="px-3 py-1.5 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 rounded-lg transition-colors"
                >
                  View Full Specs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-red-400 tracking-wider">
                  {selectedMachine.brand}
                </span>
                <h3 className="text-base font-bold">{selectedMachine.model}</h3>
              </div>
              <button
                onClick={() => setSelectedMachine(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Pricing banner */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">SRP</span>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(selectedMachine.srp)}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-bold uppercase">LBP (Floor)</span>
                  <p className="text-sm font-bold text-slate-800">{formatCurrency(selectedMachine.lbp)}</p>
                </div>
                <div>
                  <span className="text-emerald-600 text-[10px] font-bold uppercase">Cash Price</span>
                  <p className="text-sm font-black text-emerald-700">
                    {formatCurrency(selectedMachine.cash_price || selectedMachine.srp)}
                  </p>
                </div>
              </div>

              {/* Inclusions */}
              {selectedMachine.inclusions.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                    Standard Inclusions
                  </h4>
                  <ul className="list-disc pl-4 space-y-1 text-slate-700">
                    {selectedMachine.inclusions.map((inc, i) => (
                      <li key={i}>{inc}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Consumables */}
              {selectedMachine.consumables.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-wider text-slate-400">
                    Consumables & Pricing
                  </h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selectedMachine.consumables.map((c, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{c.item_name}</p>
                          {c.package_description && (
                            <p className="text-[10px] text-slate-400">{c.package_description}</p>
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{formatCurrency(c.default_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedMachine(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

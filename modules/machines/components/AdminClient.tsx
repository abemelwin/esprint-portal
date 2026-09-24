"use client";

import { useState, useEffect } from "react";
import type { LookupData } from "../types";

export function AdminClient() {
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // New inputs
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newAe, setNewAe] = useState("");

  // Reorder point form
  const [reorderBrand, setReorderBrand] = useState("");
  const [reorderModel, setReorderModel] = useState("");
  const [reorderQty, setReorderQty] = useState(1);

  async function loadLookups() {
    setLoading(true);
    try {
      const res = await fetch("/api/machines/lookups");
      const data = await res.json();
      if (data.branches) setLookups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  async function handleAdd(type: "brand" | "model" | "branch" | "ae", value: string, clearFn: () => void) {
    if (!value.trim()) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", type, value }),
      });
      if (res.ok) {
        clearFn();
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddReorderPoint(e: React.FormEvent) {
    e.preventDefault();
    if (!reorderBrand || !reorderModel) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          type: "reorder_point",
          brand: reorderBrand,
          model: reorderModel,
          quantity: reorderQty,
        }),
      });
      if (res.ok) {
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(type: string, id: number) {
    if (!confirm(`Are you sure you want to remove this ${type}?`)) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", type, id }),
      });
      if (res.ok) {
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full bg-slate-900 animate-pulse" />
          Machine Monitoring Administration
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage brand catalog, model lists, branch codes, AE roster & stock reorder thresholds.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reorder Points Matrix */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Stock Reorder Thresholds</h2>
              <p className="text-xs text-slate-500">
                Trigger &quot;LOW STOCK&quot; alerts when total units in stock fall below this minimum level.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddReorderPoint} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Brand</label>
              <input
                list="admin-brands"
                value={reorderBrand}
                onChange={(e) => setReorderBrand(e.target.value)}
                placeholder="Select or type Brand"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="admin-brands">
                {lookups.brands.map((b) => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Model</label>
              <input
                list="admin-models"
                value={reorderModel}
                onChange={(e) => setReorderModel(e.target.value)}
                placeholder="Select or type Model"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <datalist id="admin-models">
                {lookups.models.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Min Threshold</label>
              <input
                type="number"
                min="0"
                value={reorderQty}
                onChange={(e) => setReorderQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Set Threshold
              </button>
            </div>
          </form>

          <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Brand</th>
                  <th className="py-2.5 px-4">Model</th>
                  <th className="py-2.5 px-4">Min. Threshold Quantity</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lookups.reorder_points.map((rp) => (
                  <tr key={rp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-blue-600">{rp.brand}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{rp.model}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{rp.quantity} units</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete("reorder_point", rp.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Brands Lookup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Manage Brands ({lookups.brands.length})</h2>
          <div className="flex gap-2">
            <input
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="e.g. Creons, Docan"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={() => handleAdd("brand", newBrand, () => setNewBrand(""))}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Add Brand
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
            {lookups.brands.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
              >
                {b.name}
                <button
                  onClick={() => handleDelete("brand", b.id)}
                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Models Lookup */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Manage Models ({lookups.models.length})</h2>
          <div className="flex gap-2">
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="e.g. CREONS 6090 UV"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              onClick={() => handleAdd("model", newModel, () => setNewModel(""))}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Add Model
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
            {lookups.models.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
              >
                {m.name}
                <button
                  onClick={() => handleDelete("model", m.id)}
                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Branches */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Branch Codes ({lookups.branches.length})</h2>
          <div className="flex gap-2">
            <input
              value={newBranch}
              onChange={(e) => setNewBranch(e.target.value)}
              placeholder="e.g. DAVAO"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
            />
            <button
              onClick={() => handleAdd("branch", newBranch, () => setNewBranch(""))}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Add Branch
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
            {lookups.branches.map((b) => (
              <span
                key={b.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
              >
                {b.code}
                <button
                  onClick={() => handleDelete("branch", b.id)}
                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* AEs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">AE Codes ({lookups.aes.length})</h2>
          <div className="flex gap-2">
            <input
              value={newAe}
              onChange={(e) => setNewAe(e.target.value)}
              placeholder="e.g. JLS"
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
            />
            <button
              onClick={() => handleAdd("ae", newAe, () => setNewAe(""))}
              className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
            >
              Add AE
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
            {lookups.aes.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
              >
                {a.code}
                <button
                  onClick={() => handleDelete("ae", a.id)}
                  className="text-slate-400 hover:text-red-600 font-bold ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

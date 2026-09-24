"use client";

import { useState, useEffect } from "react";
import type { CatalogMachine } from "../types";
import { formatCurrency } from "../lib/calculator";

export function AdminClient() {
  const [machines, setMachines] = useState<CatalogMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMachine, setEditingMachine] = useState<Partial<CatalogMachine> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadData() {
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
    loadData();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMachine?.brand || !editingMachine?.model) return;
    setSaving(true);
    try {
      const isEdit = !!editingMachine.id;
      const url = isEdit ? `/api/sales/catalog/${editingMachine.id}` : "/api/sales/catalog";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMachine),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingMachine(null);
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to save machine");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving machine");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, model: string) {
    if (!confirm(`Delete machine listing for ${model}?`)) return;
    try {
      const res = await fetch(`/api/sales/catalog/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-slate-900 animate-pulse" />
            Catalog & Price Editor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage official machine prices (SRP, LBP, Cash Promo), warranty specifications & inclusions.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingMachine({
              brand: "",
              model: "",
              unit_condition: "Brand New",
              letterhead: "ES Print Media Inc.",
              srp: 0,
              lbp: 0,
              cash_price: 0,
              machine_warranty_months: 12,
              printhead_warranty: "0",
              inclusions: [],
              consumables: [],
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all"
        >
          + Add Catalog Machine
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500">Loading catalog...</div>
        ) : machines.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400">No catalog entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                  <th className="py-3.5 px-4">Brand</th>
                  <th className="py-3.5 px-4">Model Description</th>
                  <th className="py-3.5 px-4">Condition</th>
                  <th className="py-3.5 px-4">Official SRP</th>
                  <th className="py-3.5 px-4">Cash Price</th>
                  <th className="py-3.5 px-4">Warranty</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-red-600">{m.brand}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{m.model}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px]">
                        {m.unit_condition}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{formatCurrency(m.srp)}</td>
                    <td className="py-3 px-4 font-black text-emerald-700">{formatCurrency(m.cash_price || m.srp)}</td>
                    <td className="py-3 px-4 text-slate-600">{m.machine_warranty_months} Mos</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingMachine(m);
                          setIsModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m.id, m.model)}
                        className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && editingMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingMachine.id ? "Edit Catalog Item" : "New Catalog Item"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand</label>
                  <input
                    value={editingMachine.brand || ""}
                    onChange={(e) => setEditingMachine({ ...editingMachine, brand: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Model Name</label>
                  <input
                    value={editingMachine.model || ""}
                    onChange={(e) => setEditingMachine({ ...editingMachine, model: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SRP (PHP)</label>
                  <input
                    type="number"
                    value={editingMachine.srp || ""}
                    onChange={(e) => setEditingMachine({ ...editingMachine, srp: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">LBP (PHP)</label>
                  <input
                    type="number"
                    value={editingMachine.lbp || ""}
                    onChange={(e) => setEditingMachine({ ...editingMachine, lbp: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cash Price</label>
                  <input
                    type="number"
                    value={editingMachine.cash_price || ""}
                    onChange={(e) => setEditingMachine({ ...editingMachine, cash_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Condition</label>
                  <select
                    value={editingMachine.unit_condition || "Brand New"}
                    onChange={(e) => setEditingMachine({ ...editingMachine, unit_condition: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Brand New">Brand New</option>
                    <option value="Re-certified">Re-certified</option>
                    <option value="Demo Unit">Demo Unit</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    value={editingMachine.machine_warranty_months || 12}
                    onChange={(e) => setEditingMachine({ ...editingMachine, machine_warranty_months: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm"
                >
                  {saving ? "Saving..." : "Save Catalog Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

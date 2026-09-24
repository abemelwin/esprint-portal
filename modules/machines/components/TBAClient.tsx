"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { TBAListItem, Machine, LookupData } from "../types";

export function TBAClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tbaList, setTbaList] = useState<TBAListItem[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fModel, setFModel] = useState("");
  const [fAE, setFAE] = useState("");

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TBAListItem | null>(null);
  const [form, setForm] = useState({
    brand: "",
    model: "",
    client_name: "",
    client_code: "",
    location: "",
    ae: "",
    reservation_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [tRes, mRes, lRes] = await Promise.all([
        fetch("/api/machines/tba"),
        fetch("/api/machines"),
        fetch("/api/machines/lookups"),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();
      const lData = await lRes.json();
      if (tData.tba) setTbaList(tData.tba);
      if (mData.machines) setMachines(mData.machines);
      if (lData.branches) setLookups(lData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setEditingTarget(null);
    setForm({
      brand: lookups.brands[0]?.name || "",
      model: lookups.models[0]?.name || "",
      client_name: "",
      client_code: "",
      location: "",
      ae: lookups.aes[0]?.code || "",
      reservation_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setErr("");
    setIsModalOpen(true);
  };

  const openEdit = (t: TBAListItem) => {
    setEditingTarget(t);
    setForm({
      brand: t.brand || "",
      model: t.model,
      client_name: t.client_name || "",
      client_code: t.client_code || "",
      location: t.location || "",
      ae: t.ae || "",
      reservation_date: t.reservation_date || new Date().toISOString().slice(0, 10),
      notes: t.notes || "",
    });
    setErr("");
    setIsModalOpen(true);
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model.trim()) {
      setErr("Please enter a Model.");
      return;
    }
    if (!form.client_name.trim()) {
      setErr("Please enter a Client Name.");
      return;
    }
    setSaving(true);
    setErr("");

    try {
      if (editingTarget) {
        // Update TBA
        await fetch(`/api/machines/tba?id=${editingTarget.id}`, { method: "DELETE" });
        await fetch("/api/machines/tba", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        const res = await fetch("/api/machines/tba", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to add TBA request.");
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : "Error saving TBA request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: TBAListItem) {
    if (!confirm(`Delete TBA reservation for ${t.client_name || "Client"} (${t.brand} ${t.model})?`)) return;
    try {
      const res = await fetch(`/api/machines/tba?id=${t.id}`, { method: "DELETE" });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleFulfil(t: TBAListItem) {
    // Find an in-stock unit of this brand & model
    const unit = machines.find(
      (m) =>
        m.status === "In Stock" &&
        (m.brand || "").trim().toLowerCase() === (t.brand || "").trim().toLowerCase() &&
        m.model.trim().toLowerCase() === t.model.trim().toLowerCase()
    );

    if (!unit) {
      alert(`No available In Stock unit of ${t.brand} ${t.model} to allot. Add stock first.`);
      return;
    }

    const ok = confirm(
      `Allot in-stock unit (Serial: ${unit.serial_no || "No Serial"}) to ${t.client_name || "Client"} and reserve it?`
    );
    if (!ok) return;

    try {
      // 1. Reserve machine
      await fetch(`/api/machines/${unit.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: t.client_name,
          client_code: t.client_code,
          ae: t.ae,
          location: t.location,
          reservation_date: t.reservation_date || new Date().toISOString().slice(0, 10),
          notes: `Fulfilled from TBA list. ${t.notes || ""}`,
        }),
      });

      // 2. Delete TBA item
      await fetch(`/api/machines/tba?id=${t.id}`, { method: "DELETE" });

      alert(`Successfully reserved unit ${unit.serial_no || unit.model} for ${t.client_name}.`);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Error fulfilling TBA reservation.");
    }
  }

  const filtered = useMemo(() => {
    let rows = tbaList.slice();
    if (q.trim()) {
      const lq = q.toLowerCase();
      rows = rows.filter((t) => {
        return (
          (t.brand || "").toLowerCase().includes(lq) ||
          (t.model || "").toLowerCase().includes(lq) ||
          (t.client_name || "").toLowerCase().includes(lq) ||
          (t.client_code || "").toLowerCase().includes(lq) ||
          (t.location || "").toLowerCase().includes(lq) ||
          (t.ae || "").toLowerCase().includes(lq)
        );
      });
    }
    if (fBrand) rows = rows.filter((t) => t.brand === fBrand);
    if (fModel) rows = rows.filter((t) => t.model === fModel);
    if (fAE) rows = rows.filter((t) => t.ae === fAE);
    return rows.sort((a, b) => (a.brand || "").localeCompare(b.brand || "") || a.model.localeCompare(b.model));
  }, [tbaList, q, fBrand, fModel, fAE]);

  const uniq = (k: keyof TBAListItem) => [...new Set(tbaList.map((t) => t[k]).filter(Boolean))].sort() as string[];

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1800px] mx-auto select-none">
      {/* 1. Pill Tabs Navigation */}
      <div className="flex items-center justify-between gap-2">
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
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl hover:bg-white text-slate-500 hover:text-slate-900 font-medium text-xs transition-colors"
          >
            <span>📈</span>
            <span>Stock Levels</span>
          </Link>

          <Link
            href="/machines/tba"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs font-bold text-slate-900 text-xs"
          >
            <span>🔖</span>
            <span>TBA List</span>
          </Link>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          + Add TBA Reservation
        </button>
      </div>

      {/* 2. Filter Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="🔍 Search TBA client, model, code, AE…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-white border border-slate-200 text-slate-800 text-xs rounded-full px-3.5 py-1.5 min-w-[280px] shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <select
            value={fBrand}
            onChange={(e) => setFBrand(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All brands</option>
            {uniq("brand").map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <select
            value={fModel}
            onChange={(e) => setFModel(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All models</option>
            {uniq("model").map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={fAE}
            onChange={(e) => setFAE(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All AEs</option>
            {uniq("ae").map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400 font-medium shrink-0">
          {filtered.length} of {tbaList.length} shown
        </div>
      </div>

      {/* 3. TBA List Table Container */}
      <div className="bg-[#f0f9fa] border border-[#d2eaec] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading TBA list...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">
            No pending TBA reservations found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-3.5">Brand</th>
                  <th className="py-3 px-3.5">Model</th>
                  <th className="py-3 px-3.5">Client Name</th>
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5">AE</th>
                  <th className="py-3 px-3.5">Reservation Date</th>
                  <th className="py-3 px-3.5">Notes</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 whitespace-nowrap">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-2.5 px-3.5 font-bold text-blue-700">{t.brand || "—"}</td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">{t.model}</td>
                    <td className="py-2.5 px-3.5 font-bold text-slate-900">{t.client_name || "—"}</td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-500">{t.client_code || "—"}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">{t.location || "—"}</td>
                    <td className="py-2.5 px-3.5 font-bold text-blue-600">{t.ae || "—"}</td>
                    <td className="py-2.5 px-3.5 text-slate-600">{t.reservation_date || "—"}</td>
                    <td className="py-2.5 px-3.5 text-slate-500 text-[11px] max-w-[200px] truncate">{t.notes || "—"}</td>
                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Fulfil / Allot Button */}
                        <button
                          onClick={() => handleFulfil(t)}
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                        >
                          Allot Unit
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit TBA Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingTarget ? "Edit TBA Reservation" : "Add TBA Reservation"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3.5 text-xs">
              {err && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl font-bold">
                  {err}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Brand</label>
                  <select
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="">-- Select Brand --</option>
                    {lookups.brands.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="">-- Select Model --</option>
                    {lookups.models.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Client Code</label>
                  <input
                    value={form.client_code}
                    onChange={(e) => setForm({ ...form, client_code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">AE</label>
                  <select
                    value={form.ae}
                    onChange={(e) => setForm({ ...form, ae: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                  >
                    <option value="">-- Select AE --</option>
                    {lookups.aes.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reservation Date</label>
                <input
                  type="date"
                  value={form.reservation_date}
                  onChange={(e) => setForm({ ...form, reservation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save TBA"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 font-medium">
        ES Machine Monitoring System - ES Print Group of Companies
      </footer>
    </div>
  );
}



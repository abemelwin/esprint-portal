"use client";

import { useState, useEffect } from "react";
import type { TBAListItem, LookupData } from "../types";

export function TBAClient({ isAdmin = false }: { isAdmin?: boolean }) {
  const [tbaList, setTbaList] = useState<TBAListItem[]>([]);
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  // New TBA Form State
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newClientCode, setNewClientCode] = useState("");
  const [newAe, setNewAe] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [tbaRes, lookRes] = await Promise.all([
        fetch("/api/machines/tba"),
        fetch("/api/machines/lookups"),
      ]);
      const tData = await tbaRes.json();
      const lData = await lookRes.json();
      if (tData.tba) setTbaList(tData.tba);
      if (lData.branches) setLookups(lData);
    } catch (err) {
      console.error("Error loading TBA:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddTBA(e: React.FormEvent) {
    e.preventDefault();
    if (!newModel || !newClient) {
      alert("Model and Client Name are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/machines/tba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newBrand,
          model: newModel,
          client_name: newClient,
          client_code: newClientCode,
          ae: newAe,
          location: newLocation,
          reservation_date: newDate,
          notes: newNotes,
        }),
      });
      if (res.ok) {
        setIsAddOpen(false);
        setNewClient("");
        setNewClientCode("");
        setNewNotes("");
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to add TBA request");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding TBA item");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTBA(id: string, clientName: string) {
    if (!confirm(`Delete TBA reservation for ${clientName || "client"}?`)) return;
    try {
      const res = await fetch(`/api/machines/tba?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting TBA request");
    }
  }

  const filtered = tbaList.filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const brand = (item.brand || "").toLowerCase();
      const model = (item.model || "").toLowerCase();
      const client = (item.client_name || "").toLowerCase();
      const ae = (item.ae || "").toLowerCase();
      return brand.includes(q) || model.includes(q) || client.includes(q) || ae.includes(q);
    }
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            TBA Reservations List
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Client bookings awaiting allocation to physical unit serial numbers.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-95"
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add TBA Reservation
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="w-full sm:w-96 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, brand, model, AE..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
      </div>

      {/* TBA List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading TBA reservations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">No pending TBA reservations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Client Information</th>
                  <th className="py-3.5 px-4">Requested Model</th>
                  <th className="py-3.5 px-4">Assigned AE</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4">Reservation Date</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.client_name}</div>
                      {item.client_code && (
                        <div className="text-[11px] text-slate-400 font-mono">{item.client_code}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.model}</div>
                      <div className="text-[11px] text-amber-600 font-semibold">{item.brand || "Unbranded"}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-[11px]">
                        {item.ae || "Unassigned"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{item.location || "—"}</td>
                    <td className="py-3 px-4 text-slate-600 font-semibold">{item.reservation_date || "—"}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px] max-w-xs truncate">{item.notes || "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteTBA(item.id, item.client_name || "")}
                        title="Delete / Fulfill TBA"
                        className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add TBA Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="px-6 py-4 bg-amber-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">New TBA Reservation</h3>
                <p className="text-xs text-amber-100">Reservation without assigned serial number</p>
              </div>
              <button onClick={() => setIsAddOpen(false)} className="text-amber-200 hover:text-white p-1">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTBA} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                  placeholder="e.g. Apex Visuals"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand</label>
                  <input
                    list="tba-brands"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="e.g. Creons"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <datalist id="tba-brands">
                    {lookups.brands.map((b) => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <input
                    list="tba-models"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g. Creons DTF 4-Head"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <datalist id="tba-models">
                    {lookups.models.map((m) => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned AE</label>
                  <select
                    value={newAe}
                    onChange={(e) => setNewAe(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                  >
                    <option value="">-- Select AE --</option>
                    {lookups.aes.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
                  <input
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Laguna"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reservation Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={2}
                  placeholder="Requested delivery timeframe, deal terms..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-md disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save TBA Reservation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

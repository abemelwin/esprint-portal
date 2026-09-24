"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, LookupData, MachineStatus } from "../types";
import {
  MachineFormModal,
  ReserveModal,
  DeliverModal,
  HistoryModal,
  ALL_STATUSES,
  STATUS_PILLS,
} from "./Modals";
import type { MachinePermissions } from "@/lib/rbac";

const DASH = <span className="text-slate-400">—</span>;

export function MachinesClient({
  permissions,
  userEmail,
}: {
  permissions: MachinePermissions;
  userEmail: string;
}) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters (matching original MachinesView.tsx)
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fModel, setFModel] = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fAE, setFAE] = useState("");
  const [hideDel, setHideDel] = useState(false);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [reservingMachine, setReservingMachine] = useState<Machine | null>(null);
  const [deliveringMachine, setDeliveringMachine] = useState<Machine | null>(null);
  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [machRes, lookRes] = await Promise.all([
        fetch("/api/machines"),
        fetch("/api/machines/lookups"),
      ]);
      const machData = await machRes.json();
      const lookData = await lookRes.json();
      if (machData.machines) setMachines(machData.machines);
      if (lookData.branches) setLookups(lookData);
    } catch (err) {
      console.error("Error loading machines data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Actions
  async function markArrived(m: Machine) {
    if (!confirm(`Mark ${m.brand} ${m.model} (PO: ${m.po_no || "N/A"}) as arrived (In Stock)?`)) return;
    try {
      const res = await fetch(`/api/machines/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...m, status: "In Stock" }),
      });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function moveToTBA(m: Machine) {
    if (!confirm(`Move reservation for ${m.client_name || "client"} to TBA list? The unit will return to In Stock.`)) return;
    try {
      // 1. Create TBA item
      await fetch("/api/machines/tba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: m.brand,
          model: m.model,
          client_name: m.client_name,
          client_code: m.client_code,
          location: m.location,
          ae: m.ae,
          reservation_date: m.reservation_date,
          notes: m.notes,
        }),
      });

      // 2. Unreserve unit
      await fetch(`/api/machines/${m.id}/unreserve`, { method: "POST" });
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleUnreserve(m: Machine) {
    if (!confirm(`Unreserve ${m.model} (currently reserved for ${m.client_name || "Client"})?`)) return;
    try {
      const res = await fetch(`/api/machines/${m.id}/unreserve`, { method: "POST" });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(m: Machine) {
    if (!confirm(`Permanently delete ${m.brand} ${m.model} (SN: ${m.serial_no || "No Serial"})?`)) return;
    try {
      const res = await fetch(`/api/machines/${m.id}`, { method: "DELETE" });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  }

  // Filtered rows
  const filtered = useMemo(() => {
    let rows = machines.slice();
    if (hideDel) rows = rows.filter((m) => m.status !== "Delivered");
    if (fStatus) rows = rows.filter((m) => m.status === fStatus);
    if (fBrand) rows = rows.filter((m) => m.brand === fBrand);
    if (fModel) rows = rows.filter((m) => m.model === fModel);
    if (fBranch) rows = rows.filter((m) => m.branch === fBranch);
    if (fAE) rows = rows.filter((m) => m.ae === fAE);
    if (q.trim()) {
      const lq = q.toLowerCase();
      rows = rows.filter((m) => {
        return (
          (m.serial_no || "").toLowerCase().includes(lq) ||
          (m.po_no || "").toLowerCase().includes(lq) ||
          (m.model || "").toLowerCase().includes(lq) ||
          (m.brand || "").toLowerCase().includes(lq) ||
          (m.branch || "").toLowerCase().includes(lq) ||
          (m.ae || "").toLowerCase().includes(lq) ||
          (m.client_name || "").toLowerCase().includes(lq) ||
          (m.client_code || "").toLowerCase().includes(lq) ||
          (m.location || "").toLowerCase().includes(lq)
        );
      });
    }
    return rows;
  }, [machines, hideDel, fStatus, fBrand, fModel, fBranch, fAE, q]);

  // Unique options
  const uniq = (key: keyof Machine) =>
    [...new Set(machines.map((m) => m[key]).filter(Boolean))].sort() as string[];

  function exportCSV() {
    const headers = [
      "Status",
      "PO No.",
      "Brand",
      "Model",
      "Branch",
      "Client Name",
      "Code",
      "Location",
      "AE",
      "Reservation Date",
      "Delivery Date",
      "Serial",
      "Shipment Receipt / Transfer Date",
      "Notes",
    ];
    const rows = filtered.map((m) => [
      `"${m.status || ""}"`,
      `"${m.po_no || ""}"`,
      `"${m.brand || ""}"`,
      `"${m.model || ""}"`,
      `"${m.branch || ""}"`,
      `"${m.client_name || ""}"`,
      `"${m.client_code || ""}"`,
      `"${m.location || ""}"`,
      `"${m.ae || ""}"`,
      `"${m.reservation_date || ""}"`,
      `"${m.delivery_date || ""}"`,
      `"${m.serial_no || ""}"`,
      `"${m.dispatch_date || ""}"`,
      `"${(m.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `esprint_machines_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-4 max-w-[1700px] mx-auto">
      {/* Top Title & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>🖨️</span> Machine Inventory Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical inventory, serial assignment, client reservations, and delivery dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>

          {permissions.canEdit && (
            <button
              onClick={() => {
                setEditingMachine(null);
                setIsAddOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all active:scale-95"
            >
              + Add Machine Unit
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar (identical to original) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2.5 text-xs">
        <input
          type="search"
          placeholder="🔍 Search serial, model, client, code, branch…"
          className="bg-slate-50 border border-slate-300 text-slate-900 px-3 py-1.5 rounded-xl text-xs min-w-[260px] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_PILLS[s].icon} {s}
            </option>
          ))}
        </select>

        <select
          value={fBrand}
          onChange={(e) => setFBrand(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
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
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All models</option>
          {uniq("model").map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={fBranch}
          onChange={(e) => setFBranch(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All branches</option>
          {uniq("branch").map((br) => (
            <option key={br} value={br}>
              {br}
            </option>
          ))}
        </select>

        <select
          value={fAE}
          onChange={(e) => setFAE(e.target.value)}
          className="bg-slate-50 border border-slate-300 text-slate-800 px-2.5 py-1.5 rounded-xl text-xs focus:bg-white font-medium focus:outline-none"
        >
          <option value="">All AEs</option>
          {uniq("ae").map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl cursor-pointer select-none hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={hideDel}
            onChange={(e) => setHideDel(e.target.checked)}
            className="cursor-pointer accent-blue-600 rounded"
          />
          <span>Hide delivered</span>
        </label>

        <span className="flex-1" />

        <span className="text-[11.5px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
          {filtered.length} of {machines.length} shown
        </span>
      </div>

      {/* Main Table (exact columns matching original) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading machine units...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs font-semibold">
            No machine units matched the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">PO No.</th>
                  <th className="py-3 px-3.5">Brand</th>
                  <th className="py-3 px-3.5">Model</th>
                  <th className="py-3 px-3.5">Branch</th>
                  <th className="py-3 px-3.5">Client Name</th>
                  <th className="py-3 px-3.5">Code</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5">AE</th>
                  <th className="py-3 px-3.5">Reservation Date</th>
                  <th className="py-3 px-3.5">Delivery Date</th>
                  <th className="py-3 px-3.5">Serial</th>
                  <th className="py-3 px-3.5">Transfer Date</th>
                  <th className="py-3 px-3.5">Notes</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 whitespace-nowrap">
                {filtered.map((m) => {
                  const pill = STATUS_PILLS[m.status] || STATUS_PILLS["In Stock"];
                  return (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Status */}
                      <td className="py-2.5 px-3.5">
                        <span
                          style={{ backgroundColor: pill.bg, color: pill.text, borderColor: pill.border }}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5"
                        >
                          <span>{pill.icon}</span>
                          <span>{pill.label}</span>
                        </span>
                      </td>

                      {/* PO No */}
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-800">
                        {m.po_no || DASH}
                      </td>

                      {/* Brand */}
                      <td className="py-2.5 px-3.5 font-bold text-blue-700">
                        {m.brand || DASH}
                      </td>

                      {/* Model */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        {m.model}
                      </td>

                      {/* Branch */}
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {m.branch || DASH}
                        </span>
                      </td>

                      {/* Client Name */}
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        {m.client_name || DASH}
                      </td>

                      {/* Code */}
                      <td className="py-2.5 px-3.5 font-mono text-slate-500">
                        {m.client_code || DASH}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3.5 text-slate-600">
                        {m.location || DASH}
                      </td>

                      {/* AE */}
                      <td className="py-2.5 px-3.5 font-bold text-blue-600">
                        {m.ae || DASH}
                      </td>

                      {/* Reservation Date */}
                      <td className="py-2.5 px-3.5 text-slate-600">
                        {m.reservation_date || DASH}
                      </td>

                      {/* Delivery Date */}
                      <td className="py-2.5 px-3.5 font-bold text-emerald-700">
                        {m.delivery_date || DASH}
                      </td>

                      {/* Serial */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                        {m.serial_no || DASH}
                      </td>

                      {/* Transfer Date */}
                      <td className="py-2.5 px-3.5 text-slate-600">
                        {m.dispatch_date || DASH}
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3.5 text-slate-500 text-[11px] max-w-[200px] truncate">
                        {m.notes || DASH}
                      </td>

                      {/* Actions (exact original actions) */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Arrive */}
                          {permissions.canEdit && m.status === "Incoming" && (
                            <button
                              onClick={() => markArrived(m)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                            >
                              Arrived
                            </button>
                          )}

                          {/* Reserve */}
                          {permissions.canReserve &&
                            (m.status === "In Stock" || m.status === "Recertified" || m.status === "Demo") && (
                              <button
                                onClick={() => setReservingMachine(m)}
                                className="px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                              >
                                Reserve
                              </button>
                            )}

                          {/* Deliver */}
                          {permissions.canDeliver &&
                            (m.status === "Reserved" || m.status === "In Stock" || m.status === "Demo" || m.status === "Recertified") && (
                              <button
                                onClick={() => setDeliveringMachine(m)}
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                              >
                                Deliver
                              </button>
                            )}

                          {/* Move to TBA */}
                          {permissions.canReserve && m.status === "Reserved" && (
                            <button
                              onClick={() => moveToTBA(m)}
                              title="Move reservation to TBA list & return unit to In Stock"
                              className="px-2.5 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                            >
                              TBA
                            </button>
                          )}

                          {/* Unreserve */}
                          {permissions.canUnreserve && m.status === "Reserved" && (
                            <button
                              onClick={() => handleUnreserve(m)}
                              className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              Unreserve
                            </button>
                          )}

                          {/* Edit */}
                          {permissions.canEdit && (
                            <button
                              onClick={() => {
                                setEditingMachine(m);
                                setIsAddOpen(true);
                              }}
                              className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              Edit
                            </button>
                          )}

                          {/* Delete */}
                          {permissions.canEdit && (
                            <button
                              onClick={() => handleDelete(m)}
                              className="px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                            >
                              Delete
                            </button>
                          )}

                          {/* Log */}
                          <button
                            onClick={() => setHistoryMachine(m)}
                            title="Audit Log"
                            className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg"
                          >
                            Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <MachineFormModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={loadData}
        initialData={editingMachine}
        lookups={lookups}
      />

      <ReserveModal
        isOpen={!!reservingMachine}
        onClose={() => setReservingMachine(null)}
        onSuccess={loadData}
        machine={reservingMachine}
        lookups={lookups}
      />

      <DeliverModal
        isOpen={!!deliveringMachine}
        onClose={() => setDeliveringMachine(null)}
        onSuccess={loadData}
        machine={deliveringMachine}
      />

      <HistoryModal
        isOpen={!!historyMachine}
        onClose={() => setHistoryMachine(null)}
        machine={historyMachine}
      />
    </div>
  );
}

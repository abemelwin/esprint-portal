"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, LookupData, MachineStatus } from "../types";
import {
  MachineFormModal,
  ReserveModal,
  DeliverModal,
  HistoryModal,
  ALL_STATUSES,
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

  // Filters matching Screenshot 2
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

    // Listen for events dispatched from MachinesTopNav (via machines-shell)
    function handleOpenAdd() {
      setEditingMachine(null);
      setIsAddOpen(true);
    }
    function handleExportCSV() {
      exportCSV();
    }

    window.addEventListener("machines:open-add", handleOpenAdd);
    window.addEventListener("machines:export-csv", handleExportCSV);
    window.addEventListener("machines:backup", handleExportCSV); // same action as CSV backup

    return () => {
      window.removeEventListener("machines:open-add", handleOpenAdd);
      window.removeEventListener("machines:export-csv", handleExportCSV);
      window.removeEventListener("machines:backup", handleExportCSV);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function getStatusPill(status: string) {
    if (status === "In Stock") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
          In Stock
        </span>
      );
    }
    if (status === "Incoming") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e0f2fe] text-[#0369a1]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7]" />
          Incoming
        </span>
      );
    }
    if (status === "Reserved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef3c7] text-[#b45309]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
          Reserved
        </span>
      );
    }
    if (status === "Delivered") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Delivered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
        {status}
      </span>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1800px] mx-auto select-none">
      {/* 2. Filter Toolbar Row (Exact Screenshot 2) */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Pill */}
          <div className="relative">
            <input
              type="search"
              placeholder="🔍 Search serial, model, client, code, bra..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-full px-3.5 py-1.5 min-w-[280px] shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Status Dropdown */}
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Brand Dropdown */}
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

          {/* Model Dropdown */}
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

          {/* Branch Dropdown */}
          <select
            value={fBranch}
            onChange={(e) => setFBranch(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All branches</option>
            {uniq("branch").map((br) => (
              <option key={br} value={br}>
                {br}
              </option>
            ))}
          </select>

          {/* AE Dropdown */}
          <select
            value={fAE}
            onChange={(e) => setFAE(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="">All AEs</option>
            {uniq("ae").map((ae) => (
              <option key={ae} value={ae}>
                {ae}
              </option>
            ))}
          </select>

          {/* Hide Delivered Checkbox */}
          <label className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-full px-3 py-1.5 shadow-2xs cursor-pointer">
            <input
              type="checkbox"
              checked={hideDel}
              onChange={(e) => setHideDel(e.target.checked)}
              className="rounded accent-blue-600"
            />
            <span>Hide delivered</span>
          </label>
        </div>

        {/* Counter */}
        <div className="text-xs text-slate-400 font-medium shrink-0">
          {filtered.length} of {machines.length} shown
        </div>
      </div>

      {/* 3. Data Table Container (Matching Screenshot 2 soft tint & rounded borders) */}
      <div className="bg-[#f0f9fa] border border-[#d2eaec] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b border-[#d2eaec] text-slate-600 font-bold text-[11px] tracking-wider uppercase bg-[#e6f4f5]/80">
                <th className="py-3 px-3">STATUS</th>
                <th className="py-3 px-3">PO NO.</th>
                <th className="py-3 px-3">BRAND</th>
                <th className="py-3 px-3">MODEL</th>
                <th className="py-3 px-3">BRANCH</th>
                <th className="py-3 px-3">CLIENT NAME</th>
                <th className="py-3 px-3">CODE</th>
                <th className="py-3 px-3">LOCATION</th>
                <th className="py-3 px-3">AE</th>
                <th className="py-3 px-3">RESERVATION DATE</th>
                <th className="py-3 px-3">DELIVERY DATE</th>
                <th className="py-3 px-3">SERIAL</th>
                <th className="py-3 px-3">SHIPMENT RECEIPT / TRANSFER DATE</th>
                <th className="py-3 px-3">NOTES</th>
                <th className="py-3 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d8eef0] bg-[#f0f9fa]/50">
              {loading ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    Loading machine inventory...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-400">
                    No machine records found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-white/70 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getStatusPill(m.status)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                      {m.po_no || DASH}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 uppercase whitespace-nowrap">
                      {m.brand || DASH}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                      {m.model || DASH}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 uppercase whitespace-nowrap">
                      {m.branch || DASH}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {m.client_name || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {m.client_code || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {m.location || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                      {m.ae || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {m.reservation_date || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {m.delivery_date || DASH}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {m.serial_no || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {m.dispatch_date || DASH}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={m.notes || ""}>
                      {m.notes || DASH}
                    </td>
                    {/* Action Icon Buttons Matching Screenshot 2 */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {/* 🏷️ Reserve Button */}
                        {m.status !== "Delivered" && (
                          <button
                            title="Reserve Machine"
                            onClick={() => setReservingMachine(m)}
                            className="w-7 h-7 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                              <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                          </button>
                        )}

                        {/* ✅ Deliver Button */}
                        {m.status !== "Delivered" && (
                          <button
                            title="Mark Delivered"
                            onClick={() => setDeliveringMachine(m)}
                            className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        )}

                        {/* 🕒 History Button */}
                        <button
                          title="View History Log"
                          onClick={() => setHistoryMachine(m)}
                          className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </button>

                        {/* ✏️ Edit Button */}
                        {permissions.canEdit && (
                          <button
                            title="Edit Unit"
                            onClick={() => {
                              setEditingMachine(m);
                              setIsAddOpen(true);
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}

                        {/* 🗑️ Delete Button */}
                        {permissions.canDelete && (
                          <button
                            title="Delete Unit"
                            onClick={() => handleDelete(m)}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Bottom Footer (Matching Screenshot 2) */}
      <footer className="py-6 text-center text-xs text-slate-400 font-medium">
        ES Machine Monitoring System - ES Print Group of Companies
      </footer>

      {/* Modals */}
      <MachineFormModal
        isOpen={isAddOpen}
        initialData={editingMachine}
        lookups={lookups}
        onClose={() => {
          setIsAddOpen(false);
          setEditingMachine(null);
        }}
        onSuccess={() => {
          setIsAddOpen(false);
          setEditingMachine(null);
          loadData();
        }}
      />

      <ReserveModal
        isOpen={!!reservingMachine}
        machine={reservingMachine}
        lookups={lookups}
        onClose={() => setReservingMachine(null)}
        onSuccess={() => {
          setReservingMachine(null);
          loadData();
        }}
      />

      <DeliverModal
        isOpen={!!deliveringMachine}
        machine={deliveringMachine}
        onClose={() => setDeliveringMachine(null)}
        onSuccess={() => {
          setDeliveringMachine(null);
          loadData();
        }}
      />

      <HistoryModal
        isOpen={!!historyMachine}
        machine={historyMachine}
        onClose={() => setHistoryMachine(null)}
      />
    </div>
  );
}


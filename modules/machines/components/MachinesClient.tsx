"use client";

import { useState, useEffect, useMemo } from "react";
import type { Machine, LookupData, MachineStatus } from "../types";
import { MachineFormModal, ReserveModal, DeliverModal, HistoryModal } from "./Modals";
import type { MachinePermissions } from "@/lib/rbac";

const STATUS_TABS: { label: string; value: string; color: string }[] = [
  { label: "All Units", value: "All", color: "bg-slate-100 text-slate-700" },
  { label: "In Stock", value: "In Stock", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { label: "Incoming", value: "Incoming", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "Recertified", value: "Recertified", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { label: "Demo Units", value: "Demo", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { label: "Reserved", value: "Reserved", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { label: "Delivered", value: "Delivered", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { label: "Pullout Parts", value: "Pullout Parts", color: "bg-red-50 text-red-700 border-red-200" },
];

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

  // Filters
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedAe, setSelectedAe] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

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

  async function handleUnreserve(machine: Machine) {
    if (!confirm(`Are you sure you want to unreserve ${machine.brand} ${machine.model} (SN: ${machine.serial_no || "N/A"})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/machines/${machine.id}/unreserve`, { method: "POST" });
      if (res.ok) {
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to unreserve");
      }
    } catch (err) {
      console.error(err);
      alert("Error unreserving unit");
    }
  }

  async function handleDelete(machine: Machine) {
    if (!confirm(`Permanently delete unit ${machine.brand} ${machine.model} (SN: ${machine.serial_no || "N/A"})?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/machines/${machine.id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting unit");
    }
  }

  // Filtered machines
  const filtered = useMemo(() => {
    return machines.filter((m) => {
      if (selectedStatus !== "All" && m.status !== selectedStatus) return false;
      if (selectedBranch !== "All" && m.branch !== selectedBranch) return false;
      if (selectedBrand !== "All" && m.brand !== selectedBrand) return false;
      if (selectedAe !== "All" && m.ae !== selectedAe) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const sn = (m.serial_no || "").toLowerCase();
        const po = (m.po_no || "").toLowerCase();
        const model = (m.model || "").toLowerCase();
        const brand = (m.brand || "").toLowerCase();
        const client = (m.client_name || "").toLowerCase();
        if (!sn.includes(q) && !po.includes(q) && !model.includes(q) && !brand.includes(q) && !client.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [machines, selectedStatus, selectedBranch, selectedBrand, selectedAe, searchQuery]);

  // Export CSV
  function handleExportCSV() {
    const headers = [
      "Brand",
      "Model",
      "Serial No",
      "PO No",
      "Branch",
      "Status",
      "Client Name",
      "Client Code",
      "AE",
      "Location",
      "Reservation Date",
      "Delivery Date",
      "Notes",
    ];
    const rows = filtered.map((m) => [
      `"${m.brand || ""}"`,
      `"${m.model || ""}"`,
      `"${m.serial_no || ""}"`,
      `"${m.po_no || ""}"`,
      `"${m.branch || ""}"`,
      `"${m.status || ""}"`,
      `"${m.client_name || ""}"`,
      `"${m.client_code || ""}"`,
      `"${m.ae || ""}"`,
      `"${m.location || ""}"`,
      `"${m.reservation_date || ""}"`,
      `"${m.delivery_date || ""}"`,
      `"${(m.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `esprint_machines_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function getStatusBadge(status: MachineStatus) {
    switch (status) {
      case "In Stock":
        return "bg-emerald-100 text-emerald-800 border border-emerald-300";
      case "Incoming":
        return "bg-blue-100 text-blue-800 border border-blue-300";
      case "Recertified":
        return "bg-purple-100 text-purple-800 border border-purple-300";
      case "Demo":
        return "bg-amber-100 text-amber-800 border border-amber-300";
      case "Reserved":
        return "bg-orange-100 text-orange-800 border border-orange-300 font-bold";
      case "Delivered":
        return "bg-teal-100 text-teal-800 border border-teal-300";
      case "Pullout Parts":
        return "bg-rose-100 text-rose-800 border border-rose-300";
      default:
        return "bg-slate-100 text-slate-700";
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
            Machine Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time tracking of physical units, serials, reservations & dispatch status.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-xs"
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-95"
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Machine Unit
            </button>
          )}
        </div>
      </div>

      {/* Status Badges Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === "All"
              ? machines.length
              : machines.filter((m) => m.status === tab.value).length;
          const isSelected = selectedStatus === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setSelectedStatus(tab.value)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 shadow-md scale-102"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isSelected ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Search Keyword</label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search serial, PO, brand, model, client..."
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
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter Brand</label>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All Brands</option>
            {lookups.brands.map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All Branches</option>
            {lookups.branches.map((b) => (
              <option key={b.id} value={b.code}>
                {b.code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter AE</label>
          <select
            value={selectedAe}
            onChange={(e) => setSelectedAe(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="All">All AEs</option>
            {lookups.aes.map((a) => (
              <option key={a.id} value={a.code}>
                {a.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading machine inventory...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">No machines found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Brand & Model</th>
                  <th className="py-3.5 px-4">Serial / PO</th>
                  <th className="py-3.5 px-4">Branch</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Client & AE</th>
                  <th className="py-3.5 px-4">Dates</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-blue-50/40 transition-colors group">
                    {/* Brand & Model */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 leading-snug">{m.model}</div>
                      <div className="text-[11px] text-blue-600 font-semibold">{m.brand || "Unbranded"}</div>
                      {m.notes && (
                        <div className="text-[10.5px] text-slate-400 truncate max-w-xs mt-0.5">
                          {m.notes}
                        </div>
                      )}
                    </td>

                    {/* Serial / PO */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-800 font-bold">
                        {m.serial_no || <span className="text-slate-400 font-normal italic">No Serial</span>}
                      </div>
                      {m.po_no && (
                        <div className="text-[11px] text-slate-500 font-mono">PO: {m.po_no}</div>
                      )}
                    </td>

                    {/* Branch */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                        {m.branch || "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1.5 ${getStatusBadge(m.status)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {m.status}
                      </span>
                    </td>

                    {/* Client & AE */}
                    <td className="py-3 px-4">
                      {m.client_name ? (
                        <div>
                          <div className="font-bold text-slate-900">{m.client_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {m.ae && <span className="font-semibold text-blue-600">AE: {m.ae}</span>}
                            {m.location && ` · ${m.location}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-4 text-[11px] text-slate-600 space-y-0.5">
                      {m.reservation_date && (
                        <div>
                          <span className="text-slate-400 font-bold">Res:</span> {m.reservation_date}
                        </div>
                      )}
                      {m.delivery_date && (
                        <div>
                          <span className="text-emerald-600 font-bold">Del:</span> {m.delivery_date}
                        </div>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                        {/* History */}
                        <button
                          onClick={() => setHistoryMachine(m)}
                          title="Audit Trail"
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Reserve */}
                        {permissions.canReserve && m.status !== "Reserved" && m.status !== "Delivered" && (
                          <button
                            onClick={() => setReservingMachine(m)}
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                          >
                            Reserve
                          </button>
                        )}

                        {/* Deliver */}
                        {permissions.canDeliver && m.status === "Reserved" && (
                          <button
                            onClick={() => setDeliveringMachine(m)}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            Deliver
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
                            title="Edit Unit"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}

                        {/* Delete */}
                        {permissions.canEdit && (
                          <button
                            onClick={() => handleDelete(m)}
                            title="Delete Unit"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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

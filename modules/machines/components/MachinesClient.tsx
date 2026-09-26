"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Machine, LookupData } from "../types";
import { StatusPill, STATUS_ROW_CLASS, ALL_STATUSES } from "../ui/Pill";
import { Button } from "../ui/Button";
import { MachineFormModal, ReserveModal, DeliverModal, HistoryModal } from "./Modals";
import type { MachinePermissions } from "@/lib/rbac";

// ── types ──────────────────────────────────────────────────────
type SortDir = 1 | -1;

// ── helpers ────────────────────────────────────────────────────
const DASH = <span className="text-[var(--text-muted)]">—</span>;

/** AE codes visible to this user (from RBAC props). */
function buildAESet(aeCode: string | null, approvedAEs: string[]): Set<string> {
  const s = new Set<string>();
  if (aeCode) s.add(aeCode.trim());
  approvedAEs.forEach((a) => { const t = a.trim(); if (t) s.add(t); });
  return s;
}

function canSeeClient(
  canViewAllClients: boolean,
  aeSet: Set<string>,
  machineAE: string | null
): boolean {
  if (canViewAllClients) return true;
  return aeSet.has((machineAE ?? "").trim());
}

// ── component ──────────────────────────────────────────────────
export function MachinesClient({
  permissions,
  userEmail,
  aeCode = null,
  approvedAEs = [],
  canViewAllClients = false,
}: {
  permissions: MachinePermissions;
  userEmail: string;
  aeCode?: string | null;
  approvedAEs?: string[];
  canViewAllClients?: boolean;
}) {
  const [machines, setMachines] = useState<Machine[]>([]);
  // ref so backup handler (inside useEffect) always sees latest machines
  const machinesRef = useRef<Machine[]>([]);
  const setMachinesAndRef = (m: Machine[]) => { machinesRef.current = m; setMachines(m); };
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [q,       setQ]       = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fBrand,  setFBrand]  = useState("");
  const [fModel,  setFModel]  = useState("");
  const [fBranch, setFBranch] = useState("");
  const [fAE,     setFAE]     = useState("");
  const [hideDel, setHideDel] = useState(false);

  // Sort
  const [sortKey, setSortKey] = useState<keyof Machine>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>(-1);

  // Modals — lazy-imported to keep this file lean
  const [isAddOpen,         setIsAddOpen]         = useState(false);
  const [editingMachine,    setEditingMachine]     = useState<Machine | null>(null);
  const [reservingMachine,  setReservingMachine]   = useState<Machine | null>(null);
  const [deliveringMachine, setDeliveringMachine]  = useState<Machine | null>(null);
  const [historyMachine,    setHistoryMachine]     = useState<Machine | null>(null);

  const aeSet   = useMemo(() => buildAESet(aeCode, approvedAEs), [aeCode, approvedAEs]);
  // If user has no AE set and no viewAll, hide client columns entirely
  const hideCols = !canViewAllClients && aeSet.size === 0;

  // ── data loading ─────────────────────────────────────────────
  async function loadData() {
    setLoading(true);
    try {
      const [machRes, lookRes] = await Promise.all([
        fetch("/api/machines"),
        fetch("/api/machines/lookups"),
      ]);
      const machData = await machRes.json();
      const lookData = await lookRes.json();
      if (machData.machines) setMachinesAndRef(machData.machines);
      if (lookData.branches) setLookups(lookData);
    } catch (err) {
      console.error("Error loading machines data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    function handleOpenAdd()  { setEditingMachine(null); setIsAddOpen(true); }
    function handleExportCSV() { exportCSV(); }
    async function handleBackup() {
      try {
        // Fetch TBA + reorder points for complete snapshot (machines already in state)
        const [tbaRes, lookRes] = await Promise.all([
          fetch("/api/machines/tba"),
          fetch("/api/machines/lookups"),
        ]);
        const tbaData  = tbaRes.ok  ? await tbaRes.json()  : {};
        const lookData = lookRes.ok ? await lookRes.json() : {};
        const backup = {
          exported_at:    new Date().toISOString(),
          machines:       machinesRef.current,
          tba_list:       tbaData.items   ?? [],
          reorder_points: lookData.reorder_points ?? [],
        };
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
        a.download = `ES_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      } catch (err) {
        console.error("Backup failed:", err);
        alert("Backup failed. Please try again.");
      }
    }

    window.addEventListener("machines:open-add",   handleOpenAdd);
    window.addEventListener("machines:export-csv", handleExportCSV);
    window.addEventListener("machines:backup",     handleBackup);
    return () => {
      window.removeEventListener("machines:open-add",   handleOpenAdd);
      window.removeEventListener("machines:export-csv", handleExportCSV);
      window.removeEventListener("machines:backup",     handleBackup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── sorting ───────────────────────────────────────────────────
  const setSort = (k: keyof Machine) => {
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortKey(k); setSortDir(1); }
  };

  // ── filtering + sorting ───────────────────────────────────────
// Fix 1: cast through unknown for dynamic key access
  const filtered = useMemo(() => {
    let rows = machines.slice();
    if (hideDel)  rows = rows.filter((m) => m.status !== "Delivered");
    if (fStatus)  rows = rows.filter((m) => m.status === fStatus);
    if (fBrand)   rows = rows.filter((m) => m.brand  === fBrand);
    if (fModel)   rows = rows.filter((m) => m.model  === fModel);
    if (fBranch)  rows = rows.filter((m) => m.branch === fBranch);
    if (fAE)      rows = rows.filter((m) => m.ae     === fAE);
    if (q.trim()) {
      const lq = q.toLowerCase();
      rows = rows.filter((m) => {
        const base = (
          [m.serial_no, m.po_no, m.model, m.brand, m.client_code, m.branch, m.ae, m.notes]
            .some((v) => (v ?? "").toLowerCase().includes(lq))
        );
        const clientVisible = canSeeClient(canViewAllClients, aeSet, m.ae);
        const cli = clientVisible &&
          [m.client_name, m.location].some((v) => (v ?? "").toLowerCase().includes(lq));
        return base || cli;
      });
    }
    return rows.sort((a, b) => {
      const x = String((a as unknown as Record<string, unknown>)[sortKey] ?? "");
      const y = String((b as unknown as Record<string, unknown>)[sortKey] ?? "");
      return x.localeCompare(y, undefined, { numeric: true }) * sortDir;
    });
  }, [machines, hideDel, fStatus, fBrand, fModel, fBranch, fAE, q, sortKey, sortDir, canViewAllClients, aeSet]);

  // ── unique filter options ─────────────────────────────────────
  const uniq = (key: keyof Machine) =>
    [...new Set(machines.map((m) => m[key]).filter(Boolean))].sort() as string[];

  // ── actions ───────────────────────────────────────────────────
  async function markArrived(m: Machine) {
    if (!confirm(`Mark ${m.brand} ${m.model} (PO: ${m.po_no || "N/A"}) as arrived (→ In Stock)?`)) return;
    const res = await fetch(`/api/machines/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, status: "In Stock" }),
    });
    if (res.ok) loadData();
  }

  async function moveToTBA(m: Machine) {
    if (!confirm(`Move reservation for ${m.client_name || "client"} to TBA list? Unit returns to In Stock.`)) return;
    await fetch("/api/machines/tba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: m.brand, model: m.model, client_name: m.client_name,
        client_code: m.client_code, location: m.location, ae: m.ae,
        reservation_date: m.reservation_date, notes: m.notes,
      }),
    });
    await fetch(`/api/machines/${m.id}/unreserve`, { method: "POST" });
    loadData();
  }

  async function handleUnreserve(m: Machine) {
    if (!confirm(`Unreserve ${m.model} (reserved for ${m.client_name || "client"})?`)) return;
    const res = await fetch(`/api/machines/${m.id}/unreserve`, { method: "POST" });
    if (res.ok) loadData();
  }

  async function handleDelete(m: Machine) {
    if (!confirm(`Delete ${m.brand} ${m.model} (SN: ${m.serial_no || "No Serial"})?`)) return;
    const res = await fetch(`/api/machines/${m.id}`, { method: "DELETE" });
    if (res.ok) loadData();
  }

  // ── CSV export ────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      "Status","PO No.","Brand","Model","Branch",
      "Client Name","Code","Location","AE",
      "Reservation Date","Delivery Date","Serial",
      "Shipment Receipt / Transfer Date","Notes",
    ];
    const rows = filtered.map((m) => [
      m.status, m.po_no, m.brand, m.model, m.branch,
      m.client_name, m.client_code, m.location, m.ae,
      m.reservation_date, m.delivery_date, m.serial_no,
      m.dispatch_date, m.notes,
    ].map((v) => `"${(v ?? "").toString().replace(/"/g, '""')}"`));
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `esprint_machines_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  // ── column definitions ────────────────────────────────────────
  type ColDef = { key: keyof Machine; label: string };
  const baseCols: ColDef[] = [
    { key: "status",           label: "Status" },
    { key: "po_no",            label: "PO No." },
    { key: "brand",            label: "Brand" },
    { key: "model",            label: "Model" },
    { key: "branch",           label: "Branch" },
    ...(!hideCols ? [
      { key: "client_name"  as keyof Machine, label: "Client Name" },
      { key: "client_code"  as keyof Machine, label: "Code" },
      { key: "location"     as keyof Machine, label: "Location" },
    ] : []),
    { key: "ae",               label: "AE" },
    { key: "reservation_date", label: "Reservation Date" },
    { key: "delivery_date",    label: "Delivery Date" },
    { key: "serial_no",        label: "Serial" },
    { key: "dispatch_date",    label: "Shipment Receipt / Transfer Date" },
    { key: "notes",            label: "Notes" },
  ];

  const showActions =
    permissions.canEdit || permissions.canReserve ||
    permissions.canDeliver || permissions.canUnreserve;

  // ── style helpers ─────────────────────────────────────────────
  const thCls =
    "sticky top-0 bg-[var(--surface-2)] text-left px-3 py-2.5 font-[650] text-[var(--text-secondary)] text-[11px] uppercase tracking-wide whitespace-nowrap cursor-pointer border-b border-[var(--border)] hover:text-[var(--text-primary)]";
  const tdCls =
    "px-3.5 py-2.5 border-b border-[var(--border)] align-middle whitespace-nowrap text-[12.5px]";

  const filterSel = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: string[]
  ) => (
    <select
      className="bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2 rounded-[9px] text-[13px] focus:outline-none focus:border-[var(--accent)]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1800px] mx-auto select-none">
      {/* Toolbar */}
      <div className="flex gap-2.5 flex-wrap items-center mb-3.5">
        <input
          type="search"
          placeholder="🔍 Search serial, model, client, code, branch…"
          className="bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2 rounded-[9px] text-[13px] min-w-[260px] focus:outline-none focus:border-[var(--accent)]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {filterSel("All statuses", fStatus, setFStatus, ALL_STATUSES)}
        {filterSel("All brands",   fBrand,  setFBrand,  uniq("brand"))}
        {filterSel("All models",   fModel,  setFModel,  uniq("model"))}
        {filterSel("All branches", fBranch, setFBranch, uniq("branch"))}
        {filterSel("All AEs",      fAE,     setFAE,     uniq("ae"))}
        <label className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] bg-[var(--surface-1)] border border-[var(--border)] px-3 py-2 rounded-[9px] cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideDel}
            onChange={(e) => setHideDel(e.target.checked)}
            className="cursor-pointer"
          />
          Hide delivered
        </label>
        <span className="flex-1" />
        <span className="text-[12.5px] text-[var(--text-muted)] whitespace-nowrap">
          {filtered.length} of {machines.length} shown
        </span>
      </div>

      {/* Table */}
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 640, overflowY: "auto" }}>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                {baseCols.map((c) => (
                  <th
                    key={c.key}
                    className={thCls}
                    onClick={() => setSort(c.key)}
                  >
                    {c.label}
                    {sortKey === c.key ? (sortDir > 0 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                {showActions && (
                  <th className={`${thCls} sticky right-0 z-10 text-right shadow-[-7px_0_9px_-7px_rgba(0,0,0,.18)]`}>
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={baseCols.length + 1} className="text-center py-14 text-[var(--text-muted)] text-[13px]">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={baseCols.length + 1}>
                    <div className="text-center py-14 text-[var(--text-muted)]">
                      <svg className="mx-auto mb-3 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                      </svg>
                      No machines to show.
                      {permissions.canEdit && (
                        <div className="mt-3">
                          <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
                            ＋ Add a machine
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((m) => {
                  const rowCls = STATUS_ROW_CLASS[m.status] ?? "";
                  return (
                    <tr key={m.id} className={`${rowCls} hover:cursor-default`}>
                      {baseCols.map((c) => {
                        const v = (m as unknown as Record<string, unknown>)[c.key];

                        if (c.key === "status")
                          return (
                            <td key={c.key} className={tdCls}>
                              <StatusPill status={m.status} />
                            </td>
                          );

                        if (c.key === "serial_no" || c.key === "po_no")
                          return (
                            <td key={c.key} className={`${tdCls} font-mono text-[11.5px] text-[var(--text-secondary)]`}>
                              {v ? String(v) : DASH}
                            </td>
                          );

                        if (c.key === "model")
                          return (
                            <td key={c.key} className={`${tdCls} font-semibold`}>
                              {v ? String(v) : DASH}
                            </td>
                          );

                        if (c.key === "client_name") {
                          if (!canSeeClient(canViewAllClients, aeSet, m.ae))
                            return (
                              <td key={c.key} className={tdCls}>
                                <span className="text-[var(--text-muted)]" title="Hidden — not your AE">•••</span>
                              </td>
                            );
                          return (
                            <td key={c.key} className={`${tdCls} font-semibold`}>
                              {v ? String(v) : DASH}
                            </td>
                          );
                        }

                        if (c.key === "location") {
                          if (!canSeeClient(canViewAllClients, aeSet, m.ae))
                            return (
                              <td key={c.key} className={tdCls}>
                                <span className="text-[var(--text-muted)]">•••</span>
                              </td>
                            );
                          return <td key={c.key} className={tdCls}>{v ? String(v) : DASH}</td>;
                        }

                        if (c.key === "notes")
                          return (
                            <td
                              key={c.key}
                              className={`${tdCls} text-[var(--text-muted)] max-w-[240px] overflow-hidden text-ellipsis`}
                              title={v ? String(v) : undefined}
                            >
                              {v ? String(v) : ""}
                            </td>
                          );

                        return (
                          <td key={c.key} className={tdCls}>
                            {v ? String(v) : DASH}
                          </td>
                        );
                      })}

                      {showActions && (
                        <td className={`${tdCls} sticky right-0 bg-inherit shadow-[-7px_0_9px_-7px_rgba(0,0,0,.14)]`}>
                          <div className="flex gap-1.5 justify-end flex-nowrap">
                            {/* Mark arrived */}
                            {permissions.canEdit && m.status === "Incoming" && (
                              <Button size="sm" onClick={() => markArrived(m)} title="Mark arrived (→ In Stock)">
                                📦
                              </Button>
                            )}
                            {/* Reserve */}
                            {permissions.canReserve &&
                              ["In Stock", "Demo", "Recertified"].includes(m.status) && (
                                <Button size="sm" onClick={() => setReservingMachine(m)} title="Reserve">
                                  🔖
                                </Button>
                              )}
                            {/* Deliver */}
                            {permissions.canDeliver &&
                              ["In Stock", "Demo", "Recertified", "Reserved"].includes(m.status) && (
                                <Button size="sm" onClick={() => setDeliveringMachine(m)} title="Deliver">
                                  ✅
                                </Button>
                              )}
                            {/* Move to TBA */}
                            {permissions.canReserve && m.status === "Reserved" && (
                              <Button size="sm" onClick={() => moveToTBA(m)} title="Move to TBA list">
                                📝
                              </Button>
                            )}
                            {/* Unreserve */}
                            {permissions.canUnreserve && m.status === "Reserved" && (
                              <Button size="sm" onClick={() => handleUnreserve(m)} title="Unreserve">
                                ↩
                              </Button>
                            )}
                            {/* History */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryMachine(m)}
                              title="History"
                            >
                              🕒
                            </Button>
                            {/* Edit */}
                            {permissions.canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingMachine(m); setIsAddOpen(true); }}
                                title="Edit"
                              >
                                ✎
                              </Button>
                            )}
                            {/* Delete */}
                            {permissions.canEdit && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDelete(m)}
                                title="Delete"
                              >
                                🗑
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <MachineFormModal
        isOpen={isAddOpen}
        initialData={editingMachine}
        lookups={lookups}
        onClose={() => { setIsAddOpen(false); setEditingMachine(null); }}
        onSuccess={() => { setIsAddOpen(false); setEditingMachine(null); loadData(); }}
      />

      <ReserveModal
        isOpen={!!reservingMachine}
        machine={reservingMachine}
        lookups={lookups}
        onClose={() => setReservingMachine(null)}
        onSuccess={() => { setReservingMachine(null); loadData(); }}
      />

      <DeliverModal
        isOpen={!!deliveringMachine}
        machine={deliveringMachine}
        lookups={lookups}
        onClose={() => setDeliveringMachine(null)}
        onSuccess={() => { setDeliveringMachine(null); loadData(); }}
      />

      <HistoryModal
        isOpen={!!historyMachine}
        machine={historyMachine}
        onClose={() => setHistoryMachine(null)}
      />
    </div>
  );
}

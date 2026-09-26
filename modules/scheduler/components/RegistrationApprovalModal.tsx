"use client";

import { useState } from "react";
import type { Branch } from "../types";

// ── Types ─────────────────────────────────────────────────────────
interface PendingReg {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "admin",                label: "Admin"               },
  { value: "service_manager",      label: "Service Manager"     },
  { value: "service_coordinator",  label: "Service Coordinator" },
  { value: "branch",               label: "Branch User"         },
  { value: "senior_fse",           label: "Senior FSE"          },
  { value: "junior_fse",           label: "Junior FSE"          },
  { value: "trainee",              label: "Trainee"             },
];

// ── Branch Assignment Section ──────────────────────────────────────
function BranchAssignmentSection({
  branches,
  editBranches,
  viewBranches,
  onToggleEdit,
  onToggleView,
  onSetEditBranches,
  onSetViewBranches,
}: {
  branches: Branch[];
  editBranches: string[];
  viewBranches: string[];
  onToggleEdit: (id: string) => void;
  onToggleView: (id: string) => void;
  onSetEditBranches: (ids: string[]) => void;
  onSetViewBranches: (ids: string[]) => void;
}) {
  const [tab, setTab] = useState<"edit" | "view">("edit");
  const allIds = branches.map(b => b.id);

  const tabBtn = (active: boolean, color: string, label: string, count: number, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: "7px 10px", fontSize: 12, fontWeight: 650,
        borderRadius: 6, border: "none", cursor: "pointer", transition: "all .15s",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        background: active ? color : "transparent",
        color: active ? "#fff" : "var(--sch-ink2, #334155)",
        boxShadow: active ? `0 1px 4px ${color}55` : "none",
      }}
    >
      {label}
      <span style={{
        fontSize: 11, padding: "1px 6px", borderRadius: 99,
        background: active ? "rgba(255,255,255,.25)" : "var(--sch-s2, #f1f5f9)",
        color: active ? "#fff" : "inherit",
      }}>{count}</span>
    </button>
  );

  const quickBtns = (setFn: (ids: string[]) => void, current: string[]) => (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className="sch-btn ghost sm" style={{ fontSize: 11 }}
        onClick={() => setFn(allIds)}>All ({branches.length})</button>
      <span style={{ color: "var(--sch-border, #e2e8f0)" }}>·</span>
      <button type="button" className="sch-btn ghost sm" style={{ fontSize: 11 }}
        onClick={() => setFn([])}>Clear</button>
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, background: "var(--sch-s2, #f1f5f9)", padding: 4, borderRadius: 8, border: "1px solid var(--sch-border, #e2e8f0)" }}>
        {tabBtn(tab === "edit", "#2e7d32", "✏️ Can Edit",    editBranches.length, () => setTab("edit"))}
        {tabBtn(tab === "view", "#2563eb", "📍 View Only",   viewBranches.length, () => setTab("view"))}
      </div>

      {tab === "edit" ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--sch-muted, #64748b)" }}>Full Edit Access:</span>
            {quickBtns(onSetEditBranches, editBranches)}
          </div>
          <BranchChecklist
            branches={branches}
            selected={editBranches}
            onToggle={onToggleEdit}
            onSetAll={onSetEditBranches}
          />
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, color: "var(--sch-muted, #64748b)" }}>Read-Only Access:</span>
            {quickBtns(onSetViewBranches, viewBranches)}
          </div>
          <BranchChecklist
            branches={branches}
            selected={viewBranches}
            onToggle={onToggleView}
            onSetAll={onSetViewBranches}
            editBranches={editBranches}
          />
        </div>
      )}
    </div>
  );
}

function BranchChecklist({
  branches, selected, onToggle, onSetAll, editBranches = [],
}: {
  branches: Branch[];
  selected: string[];
  onToggle: (id: string) => void;
  onSetAll: (ids: string[]) => void;
  editBranches?: string[];
}) {
  const allIds = branches.map(b => b.id);
  const allChecked = selected.length === branches.length;
  const someChecked = selected.length > 0 && selected.length < branches.length;

  return (
    <div style={{
      maxHeight: 150, overflowY: "auto", border: "1px solid var(--sch-border, #e2e8f0)",
      borderRadius: 8, background: "var(--sch-s2, #f1f5f9)",
    }}>
      {/* Select all header */}
      <label style={{
        padding: "6px 10px", fontSize: 12.5, display: "flex", alignItems: "center",
        gap: 6, cursor: "pointer", background: "var(--sch-s3, #e2e8f0)",
        borderBottom: "1px solid var(--sch-border, #e2e8f0)", fontWeight: 700,
        position: "sticky", top: 0, zIndex: 2,
      }}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked; }}
          onChange={e => onSetAll(e.target.checked ? allIds : [])}
          style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#2563eb" }}
        />
        Select All ({branches.length})
      </label>
      {branches.map(b => (
        <label key={b.id} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 10px",
          cursor: "pointer", fontSize: 12.5,
        }}>
          <input
            type="checkbox"
            checked={selected.includes(b.id)}
            onChange={() => onToggle(b.id)}
            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#2563eb" }}
          />
          <span style={{ fontWeight: selected.includes(b.id) ? 600 : 400 }}>
            {b.name} · {b.note}
          </span>
          {editBranches.includes(b.id) && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#2563eb", background: "rgba(37,99,235,.1)", padding: "1px 6px", borderRadius: 6 }}>
              ✏️ Edit
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
  branches: Branch[];
}

// Demo pending registrations — replace with real API when DB is wired
const DEMO_PENDING: PendingReg[] = [
  { id: "p1", name: "Juan Dela Cruz",   email: "juan@esprintmedia.com",   role: "senior_fse",          created_at: new Date().toISOString() },
  { id: "p2", name: "Maria Santos",     email: "maria@esprintmedia.com",  role: "trainee",             created_at: new Date().toISOString() },
  { id: "p3", name: "Pedro Reyes",      email: "pedro@esprintmedia.com",  role: "service_coordinator", created_at: new Date().toISOString() },
];

export function RegistrationApprovalModal({ onClose, branches }: Props) {
  const [pending,  setPending]  = useState<PendingReg[]>(DEMO_PENDING);
  const [roleMap,  setRoleMap]  = useState<Record<string, string>>({});
  const [editMap,  setEditMap]  = useState<Record<string, string[]>>({});
  const [viewMap,  setViewMap]  = useState<Record<string, string[]>>({});
  const [busy,     setBusy]     = useState<string | null>(null);
  const [err,      setErr]      = useState("");
  const [approved, setApproved] = useState<string[]>([]);

  const getRole  = (reg: PendingReg) => roleMap[reg.id]  ?? reg.role ?? "branch";
  const getEdit  = (reg: PendingReg) => editMap[reg.id]  ?? [];
  const getView  = (reg: PendingReg) => viewMap[reg.id]  ?? [];

  function setRole(id: string, v: string) {
    setRoleMap(m => ({ ...m, [id]: v }));
  }
  function toggleEdit(regId: string, branchId: string) {
    setEditMap(m => {
      const cur = m[regId] ?? [];
      return { ...m, [regId]: cur.includes(branchId) ? cur.filter(b => b !== branchId) : [...cur, branchId] };
    });
  }
  function toggleView(regId: string, branchId: string) {
    setViewMap(m => {
      const cur = m[regId] ?? [];
      return { ...m, [regId]: cur.includes(branchId) ? cur.filter(b => b !== branchId) : [...cur, branchId] };
    });
  }

  async function handleApprove(reg: PendingReg) {
    const role = getRole(reg);
    const edit = getEdit(reg);
    const view = getView(reg);
    if (role !== "admin" && edit.length === 0 && view.length === 0) {
      setErr(`Please assign at least one branch for ${reg.name} before approving.`);
      return;
    }
    setErr("");
    setBusy(reg.id);
    // In-memory only — mark approved and remove from list
    await new Promise(r => setTimeout(r, 600));
    setApproved(prev => [...prev, reg.id]);
    setPending(prev => prev.filter(p => p.id !== reg.id));
    setBusy(null);
  }

  function handleReject(id: string) {
    setPending(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60, display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
        background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--sch-s1, #fff)", border: "1px solid var(--sch-border, #e2e8f0)",
        borderRadius: 18, width: "min(680px,96vw)", maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 60px -12px rgba(15,23,42,.28)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px", borderBottom: "1px solid var(--sch-border, #e2e8f0)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sch-ink1, #0f172a)" }}>
              Registration Approvals &amp; Designation
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--sch-muted, #64748b)" }}>
              Set user role and branch access permissions upon approval.
            </p>
          </div>
          {pending.length > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 22, height: 22, padding: "0 6px", borderRadius: 11,
              background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700,
            }}>{pending.length}</span>
          )}
          <button
            type="button"
            className="sch-btn ghost sm"
            onClick={onClose}
            style={{ marginLeft: 4 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 22px" }}>
          {err && (
            <div className="sch-modal-err" style={{ marginBottom: 12 }}>
              <span>⚠️</span><span>{err}</span>
            </div>
          )}

          {pending.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--sch-muted, #64748b)", fontSize: 13.5 }}>
              ✨ No pending registration requests.
            </div>
          )}

          {pending.map(reg => {
            const role = getRole(reg);
            const editB = getEdit(reg);
            const viewB = getView(reg);
            return (
              <div key={reg.id} style={{
                border: "1px solid var(--sch-border, #e2e8f0)", borderRadius: 10,
                padding: "13px 16px", marginBottom: 12,
                background: "var(--sch-s2, #f1f5f9)",
                boxShadow: "0 1px 2px rgba(15,23,42,.04)",
              }}>
                {/* Name + actions */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--sch-ink1, #0f172a)" }}>{reg.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sch-muted, #64748b)", marginTop: 2 }}>{reg.email}</div>
                    <div style={{ fontSize: 11, color: "var(--sch-muted, #64748b)", marginTop: 2 }}>
                      Requested: {new Date(reg.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <button
                      type="button"
                      className="sch-btn"
                      style={{ color: "#ef4444", borderColor: "rgba(239,68,68,.3)", fontSize: 12 }}
                      onClick={() => handleReject(reg.id)}
                      disabled={busy === reg.id}
                    >Reject</button>
                    <button
                      type="button"
                      className="sch-btn primary"
                      style={{ fontSize: 12 }}
                      onClick={() => handleApprove(reg)}
                      disabled={busy === reg.id}
                    >{busy === reg.id ? "Approving…" : "✓ Approve & Activate"}</button>
                  </div>
                </div>

                {/* Role */}
                <div style={{ marginTop: 12 }}>
                  <label className="sch-fld">Designated Role <span className="sch-req">*</span></label>
                  <select
                    className="sch-sel"
                    style={{ width: "100%", marginTop: 4 }}
                    value={role}
                    onChange={e => setRole(reg.id, e.target.value)}
                  >
                    {ROLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Branch assignment */}
                {role !== "admin" ? (
                  <BranchAssignmentSection
                    branches={branches}
                    editBranches={editB}
                    viewBranches={viewB}
                    onToggleEdit={bId => toggleEdit(reg.id, bId)}
                    onToggleView={bId => toggleView(reg.id, bId)}
                    onSetEditBranches={ids => setEditMap(m => ({ ...m, [reg.id]: ids }))}
                    onSetViewBranches={ids => setViewMap(m => ({ ...m, [reg.id]: ids }))}
                  />
                ) : (
                  <div style={{
                    marginTop: 10, fontSize: 12, color: "#2563eb",
                    background: "rgba(37,99,235,.08)", padding: "8px 12px",
                    borderRadius: 8, border: "1px solid rgba(37,99,235,.2)",
                  }}>
                    👑 Admin accounts automatically have full edit access across all branches.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 22px", borderTop: "1px solid var(--sch-border, #e2e8f0)",
          background: "var(--sch-s2, #f1f5f9)", borderRadius: "0 0 18px 18px",
          display: "flex", justifyContent: "flex-end",
        }}>
          <button type="button" className="sch-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

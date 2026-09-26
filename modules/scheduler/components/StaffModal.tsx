"use client";

import { useState } from "react";
import type { Staff, Branch } from "../types";
import { ROLES, ROLE_ORDER } from "../constants";

interface Props {
  staff: Staff[];
  branches: Branch[];
  onAddStaff: (s: Omit<Staff, "id">) => void;
  onEditStaff: (s: Staff) => void;
  onRemoveStaff: (id: string) => void;
  onClose: () => void;
}

type StaffRole = Staff["role"];

const ROLE_OPTS: { value: StaffRole; label: string }[] = [
  { value: "manager",     label: "Service Manager"        },
  { value: "bsm",         label: "Branch Service Manager" },
  { value: "coordinator", label: "Service Coordinator"    },
  { value: "senior",      label: "Senior FSE"             },
  { value: "junior",      label: "Junior FSE"             },
  { value: "trainee",     label: "Trainee"                },
];

const EMPTY_FORM = { name: "", role: "senior" as StaffRole, home_branch_id: "", hotline: false };

export function StaffModal({ staff, branches, onAddStaff, onEditStaff, onRemoveStaff, onClose }: Props) {
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [err,    setErr]    = useState("");
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [editForm,   setEditForm]   = useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [successMsg,   setSuccessMsg]   = useState("");

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  function handleAdd() {
    if (!form.name.trim()) { setErr("Please enter a name."); return; }
    if (!form.home_branch_id) { setErr("Please select a home branch."); return; }
    const already = staff.some(s => s.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (already) { setErr(`"${form.name}" is already in the staff list.`); return; }
    setErr("");
    onAddStaff({ name: form.name.trim(), role: form.role, home_branch_id: form.home_branch_id, hotline: form.hotline });
    setForm({ ...EMPTY_FORM });
    showSuccess(`✓ Staff member "${form.name.trim()}" added!`);
  }

  function startEdit(s: Staff) {
    setEditTarget(s);
    setEditForm({ name: s.name, role: s.role, home_branch_id: s.home_branch_id, hotline: !!s.hotline });
  }

  function saveEdit() {
    if (!editTarget) return;
    if (!editForm.name.trim()) return;
    if (!editForm.home_branch_id) return;
    onEditStaff({ ...editTarget, ...editForm, name: editForm.name.trim() });
    setEditTarget(null);
    showSuccess(`✓ Staff "${editForm.name.trim()}" updated!`);
  }

  const term = search.trim().toLowerCase();
  const filteredStaff = staff.filter(s => {
    if (!term) return true;
    const bName = branches.find(b => b.id === s.home_branch_id)?.name?.toLowerCase() ?? "";
    return s.name.toLowerCase().includes(term) || bName.includes(term);
  });

  const grouped = ROLE_ORDER.reduce<Record<string, Staff[]>>((acc, r) => {
    acc[r] = filteredStaff.filter(s => {
      if (r === "manager")     return s.role === "manager";
      if (r === "bsm")         return s.role === "bsm";
      if (r === "coordinator") return s.role === "coordinator";
      if (r === "senior")      return s.role === "senior";
      if (r === "junior")      return s.role === "junior";
      return s.role === r;
    });
    return acc;
  }, {});

  const inputCls = "sch-sel w-full";

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-5"
        style={{ background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: "var(--sch-s1, #fff)", border: "1px solid var(--sch-border, #e2e8f0)",
          borderRadius: 18, width: "min(620px,96vw)", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px -12px rgba(15,23,42,.28)",
        }}>
          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--sch-border, #e2e8f0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>👥 Manage Staff Roster</h3>
            <button type="button" className="sch-btn ghost sm" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
            {successMsg && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(16,185,129,.16)", border: "1px solid rgba(16,185,129,.4)", color: "#047857", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
                {successMsg}
                <button type="button" className="sch-btn ghost sm" onClick={() => setSuccessMsg("")} style={{ color: "inherit" }}>✕</button>
              </div>
            )}

            {/* Add form */}
            <div style={{ background: "var(--sch-s2, #f1f5f9)", border: "1px solid var(--sch-border, #e2e8f0)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>＋ Add Staff Member</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="sch-fld">Full Name <span className="sch-req">*</span></label>
                  <input className={inputCls} style={{ marginTop: 4 }} placeholder="e.g. Juan Dela Cruz"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="sch-fld">Staff Role</label>
                  <select className={inputCls} style={{ marginTop: 4 }}
                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as StaffRole }))}>
                    {ROLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="sch-fld">Home Branch <span className="sch-req">*</span></label>
                  <select className={inputCls} style={{ marginTop: 4 }}
                    value={form.home_branch_id} onChange={e => setForm(f => ({ ...f, home_branch_id: e.target.value }))}>
                    <option value="">Select branch…</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.note}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#2563eb" }}
                      checked={form.hotline} onChange={e => setForm(f => ({ ...f, hotline: e.target.checked }))} />
                    ☎ Hotline team (Manila)
                  </label>
                </div>
              </div>
              {err && <div className="sch-modal-err" style={{ marginTop: 8 }}><span>⚠️</span><span>{err}</span></div>}
              <button type="button" className="sch-btn primary sm" style={{ marginTop: 10 }}
                onClick={handleAdd} disabled={!form.name.trim()}>
                ＋ Add Staff Member
              </button>
            </div>

            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
              <div className="sch-ovl-search-wrap" style={{ flex: 1, margin: 0 }}>
                <span style={{ fontSize: 12, color: "var(--sch-muted, #64748b)" }}>🔍</span>
                <input placeholder="Search staff by name or branch…" value={search}
                  onChange={e => setSearch(e.target.value)} />
                {search && <span style={{ fontSize: 10, cursor: "pointer", color: "var(--sch-muted, #64748b)" }} onClick={() => setSearch("")}>✕</span>}
              </div>
              <span style={{ fontSize: 12, color: "var(--sch-muted, #64748b)", fontWeight: 600, whiteSpace: "nowrap" }}>
                Total: {filteredStaff.length} staff
              </span>
            </div>

            {/* Grouped list */}
            {staff.length === 0 && <div className="sch-empty">No staff members added yet.</div>}
            {staff.length > 0 && filteredStaff.length === 0 && (
              <div className="sch-empty">No staff matching &ldquo;{search}&rdquo;.</div>
            )}
            {ROLE_ORDER.map(r => {
              const grp = grouped[r];
              if (!grp?.length) return null;
              return (
                <div key={r} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--sch-muted, #64748b)", fontWeight: 750, marginBottom: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: ROLES[r]?.color, flexShrink: 0, display: "inline-block" }} />
                    {ROLES[r]?.label}
                    <span style={{ fontSize: 10, background: "var(--sch-s2, #f1f5f9)", padding: "1px 6px", borderRadius: 8 }}>{grp.length}</span>
                  </div>
                  {grp.map(s => {
                    const branchObj = branches.find(b => b.id === s.home_branch_id);
                    const isEditing = editTarget?.id === s.id;
                    if (isEditing) {
                      return (
                        <div key={s.id} style={{ background: "var(--sch-s2, #f1f5f9)", border: "1px solid #2563eb", borderRadius: 8, padding: "12px 14px", marginBottom: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 14px" }}>
                            <div>
                              <label className="sch-fld">Name</label>
                              <input className={inputCls} style={{ marginTop: 3 }} value={editForm.name}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div>
                              <label className="sch-fld">Role</label>
                              <select className={inputCls} style={{ marginTop: 3 }} value={editForm.role}
                                onChange={e => setEditForm(f => ({ ...f, role: e.target.value as StaffRole }))}>
                                {ROLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="sch-fld">Home Branch</label>
                              <select className={inputCls} style={{ marginTop: 3 }} value={editForm.home_branch_id}
                                onChange={e => setEditForm(f => ({ ...f, home_branch_id: e.target.value }))}>
                                <option value="">Select…</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </div>
                            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                                <input type="checkbox" checked={editForm.hotline} style={{ accentColor: "#2563eb" }}
                                  onChange={e => setEditForm(f => ({ ...f, hotline: e.target.checked }))} />
                                ☎ Hotline
                              </label>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <button type="button" className="sch-btn primary sm" onClick={saveEdit}>✓ Save</button>
                            <button type="button" className="sch-btn ghost sm" onClick={() => setEditTarget(null)}>Cancel</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 8, background: "var(--sch-s2, #f1f5f9)", border: "1px solid var(--sch-border, #e2e8f0)", marginBottom: 5 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</div>
                          <div style={{ fontSize: 11.5, color: "var(--sch-muted, #64748b)", marginTop: 2 }}>
                            🏢 {branchObj ? `${branchObj.name} · ${branchObj.note}` : "—"}
                            {s.hotline && <span style={{ marginLeft: 8, color: "#ec4899", fontWeight: 600 }}>· ☎ Hotline</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button type="button" className="sch-btn sm" onClick={() => startEdit(s)}>✎ Edit</button>
                          <button type="button" className="sch-btn sm" style={{ color: "#ef4444", borderColor: "rgba(239,68,68,.3)" }} onClick={() => setDeleteTarget(s)}>✕</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 22px", borderTop: "1px solid var(--sch-border, #e2e8f0)", background: "var(--sch-s2, #f1f5f9)", borderRadius: "0 0 18px 18px", display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="sch-btn ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="sch-confirm-overlay">
          <div className="sch-confirm-card">
            <div className="sch-confirm-body">
              <div className="sch-confirm-icon">👤</div>
              <p className="sch-confirm-title">Remove Staff Member?</p>
              <p className="sch-confirm-desc">Remove &ldquo;{deleteTarget.name}&rdquo; from the staff roster?</p>
            </div>
            <div className="sch-confirm-foot">
              <button type="button" className="sch-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="sch-btn"
                style={{ background: "linear-gradient(180deg,#ef4444,#dc2626)", color: "#fff", borderColor: "#dc2626" }}
                onClick={() => { onRemoveStaff(deleteTarget.id); setDeleteTarget(null); showSuccess(`✓ Staff member removed.`); }}>
                Remove Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

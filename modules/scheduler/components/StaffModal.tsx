"use client";

import { useState, useEffect } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { ROLES, ROLE_ORDER } from "../lib/constants";
import ConfirmModal from "./ConfirmModal";

interface StaffModalProps {
  onClose: () => void;
}

export default function StaffModal({ onClose }: StaffModalProps) {
  const { staff, branches, appUsers, loadStaff, loadAppUsers, supabase } = useScheduler();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [form, setForm] = useState({ name: "", role: "senior", home_branch_id: "", hotline: false });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [editId,       setEditId]       = useState<string | null>(null);
  const [editForm,     setEditForm]     = useState({ name: "", role: "senior", home_branch_id: "", hotline: false });
  const [editBusy,     setEditBusy]     = useState(false);
  const [editErr,      setEditErr]      = useState("");
  const [search,       setSearch]       = useState("");
  const [successMsg,   setSuccessMsg]   = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { loadAppUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  function handleAccountSelect(userId: string) {
    setSelectedUserId(userId);
    setErr("");
    if (!userId) { setForm({ name: "", role: "senior", home_branch_id: "", hotline: false }); return; }
    const u = appUsers.find((x) => x.id === userId);
    if (!u) return;
    const alreadyStaff = staff.some((s) => s.name.trim().toLowerCase() === u.name.trim().toLowerCase());
    if (alreadyStaff) setErr(`Note: "${u.name}" is already registered as a staff member.`);
    let staffRole = "senior";
    if (u.role === "admin" || u.role === "service_manager") staffRole = "manager";
    const homeBranch = u.main_branch_id || u.branch_ids?.[0] || (branches.length > 0 ? branches[0].id : "");
    setForm({ name: u.name, role: staffRole, home_branch_id: homeBranch, hotline: homeBranch === "b13" });
  }

  async function handleAdd() {
    if (!form.name.trim()) { setErr("Please select an existing account."); return; }
    if (!form.home_branch_id) { setErr("Please assign a home branch."); return; }
    if (staff.some((s) => s.name.trim().toLowerCase() === form.name.trim().toLowerCase())) {
      setErr(`"${form.name}" is already in the staff list.`); return;
    }
    setBusy(true); setErr("");
    const { error } = await supabase.from("staff").insert({
      name: form.name.trim(), role: form.role, home_branch_id: form.home_branch_id, hotline: form.hotline,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    await loadStaff();
    setSelectedUserId(""); setForm({ name: "", role: "senior", home_branch_id: "", hotline: false });
    setBusy(false); showSuccess(`✓ "${form.name.trim()}" added!`);
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.name.trim()) { setEditErr("Staff name is required."); return; }
    if (!editForm.home_branch_id) { setEditErr("Please assign a home branch."); return; }
    setEditBusy(true); setEditErr("");
    const { error } = await supabase.from("staff").update({
      name: editForm.name.trim(), role: editForm.role,
      home_branch_id: editForm.home_branch_id, hotline: editForm.hotline,
    }).eq("id", id);
    if (error) { setEditErr(error.message); setEditBusy(false); return; }
    await loadStaff();
    setEditBusy(false); setEditId(null);
    showSuccess(`✓ "${editForm.name.trim()}" updated!`);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    await supabase.from("staff").delete().eq("id", deleteTarget.id);
    await loadStaff();
    setDeleteTarget(null); setBusy(false);
    showSuccess("✓ Staff member removed.");
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredStaff = staff.filter((s) => {
    if (!searchTerm) return true;
    const bName = branches.find((b) => b.id === s.home_branch_id)?.name?.toLowerCase() || "";
    return s.name?.toLowerCase().includes(searchTerm) || bName.includes(searchTerm);
  });

  const grouped = ROLE_ORDER.reduce<Record<string, typeof staff>>((acc, r) => {
    acc[r] = filteredStaff.filter((s) => {
      if (r === "coordinator") return s.role === "coordinator" || s.role === "service_coordinator";
      if (r === "manager")     return s.role === "manager" || s.role === "service_manager";
      if (r === "senior")      return s.role === "senior" || s.role === "senior_fse";
      if (r === "junior")      return s.role === "junior" || s.role === "junior_fse" || s.role === "field_service_engineer";
      return s.role === r;
    });
    return acc;
  }, {});

  return (
    <div className="sched-modal-bg">
      <div className="sched-modal" style={{ maxWidth: 620, width: "100%" }}>
        <div className="sched-modal-head">
          <h3>👥 Manage Staff Roster</h3>
          <div className="sched-spacer" />
          <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="sched-modal-body" style={{ maxHeight: "calc(85vh - 120px)", overflowY: "auto" }}>
          {successMsg && (
            <div className="sched-toast" style={{ marginBottom: 12 }}>
              <span>{successMsg}</span>
              <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={() => setSuccessMsg("")}>✕</button>
            </div>
          )}

          {/* Add Staff */}
          <div className="sched-section-box" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>＋ Add Staff from Registered Accounts</div>
            <div className="sched-grid2" style={{ gap: 10 }}>
              <div className="sched-full">
                <label className="sched-fld">Existing Account <span className="sched-req">*</span></label>
                <select className="sched-sel" value={selectedUserId} onChange={(e) => handleAccountSelect(e.target.value)}>
                  <option value="">-- Select an account ({appUsers.filter((u) => !u.email?.toLowerCase().includes("eileen")).length}) --</option>
                  {appUsers.filter((u) => !u.email?.toLowerCase().includes("eileen")).map((u) => {
                    const isAdded = staff.some((s) => s.name.trim().toLowerCase() === u.name.trim().toLowerCase());
                    return <option key={u.id} value={u.id}>{isAdded ? "✓ " : ""}{u.name} — {u.email} ({u.role})</option>;
                  })}
                </select>
              </div>
              {form.name && (
                <div className="sched-full" style={{ fontSize: 12, color: "var(--sched-muted)", marginTop: -4 }}>
                  Selected: <strong>{form.name}</strong>
                </div>
              )}
              <div>
                <label className="sched-fld">Staff Role</label>
                <select className="sched-sel" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>
              </div>
              <div>
                <label className="sched-fld">Home Branch <span className="sched-req">*</span></label>
                <select className="sched-sel" value={form.home_branch_id} onChange={(e) => setForm((f) => ({ ...f, home_branch_id: e.target.value }))}>
                  <option value="">Select branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.note}</option>)}
                </select>
              </div>
              <div className="sched-full">
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" style={{ width: 16, height: 16 }}
                    checked={form.hotline} onChange={(e) => setForm((f) => ({ ...f, hotline: e.target.checked }))} />
                  ☎ Hotline team (Manila)
                </label>
              </div>
            </div>
            {err && <div className="sched-err" style={{ marginTop: 8 }}>{err}</div>}
            <button className="sched-btn sched-btn-primary sched-btn-sm" style={{ marginTop: 10 }}
              onClick={handleAdd} disabled={busy || !selectedUserId}>
              {busy ? "Adding…" : "＋ Add staff member"}
            </button>
          </div>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div className="sched-search-wrap" style={{ flex: 1 }}>
              <span>🔍</span>
              <input className="sched-search-input" placeholder="Search staff by name or branch…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <span style={{ cursor: "pointer" }} onClick={() => setSearch("")}>✕</span>}
            </div>
            <div style={{ fontSize: 12, color: "var(--sched-muted)", whiteSpace: "nowrap" }}>Total: {filteredStaff.length}</div>
          </div>

          {/* Staff list */}
          {staff.length === 0 && <div className="sched-empty-note">No staff members yet.</div>}
          {ROLE_ORDER.map((r) => {
            const grp = grouped[r];
            if (!grp?.length) return null;
            return (
              <div key={r} style={{ marginBottom: 16 }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8 }}>
                  <span style={{ background: ROLES[r].color, width: 10, height: 10, borderRadius: 2, display: "inline-block" }} />
                  {ROLES[r].label}
                  <span style={{ fontSize: 11, background: "var(--sched-surface-2)", padding: "1px 6px", borderRadius: 8 }}>{grp.length}</span>
                </h3>
                {grp.map((s) => {
                  const isEditing  = editId === s.id;
                  const branchObj  = branches.find((b) => b.id === s.home_branch_id);
                  if (isEditing) {
                    return (
                      <div key={s.id} className="sched-section-box" style={{ margin: "8px 0" }}>
                        <div style={{ fontWeight: 650, fontSize: 11.5, color: "var(--sched-senior)", marginBottom: 8, textTransform: "uppercase" }}>
                          Edit Staff Role &amp; Branch
                        </div>
                        <div className="sched-grid2" style={{ gap: 8 }}>
                          <div>
                            <label className="sched-fld">Staff Name <span className="sched-req">*</span></label>
                            <input type="text" className="sched-txt" value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div>
                            <label className="sched-fld">Role</label>
                            <select className="sched-sel" value={editForm.role}
                              onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                              {ROLE_ORDER.map((ro) => <option key={ro} value={ro}>{ROLES[ro].label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="sched-fld">Home Branch <span className="sched-req">*</span></label>
                            <select className="sched-sel" value={editForm.home_branch_id}
                              onChange={(e) => setEditForm((f) => ({ ...f, home_branch_id: e.target.value }))}>
                              <option value="">Select branch…</option>
                              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.note}</option>)}
                            </select>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                              <input type="checkbox" style={{ width: 16, height: 16 }}
                                checked={editForm.hotline} onChange={(e) => setEditForm((f) => ({ ...f, hotline: e.target.checked }))} />
                              ☎ Hotline team
                            </label>
                          </div>
                        </div>
                        {editErr && <div className="sched-err" style={{ marginTop: 6 }}>{editErr}</div>}
                        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                          <button className="sched-btn sched-btn-primary sched-btn-sm"
                            onClick={() => handleSaveEdit(s.id)} disabled={editBusy}>
                            {editBusy ? "Saving…" : "✓ Save changes"}
                          </button>
                          <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.id} className="sched-person" style={{ justifyContent: "space-between", padding: "8px 12px" }}>
                      <div>
                        <div className="sched-pname">{s.name}</div>
                        <div className="sched-pmeta">
                          🏢 {branchObj ? `${branchObj.name} (${branchObj.note})` : "—"}
                          {s.hotline && <span style={{ color: "#ec4899", fontWeight: 600, marginLeft: 6 }}>· ☎ Hotline</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button className="sched-btn sched-btn-sm" onClick={() => {
                          setEditId(s.id);
                          setEditForm({ name: s.name, role: s.role, home_branch_id: s.home_branch_id, hotline: !!s.hotline });
                          setEditErr("");
                        }}>✎ Edit</button>
                        <button className="sched-btn sched-btn-sm sched-btn-danger-sm"
                          onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="sched-modal-foot">
          <button className="sched-btn sched-btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove Staff Member?"
        message={`Remove "${deleteTarget?.name}" from staff?`}
        confirmText="Remove Staff"
        confirmVariant="danger"
        isBusy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

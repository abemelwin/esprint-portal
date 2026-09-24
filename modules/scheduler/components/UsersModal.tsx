"use client";

import { useState } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { REGIONS } from "../lib/constants";
import ConfirmModal from "./ConfirmModal";

const ROLE_OPTIONS = [
  { value: "admin",                  label: "Admin"                  },
  { value: "service_manager",        label: "Service Manager"        },
  { value: "service_coordinator",    label: "Service Coordinator"    },
  { value: "branch",                 label: "Branch User"            },
  { value: "senior_fse",             label: "Senior FSE"             },
  { value: "junior_fse",             label: "Junior FSE"             },
  { value: "trainee",                label: "Trainee"                },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", service_manager: "Service Manager",
  service_coordinator: "Service Coordinator", senior_fse: "Senior FSE",
  junior_fse: "Junior FSE", field_service_engineer: "Junior FSE",
  trainee: "Trainee", branch: "Branch User",
};

function getRegionBranchIds(regionKey: string, allBranches: any[]): string[] {
  const codes = REGIONS[regionKey] || [];
  return allBranches.filter((b) => codes.includes(b.name)).map((b) => b.id);
}

interface UsersModalProps { onClose: () => void }

export default function UsersModal({ onClose }: UsersModalProps) {
  const { appUsers, branches, staff, currentUser, loadAppUsers, loadStaff, supabase, supabaseSignup } = useScheduler();
  const [activeTab,  setActiveTab]  = useState<"list" | "add">("list");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteBusy,   setDeleteBusy]   = useState(false);

  // Add user form
  const [addForm, setAddForm] = useState({ name: "", email: "", password: "", role: "branch", branch_ids: [] as string[], can_edit: true });
  const [addBusy, setAddBusy] = useState(false);
  const [addErr,  setAddErr]  = useState("");

  // Edit user
  const [editId,   setEditId]   = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ role: "branch", branch_ids: [] as string[], can_edit: true });
  const [editBusy, setEditBusy] = useState(false);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3500);
  }

  function toggleBranchId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  async function handleAdd() {
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      setAddErr("Name, email and password are required."); return;
    }
    setAddBusy(true); setAddErr("");
    const { data: authData, error: authErr } = await supabaseSignup.auth.signUp({
      email: addForm.email.trim(), password: addForm.password,
    });
    if (authErr) { setAddErr(authErr.message); setAddBusy(false); return; }
    const authId = authData.user?.id;
    if (!authId) { setAddErr("Auth user creation failed."); setAddBusy(false); return; }
    const { error: dbErr } = await supabase.from("app_users").insert({
      auth_id: authId, name: addForm.name.trim(), email: addForm.email.trim().toLowerCase(),
      role: addForm.role, branch_ids: addForm.branch_ids, can_edit: addForm.can_edit,
    });
    if (dbErr) { setAddErr(dbErr.message); setAddBusy(false); return; }
    await loadAppUsers();
    setAddForm({ name: "", email: "", password: "", role: "branch", branch_ids: [], can_edit: true });
    setActiveTab("list"); setAddBusy(false);
    showSuccess(`✓ User "${addForm.name.trim()}" created!`);
  }

  async function handleSaveEdit(userId: string) {
    setEditBusy(true);
    const { error } = await supabase.from("app_users").update({
      role: editForm.role, branch_ids: editForm.branch_ids, can_edit: editForm.can_edit,
    }).eq("id", userId);
    if (!error) await loadAppUsers();
    setEditBusy(false); setEditId(null);
    showSuccess("✓ User updated.");
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    await supabase.from("app_users").delete().eq("id", deleteTarget.id);
    await loadAppUsers();
    setDeleteTarget(null); setDeleteBusy(false);
    showSuccess("✓ User removed.");
  }

  const isSelfEileen = currentUser?.email?.toLowerCase().includes("eileen") || currentUser?.name?.toLowerCase().includes("eileen");
  const displayUsers = appUsers.filter((u) => isSelfEileen || !u.email?.toLowerCase().includes("eileen"));

  return (
    <div className="sched-modal-bg">
      <div className="sched-modal" style={{ maxWidth: 680, width: "100%" }}>
        <div className="sched-modal-head">
          <h3>🔑 Manage Users</h3>
          <div className="sched-spacer" />
          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, marginRight: 8 }}>
            <button className={`sched-btn sched-btn-sm${activeTab === "list" ? " sched-btn-primary" : " sched-btn-ghost"}`}
              onClick={() => setActiveTab("list")}>List</button>
            <button className={`sched-btn sched-btn-sm${activeTab === "add" ? " sched-btn-primary" : " sched-btn-ghost"}`}
              onClick={() => setActiveTab("add")}>＋ Add User</button>
          </div>
          <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="sched-modal-body" style={{ maxHeight: "calc(85vh - 120px)", overflowY: "auto" }}>
          {successMsg && (
            <div className="sched-toast" style={{ marginBottom: 12 }}>
              <span>{successMsg}</span>
              <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={() => setSuccessMsg("")}>✕</button>
            </div>
          )}

          {activeTab === "add" && (
            <div>
              <div className="sched-grid2" style={{ gap: 10 }}>
                <div>
                  <label className="sched-fld">Full Name <span className="sched-req">*</span></label>
                  <input type="text" className="sched-txt" placeholder="e.g. Juan Dela Cruz"
                    value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="sched-fld">Email <span className="sched-req">*</span></label>
                  <input type="email" className="sched-txt" placeholder="user@example.com"
                    value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="sched-fld">Password <span className="sched-req">*</span></label>
                  <input type="password" className="sched-txt" placeholder="Minimum 6 characters"
                    value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} />
                </div>
                <div>
                  <label className="sched-fld">Role</label>
                  <select className="sched-sel" value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
                    {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="sched-full">
                  <label className="sched-fld">Branch Access</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                    {Object.keys(REGIONS).map((regionKey) => (
                      <button key={regionKey} type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                        onClick={() => {
                          const ids = getRegionBranchIds(regionKey, branches);
                          const allSelected = ids.every((id) => addForm.branch_ids.includes(id));
                          setAddForm((f) => ({
                            ...f,
                            branch_ids: allSelected
                              ? f.branch_ids.filter((id) => !ids.includes(id))
                              : [...new Set([...f.branch_ids, ...ids])],
                          }));
                        }}>
                        {regionKey}
                      </button>
                    ))}
                    <button type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                      onClick={() => setAddForm((f) => ({ ...f, branch_ids: f.branch_ids.length === branches.length ? [] : branches.map((b) => b.id) }))}>
                      {addForm.branch_ids.length === branches.length ? "Clear All" : "All"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {branches.map((b) => (
                      <button key={b.id} type="button"
                        className={`sched-btn sched-btn-sm${addForm.branch_ids.includes(b.id) ? " sched-btn-primary" : " sched-btn-ghost"}`}
                        onClick={() => setAddForm((f) => ({ ...f, branch_ids: toggleBranchId(f.branch_ids, b.id) }))}>
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sched-full">
                  <label className="sched-fld">Edit Access</label>
                  <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--sched-border)", width: "fit-content" }}>
                    <button type="button"
                      style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: !addForm.can_edit ? "var(--sched-senior)" : "transparent", color: !addForm.can_edit ? "#fff" : "var(--sched-muted)" }}
                      onClick={() => setAddForm((f) => ({ ...f, can_edit: false }))}>🔒 View Only</button>
                    <button type="button"
                      style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", borderLeft: "1px solid var(--sched-border)", cursor: "pointer", background: addForm.can_edit ? "var(--sched-senior)" : "transparent", color: addForm.can_edit ? "#fff" : "var(--sched-muted)" }}
                      onClick={() => setAddForm((f) => ({ ...f, can_edit: true }))}>✏️ Can Edit</button>
                  </div>
                </div>
              </div>
              {addErr && <div className="sched-err" style={{ marginTop: 10 }}>{addErr}</div>}
              <button className="sched-btn sched-btn-primary" style={{ marginTop: 14 }}
                onClick={handleAdd} disabled={addBusy}>
                {addBusy ? "Creating…" : "＋ Create User"}
              </button>
            </div>
          )}

          {activeTab === "list" && (
            <div>
              <div style={{ marginBottom: 10, fontSize: 12, color: "var(--sched-muted)" }}>
                {displayUsers.length} user{displayUsers.length !== 1 ? "s" : ""}
              </div>
              {displayUsers.map((u) => {
                const isEditing = editId === u.id;
                const branchNames = (u.branch_ids || []).map((id: string) => branches.find((b) => b.id === id)?.name || id).join(", ") || "—";
                if (isEditing) {
                  return (
                    <div key={u.id} className="sched-section-box" style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Editing: {u.name}</div>
                      <div className="sched-grid2" style={{ gap: 8 }}>
                        <div>
                          <label className="sched-fld">Role</label>
                          <select className="sched-sel" value={editForm.role}
                            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="sched-fld">Edit Access</label>
                          <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--sched-border)", width: "fit-content" }}>
                            <button type="button" style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: !editForm.can_edit ? "var(--sched-senior)" : "transparent", color: !editForm.can_edit ? "#fff" : "var(--sched-muted)" }}
                              onClick={() => setEditForm((f) => ({ ...f, can_edit: false }))}>🔒 View Only</button>
                            <button type="button" style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", borderLeft: "1px solid var(--sched-border)", cursor: "pointer", background: editForm.can_edit ? "var(--sched-senior)" : "transparent", color: editForm.can_edit ? "#fff" : "var(--sched-muted)" }}
                              onClick={() => setEditForm((f) => ({ ...f, can_edit: true }))}>✏️ Can Edit</button>
                          </div>
                        </div>
                        <div className="sched-full">
                          <label className="sched-fld">Branch Access</label>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                            {Object.keys(REGIONS).map((regionKey) => (
                              <button key={regionKey} type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                                onClick={() => {
                                  const ids = getRegionBranchIds(regionKey, branches);
                                  const allSel = ids.every((id) => editForm.branch_ids.includes(id));
                                  setEditForm((f) => ({ ...f, branch_ids: allSel ? f.branch_ids.filter((id) => !ids.includes(id)) : [...new Set([...f.branch_ids, ...ids])] }));
                                }}>{regionKey}</button>
                            ))}
                            <button type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                              onClick={() => setEditForm((f) => ({ ...f, branch_ids: f.branch_ids.length === branches.length ? [] : branches.map((b) => b.id) }))}>
                              {editForm.branch_ids.length === branches.length ? "Clear All" : "All"}
                            </button>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {branches.map((b) => (
                              <button key={b.id} type="button"
                                className={`sched-btn sched-btn-sm${editForm.branch_ids.includes(b.id) ? " sched-btn-primary" : " sched-btn-ghost"}`}
                                onClick={() => setEditForm((f) => ({ ...f, branch_ids: toggleBranchId(f.branch_ids, b.id) }))}>
                                {b.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button className="sched-btn sched-btn-primary sched-btn-sm" onClick={() => handleSaveEdit(u.id)} disabled={editBusy}>
                          {editBusy ? "Saving…" : "✓ Save"}
                        </button>
                        <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={u.id} className="sched-person" style={{ justifyContent: "space-between", padding: "10px 12px", marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="sched-pname">{u.name}</div>
                      <div className="sched-pmeta" style={{ fontSize: 11.5, marginTop: 2 }}>
                        <span style={{ color: "var(--sched-senior)", fontWeight: 600 }}>{ROLE_LABEL[u.role] || u.role}</span>
                        {u.can_edit === false && <span style={{ marginLeft: 6, color: "#e65100", background: "#fff3e0", borderRadius: 6, padding: "1px 6px", fontSize: 10.5 }}>🔒 View Only</span>}
                        <span style={{ marginLeft: 6 }}>· {u.email}</span>
                      </div>
                      <div className="sched-pmeta" style={{ fontSize: 11, marginTop: 2, color: "var(--sched-muted)" }}>
                        Branches: {branchNames.length > 60 ? branchNames.slice(0, 60) + "…" : branchNames}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button className="sched-btn sched-btn-sm" onClick={() => {
                        setEditId(u.id);
                        setEditForm({ role: u.role || "branch", branch_ids: u.branch_ids || [], can_edit: u.can_edit !== false });
                      }}>✎ Edit</button>
                      {u.id !== currentUser?.id && (
                        <button className="sched-btn sched-btn-sm sched-btn-danger-sm"
                          onClick={() => setDeleteTarget(u)}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {displayUsers.length === 0 && <div className="sched-empty-note">No users yet.</div>}
            </div>
          )}
        </div>

        <div className="sched-modal-foot">
          <button className="sched-btn sched-btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Remove User?"
        message={`Remove "${deleteTarget?.name}" (${deleteTarget?.email})? They will lose access.`}
        confirmText="Remove User"
        confirmVariant="danger"
        isBusy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

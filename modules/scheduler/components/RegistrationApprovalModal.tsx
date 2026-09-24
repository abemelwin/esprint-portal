"use client";

import { useState } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { REGIONS } from "../lib/constants";
import ConfirmModal from "./ConfirmModal";

const ROLE_OPTIONS = [
  { value: "admin",                  label: "Admin"               },
  { value: "service_manager",        label: "Service Manager"     },
  { value: "service_coordinator",    label: "Service Coordinator" },
  { value: "branch",                 label: "Branch User"         },
  { value: "senior_fse",             label: "Senior FSE"          },
  { value: "junior_fse",             label: "Junior FSE"          },
  { value: "trainee",                label: "Trainee"             },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", service_manager: "Service Manager",
  service_coordinator: "Service Coordinator", branch: "Branch User",
  senior_fse: "Senior FSE", junior_fse: "Junior FSE",
  field_service_engineer: "Junior FSE", trainee: "Trainee",
};

interface RegistrationApprovalModalProps { onClose: () => void }

export default function RegistrationApprovalModal({ onClose }: RegistrationApprovalModalProps) {
  const { pendingRegs, branches, loadPendingRegs, loadAppUsers, supabase, supabaseSignup } = useScheduler();
  const [busy,         setBusy]         = useState(false);
  const [successMsg,   setSuccessMsg]   = useState("");
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  // Per-registration overrides (role / branches before approving)
  const [overrides, setOverrides] = useState<Record<string, { role: string; branch_ids: string[]; can_edit: boolean }>>({});

  function getOverride(id: string, base: any) {
    return overrides[id] ?? { role: base.role || "branch", branch_ids: base.branch_ids || [], can_edit: true };
  }

  function setOverride(id: string, partial: Partial<{ role: string; branch_ids: string[]; can_edit: boolean }>) {
    setOverrides((prev) => ({ ...prev, [id]: { ...getOverride(id, {}), ...partial } }));
  }

  function toggleBranchId(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  }

  function getRegionBranchIds(regionKey: string): string[] {
    const codes = REGIONS[regionKey] || [];
    return branches.filter((b) => codes.includes(b.name)).map((b) => b.id);
  }

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  }

  const pending  = pendingRegs.filter((r) => r.status === "pending");
  const resolved = pendingRegs.filter((r) => r.status !== "pending");

  async function handleApprove(reg: any) {
    setBusy(true);
    const ov = getOverride(reg.id, reg);
    try {
      // Create auth user
      const { data: authData, error: authErr } = await supabaseSignup.auth.signUp({
        email: reg.email, password: reg.password_hash || reg.temp_password || "ChangeMe123!",
      });
      if (authErr) throw authErr;
      const authId = authData.user?.id;
      if (!authId) throw new Error("Auth user creation failed.");

      // Create app_users record
      const { error: dbErr } = await supabase.from("app_users").insert({
        auth_id: authId, name: reg.name, email: reg.email.toLowerCase(),
        role: ov.role, branch_ids: ov.branch_ids, can_edit: ov.can_edit,
      });
      if (dbErr) throw dbErr;

      // Mark registration as approved
      await supabase.from("pending_registrations").update({ status: "approved" }).eq("id", reg.id);
      await Promise.all([loadPendingRegs(), loadAppUsers()]);
      showSuccess(`✓ ${reg.name} approved and account created!`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setBusy(false);
  }

  async function handleConfirmReject() {
    if (!rejectTarget) return;
    setBusy(true);
    await supabase.from("pending_registrations").update({ status: "rejected" }).eq("id", rejectTarget.id);
    await loadPendingRegs();
    setRejectTarget(null); setBusy(false);
    showSuccess(`Registration for ${rejectTarget.name} rejected.`);
  }

  return (
    <div className="sched-modal-bg">
      <div className="sched-modal" style={{ maxWidth: 700, width: "100%" }}>
        <div className="sched-modal-head">
          <h3>📋 Registration Approvals</h3>
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

          {pending.length === 0 && (
            <div className="sched-empty-note" style={{ textAlign: "center", padding: "28px 0" }}>
              🎉 No pending registrations.
            </div>
          )}

          {pending.map((reg) => {
            const ov = getOverride(reg.id, reg);
            return (
              <div key={reg.id} className="sched-section-box" style={{ marginBottom: 14 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--sched-senior)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                    {reg.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{reg.name}</div>
                    <div style={{ fontSize: 12, color: "var(--sched-muted)" }}>{reg.email}</div>
                    <div style={{ fontSize: 11, color: "var(--sched-muted)", marginTop: 2 }}>
                      Requested: {new Date(reg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="sched-spacer" />
                  <span style={{ fontSize: 10.5, fontWeight: 700, background: "#fff3cd", color: "#856404", padding: "3px 10px", borderRadius: 999 }}>
                    ⏳ Pending
                  </span>
                </div>

                {/* Role override */}
                <div className="sched-grid2" style={{ gap: 8, marginBottom: 10 }}>
                  <div>
                    <label className="sched-fld">Assign Role</label>
                    <select className="sched-sel" value={ov.role}
                      onChange={(e) => setOverride(reg.id, { role: e.target.value })}>
                      {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="sched-fld">Edit Access</label>
                    <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--sched-border)", width: "fit-content", marginTop: 2 }}>
                      <button type="button" style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: !ov.can_edit ? "var(--sched-senior)" : "transparent", color: !ov.can_edit ? "#fff" : "var(--sched-muted)" }}
                        onClick={() => setOverride(reg.id, { can_edit: false })}>🔒 View Only</button>
                      <button type="button" style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, border: "none", borderLeft: "1px solid var(--sched-border)", cursor: "pointer", background: ov.can_edit ? "var(--sched-senior)" : "transparent", color: ov.can_edit ? "#fff" : "var(--sched-muted)" }}
                        onClick={() => setOverride(reg.id, { can_edit: true })}>✏️ Can Edit</button>
                    </div>
                  </div>
                  <div className="sched-full">
                    <label className="sched-fld">Branch Access</label>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                      {Object.keys(REGIONS).map((regionKey) => (
                        <button key={regionKey} type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                          onClick={() => {
                            const ids = getRegionBranchIds(regionKey);
                            const allSel = ids.every((id) => ov.branch_ids.includes(id));
                            setOverride(reg.id, { branch_ids: allSel ? ov.branch_ids.filter((id) => !ids.includes(id)) : [...new Set([...ov.branch_ids, ...ids])] });
                          }}>{regionKey}</button>
                      ))}
                      <button type="button" className="sched-btn sched-btn-sm sched-btn-ghost"
                        onClick={() => setOverride(reg.id, { branch_ids: ov.branch_ids.length === branches.length ? [] : branches.map((b) => b.id) })}>
                        {ov.branch_ids.length === branches.length ? "Clear All" : "All"}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {branches.map((b) => (
                        <button key={b.id} type="button"
                          className={`sched-btn sched-btn-sm${ov.branch_ids.includes(b.id) ? " sched-btn-primary" : " sched-btn-ghost"}`}
                          onClick={() => setOverride(reg.id, { branch_ids: toggleBranchId(ov.branch_ids, b.id) })}>
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="sched-btn sched-btn-primary sched-btn-sm" onClick={() => handleApprove(reg)} disabled={busy}>
                    {busy ? "Processing…" : "✓ Approve & Create Account"}
                  </button>
                  <button className="sched-btn sched-btn-sm sched-btn-danger-sm" onClick={() => setRejectTarget(reg)} disabled={busy}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            );
          })}

          {/* Resolved section */}
          {resolved.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sched-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                Recently Resolved ({resolved.length})
              </div>
              {resolved.slice(0, 10).map((reg) => (
                <div key={reg.id} className="sched-person" style={{ padding: "8px 12px", marginBottom: 6, opacity: 0.7 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="sched-pname">{reg.name}</div>
                    <div className="sched-pmeta">{reg.email}</div>
                  </div>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                    background: reg.status === "approved" ? "#d1fae5" : "#fee2e2",
                    color: reg.status === "approved" ? "#065f46" : "#991b1b",
                  }}>
                    {reg.status === "approved" ? "✓ Approved" : "✕ Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sched-modal-foot">
          <button className="sched-btn sched-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!rejectTarget}
        title="Reject Registration?"
        message={`Reject the registration request from "${rejectTarget?.name}" (${rejectTarget?.email})?`}
        confirmText="Reject"
        confirmVariant="warning"
        isBusy={busy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
}

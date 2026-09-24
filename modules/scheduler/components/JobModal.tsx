"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { TYPE_KEYS, ABSENCE_KEYS, TYPES, namesMatch, type Job } from "../lib/constants";
import { extractHrefFromHtml, cleanNetsuiteUrl, buildNetsuiteUrl } from "../lib/netsuite";
import ConfirmModal from "./ConfirmModal";

const EMPTY = {
  jt_no: "", jt_url: "", staff_id: "", branch_id: "",
  customer: "", location: "", machine: "", serial_no: "",
  type: "", type_other: "", status: "pending", status_note: "",
};

// ── Searchable staff picker ───────────────────────────────────────────────────
function StaffPicker({ staffList, value, onChange }: {
  staffList: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const current  = staffList.find((s) => s.id === value);
  const filtered = staffList.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="sched-bp-wrap" ref={ref} style={{ width: "100%" }}>
      <button type="button" className={`sched-bp-trigger sched-sp-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span className="sched-sp-avatar">{current ? current.name.charAt(0).toUpperCase() : "👤"}</span>
          <span style={{ color: current ? "var(--sched-ink-1)" : "var(--sched-muted)" }}>
            {current ? current.name : "Select employee…"}
          </span>
        </div>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="sched-bp-dropdown">
          <div className="sched-bp-search-row">
            <span>🔍</span>
            <input className="sched-bp-search" autoFocus placeholder="Search employee…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <span style={{ cursor: "pointer" }} onClick={() => setSearch("")}>✕</span>}
          </div>
          <div className="sched-bp-list">
            <div className={`sched-bp-item${!value ? " active" : ""}`} onClick={() => { onChange(""); setOpen(false); }}>
              <span style={{ color: "var(--sched-muted)" }}>— Clear Selection —</span>
            </div>
            {filtered.length === 0
              ? <div className="sched-bp-empty">No matching employees</div>
              : filtered.map((s) => (
                <div key={s.id} className={`sched-bp-item${s.id === value ? " active" : ""}`}
                  onClick={() => { onChange(s.id); setOpen(false); setSearch(""); }}>
                  <span className="sched-sp-avatar-sm">{s.name.charAt(0).toUpperCase()}</span>
                  <span>{s.name}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── JobModal ──────────────────────────────────────────────────────────────────
interface JobModalProps {
  payload: { date: string; job?: Job };
  onClose: () => void;
}

export default function JobModal({ payload, onClose }: JobModalProps) {
  const { branches, staff, appUsers, loadJobs, loadStaff, isAdmin, currentUser, canEditBranch, supabase } = useScheduler();
  const isEdit = !!payload.job;
  const [form, setForm]   = useState({ ...EMPTY });
  const [busy, setBusy]   = useState(false);
  const [err,  setErr]    = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUrlField,      setShowUrlField]      = useState(false);

  const canEditJob = isEdit
    ? (isAdmin || canEditBranch(payload.job?.branch_id))
    : (isAdmin || canEditBranch());

  const availableBranches = isAdmin
    ? branches
    : isEdit
      ? branches
      : branches.filter((b) => canEditBranch(b.id));

  useEffect(() => {
    if (isEdit) {
      const j = payload.job!;
      setForm({
        jt_no: j.jt_no || "", jt_url: j.jt_url || "", staff_id: j.staff_id || "",
        branch_id: j.branch_id || "", customer: j.customer || "", location: j.location || "",
        machine: (j as any).machine || "", serial_no: (j as any).serial_no || "",
        type: j.type || "", type_other: j.type_other || "",
        status: j.status || "pending", status_note: j.status_note || "",
      });
    } else {
      const defaultBranch = currentUser?.main_branch_id || availableBranches[0]?.id || "";
      setForm({ ...EMPTY, branch_id: defaultBranch });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: unknown) => { if (!canEditJob) return; setForm((f) => ({ ...f, [k]: v })); };

  const isAbsence = form.type === "leave" || form.type === "absent";
  const customerRequired = form.type === "onsite" || form.type === "installation";
  const jtRequired       = form.type === "onsite" || form.type === "installation";

  function validate() {
    if (jtRequired && !form.jt_no.trim()) return "Netsuite# is required.";
    if (!form.staff_id)  return "Employee is required.";
    if (!form.branch_id) return "Branch is required.";
    if (customerRequired && !form.customer.trim()) return "Customer name is required.";
    if (!form.type)      return "Type is required.";
    if (form.type === "others" && !form.type_other.trim()) return "Please describe the service.";
    if ((form.status === "fail" || form.status === "ongoing" || form.status === "cancel") && !form.status_note.trim()) {
      return form.status === "fail" ? "Please provide the reason for failure."
        : form.status === "cancel" ? "Please provide a reason for cancellation."
        : "Please provide an ongoing note.";
    }
    return null;
  }

  // Combined staff list: existing staff + app users
  const staffList = useMemo(() => {
    let list = [...staff];
    appUsers.forEach((u) => {
      if (!u.name || u.email?.toLowerCase().includes("eileen")) return;
      const uNorm = u.name.trim().toLowerCase();
      const exists = list.some((s) => {
        const sNorm = s.name.trim().toLowerCase();
        return sNorm === uNorm || sNorm.includes(uNorm) || uNorm.includes(sNorm);
      });
      if (!exists) list.push({ id: u.id, name: u.name, role: u.role || "junior", home_branch_id: u.main_branch_id || u.branch_ids?.[0] || "", hotline: false });
    });
    if (!isAdmin) {
      list = list.filter((s) => {
        const r = (s.role || "").toLowerCase();
        if (r === "coordinator" || r === "service_coordinator") return false;
        const mu = appUsers.find((u) => namesMatch(u.name, s.name));
        if (mu && (mu.role === "coordinator" || mu.role === "service_coordinator")) return false;
        return true;
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, appUsers, isAdmin]);

  function handleStaffChange(staffId: string) {
    if (!canEditJob) return;
    if (!staffId) { setForm((f) => ({ ...f, staff_id: "" })); return; }
    const sm = staffList.find((s) => s.id === staffId) || staff.find((s) => s.id === staffId);
    const mu = appUsers.find((u) => u.id === staffId || (sm?.name && u.name?.trim().toLowerCase() === sm.name.trim().toLowerCase()));
    const homeBranch = sm?.home_branch_id || (sm as any)?.main_branch_id || mu?.main_branch_id || mu?.branch_ids?.[0];
    setForm((f) => {
      const branchOk = homeBranch && branches.some((b) => b.id === homeBranch);
      return { ...f, staff_id: staffId, ...(branchOk ? { branch_id: homeBranch } : {}) };
    });
  }

  async function resolveStaffId(selectedId: string): Promise<string | null> {
    if (!selectedId) return null;
    if (staff.find((s) => s.id === selectedId)) return selectedId;
    const emp = staffList.find((s) => s.id === selectedId) || appUsers.find((u) => u.id === selectedId);
    if (!emp) return selectedId;
    const byName = staff.find((s) => s.name?.trim().toLowerCase() === emp.name?.trim().toLowerCase());
    if (byName) return byName.id;
    let mappedRole = "junior";
    const r = ((emp as any).role || "").toLowerCase();
    if (r.includes("senior")) mappedRole = "senior";
    else if (r.includes("trainee")) mappedRole = "trainee";
    else if (r.includes("manager")) mappedRole = "manager";
    else if (r.includes("bsm")) mappedRole = "bsm";
    const homeBranch = (emp as any).home_branch_id || (emp as any).main_branch_id || ((emp as any).branch_ids?.[0]) || form.branch_id || null;
    const { data: newStaff, error } = await supabase.from("staff")
      .insert({ name: emp.name.trim(), role: mappedRole, home_branch_id: homeBranch, hotline: false })
      .select("id").single();
    if (!error && newStaff?.id) { await loadStaff(); return (newStaff as any).id; }
    return selectedId;
  }

  async function handleSave() {
    if (!canEditJob) return;
    const e = validate(); if (e) { setErr(e); return; }
    setBusy(true); setErr("");
    const validStaffId = await resolveStaffId(form.staff_id);
    const row = {
      date:        payload.job?.date || payload.date,
      jt_no:       isAbsence ? "" : form.jt_no.trim(),
      jt_url:      isAbsence ? "" : cleanNetsuiteUrl(form.jt_url),
      staff_id:    validStaffId,
      branch_id:   form.branch_id,
      customer:    isAbsence ? "" : form.customer.trim(),
      location:    isAbsence ? "" : form.location.trim(),
      machine:     isAbsence ? "" : form.machine.trim(),
      serial_no:   isAbsence ? "" : form.serial_no.trim(),
      type:        form.type,
      type_other:  form.type === "others" ? form.type_other.trim() : "",
      status:      isAbsence ? "pending" : form.status,
      status_note: (!isAbsence && (form.status === "fail" || form.status === "ongoing" || form.status === "cancel")) ? form.status_note.trim() : "",
    };
    const { error } = isEdit
      ? await supabase.from("jobs").update(row).eq("id", payload.job!.id)
      : await supabase.from("jobs").insert(row);
    if (error) { setErr(error.message); setBusy(false); return; }
    await loadJobs();
    onClose();
  }

  async function handleConfirmDelete() {
    if (!canEditJob || !payload.job?.id) return;
    setBusy(true);
    const { error } = await supabase.from("jobs").delete().eq("id", payload.job.id);
    if (error) { setErr(error.message); setBusy(false); setShowDeleteConfirm(false); return; }
    await loadJobs();
    setShowDeleteConfirm(false);
    onClose();
  }

  const displayedBranches = useMemo(() => {
    if (!form.branch_id) return availableBranches;
    if (availableBranches.some((b) => b.id === form.branch_id)) return availableBranches;
    const extra = branches.find((b) => b.id === form.branch_id);
    return extra ? [...availableBranches, extra] : availableBranches;
  }, [availableBranches, branches, form.branch_id]);

  const showStatusNote   = form.status === "fail" || form.status === "ongoing" || form.status === "cancel";
  const currentBranchObj = branches.find((b) => b.id === (form.branch_id || payload.job?.branch_id));
  const assignedStaffObj = staffList.find((s) => s.id === form.staff_id);
  const jobDate          = payload.job?.date || payload.date;

  return (
    <>
      <div className="sched-modal-bg" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <div className="sched-modal sched-job-modal">
          {/* Head */}
          <div className="sched-modal-head">
            <div className="sched-job-head-title">
              <span className={`sched-modal-badge ${isAbsence ? "absence" : "ticket"}`}>
                {isAbsence ? "🌴" : isEdit ? "📝" : "➕"}
              </span>
              <div>
                <h3>{isAbsence ? (isEdit ? "Edit Absence" : "Mark Absence") : (isEdit ? (canEditJob ? "Edit Job Ticket" : "Job Ticket Details") : "New Job Ticket")}</h3>
                <div className="sched-modal-subtitle">
                  <span>📅 {jobDate}</span>
                  {currentBranchObj && <span>· 🏢 {currentBranchObj.name}</span>}
                </div>
              </div>
              {!canEditJob && <span className="sched-view-badge">🔒 View Only</span>}
            </div>
            <div className="sched-spacer" />
            <button className="sched-btn sched-btn-ghost sched-btn-sm" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className="sched-modal-body sched-job-body">
            {!canEditJob && (
              <div className="sched-view-banner">
                <span>🔒</span>
                <span><strong>Viewing Mode:</strong> You have view-only access. Changes cannot be saved.</span>
              </div>
            )}

            <div className="sched-grid2">
              <div>
                <label className="sched-fld">Date</label>
                <input type="text" className="sched-txt" value={jobDate} disabled />
              </div>

              <div>
                <label className="sched-fld">
                  Netsuite# {jtRequired && <span className="sched-req">*</span>}
                  {(form.jt_no || form.jt_url) && (
                    <a href={form.jt_no ? buildNetsuiteUrl(form.jt_no) : cleanNetsuiteUrl(form.jt_url)}
                      target="_blank" rel="noopener noreferrer" className="sched-ns-link" title="Open in NetSuite">
                      🔗 Open in NetSuite
                    </a>
                  )}
                </label>
                <input type="text" className="sched-txt" placeholder="e.g. NS-1050"
                  value={form.jt_no} disabled={!canEditJob}
                  onChange={(e) => set("jt_no", e.target.value)}
                  onPaste={(e) => {
                    if (!canEditJob) return;
                    const html  = e.clipboardData?.getData("text/html");
                    const plain = e.clipboardData?.getData("text/plain") || "";
                    if (/^https?:\/\//i.test(plain.trim()) || /netsuite\.com/i.test(plain.trim())) {
                      setForm((f) => ({ ...f, jt_url: cleanNetsuiteUrl(plain.trim()) })); return;
                    }
                    const url = extractHrefFromHtml(html, plain.trim());
                    if (url) setForm((f) => ({ ...f, jt_url: cleanNetsuiteUrl(url) }));
                  }} />
                {canEditJob && (
                  <div style={{ marginTop: 5, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    {form.jt_url
                      ? <span style={{ color: "#059669", fontWeight: 650 }}>✓ Link saved</span>
                      : <span style={{ color: "var(--sched-muted)", fontSize: 11 }}>Tip: Copying from NetSuite auto-captures the link</span>}
                    <button type="button" className="sched-btn sched-btn-ghost sched-btn-sm"
                      onClick={() => setShowUrlField((v) => !v)}>
                      {showUrlField ? "▴ Hide URL" : form.jt_url ? "✎ Edit URL" : "＋ Add URL"}
                    </button>
                  </div>
                )}
                {showUrlField && canEditJob && (
                  <div style={{ marginTop: 6, background: "var(--sched-surface-2)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--sched-border)" }}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--sched-muted)", display: "block", marginBottom: 4, textTransform: "uppercase" }}>
                      NetSuite Record URL
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="text" className="sched-txt" style={{ fontSize: 11.5, flex: 1 }}
                        placeholder="https://system.netsuite.com/…"
                        value={form.jt_url} onChange={(e) => set("jt_url", cleanNetsuiteUrl(e.target.value))} />
                      {form.jt_url && (
                        <button type="button" className="sched-btn sched-btn-ghost sched-btn-sm"
                          style={{ color: "var(--sched-st-fail)" }} onClick={() => set("jt_url", "")}>✕ Clear</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="sched-fld">Employee <span className="sched-req">*</span></label>
                {canEditJob
                  ? <StaffPicker staffList={staffList} value={form.staff_id} onChange={handleStaffChange} />
                  : <input type="text" className="sched-txt" value={assignedStaffObj?.name || "—"} disabled />}
              </div>

              <div>
                <label className="sched-fld">Branch Serviced <span className="sched-req">*</span></label>
                <select className="sched-sel" value={form.branch_id} disabled={!canEditJob}
                  onChange={(e) => set("branch_id", e.target.value)}>
                  <option value="">Select Branch…</option>
                  {displayedBranches.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.note}</option>)}
                </select>
              </div>

              {!isAbsence && (
                <>
                  <div className="sched-full">
                    <label className="sched-fld">Customer Name {customerRequired && <span className="sched-req">*</span>}</label>
                    <input type="text" className="sched-txt" placeholder="e.g. National Bookstore"
                      value={form.customer} disabled={!canEditJob}
                      onChange={(e) => set("customer", e.target.value)} />
                  </div>
                  <div className="sched-full">
                    <label className="sched-fld">Location / Department</label>
                    <input type="text" className="sched-txt" placeholder="e.g. 2F, Near Admin Office"
                      value={form.location} disabled={!canEditJob}
                      onChange={(e) => set("location", e.target.value)} />
                  </div>
                  <div>
                    <label className="sched-fld">Machine Model</label>
                    <input type="text" className="sched-txt" placeholder="e.g. Epson L3210"
                      value={form.machine} disabled={!canEditJob}
                      onChange={(e) => set("machine", e.target.value)} />
                  </div>
                  <div>
                    <label className="sched-fld">Serial Number</label>
                    <input type="text" className="sched-txt" placeholder="e.g. X4Y123456"
                      value={form.serial_no} disabled={!canEditJob}
                      onChange={(e) => set("serial_no", e.target.value)} />
                  </div>
                </>
              )}

              <div className="sched-full">
                <label className="sched-fld">Job Type <span className="sched-req">*</span></label>
                <div className="sched-seg-radio">
                  {TYPE_KEYS.map((t) => (
                    <button key={t} type="button" disabled={!canEditJob}
                      className={`sched-seg-btn${form.type === t ? " active" : ""}`}
                      onClick={() => set("type", t)}>
                      {t === "installation" && "🛠️ "}
                      {t === "onsite" && "🚗 "}
                      {t === "hotline" && "📞 "}
                      {t === "others" && "⚙️ "}
                      {TYPES[t].label}
                    </button>
                  ))}
                </div>
                {isAdmin && (
                  <div className="sched-seg-radio sched-absence-seg" style={{ marginTop: 8 }}>
                    {ABSENCE_KEYS.map((t) => (
                      <button key={t} type="button" disabled={!canEditJob}
                        className={`sched-seg-btn${form.type === t ? " active" : ""}`}
                        onClick={() => set("type", t)}>
                        {t === "leave" ? "🌴 On Leave" : "🚫 Mark Absent"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {form.type === "others" && (
                <div className="sched-full">
                  <label className="sched-fld">Describe Service <span className="sched-req">*</span></label>
                  <input type="text" className="sched-txt" placeholder="e.g. Preventive maintenance…"
                    value={form.type_other} disabled={!canEditJob}
                    onChange={(e) => set("type_other", e.target.value)} />
                </div>
              )}

              {!isAbsence && (
                <div className="sched-full">
                  <label className="sched-fld">Status</label>
                  <div className="sched-seg-radio sched-status-seg">
                    {["pending","ongoing","success","fail","cancel"].map((s) => (
                      <button key={s} type="button" disabled={!canEditJob}
                        className={`sched-seg-btn sched-status-${s}${form.status === s ? " active" : ""}`}
                        onClick={() => set("status", s)}>
                        {s === "pending" ? "⏳ Pending" : s === "ongoing" ? "◐ Ongoing" : s === "success" ? "✓ Successful" : s === "fail" ? "✕ Not successful" : "🚫 Cancelled"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isAbsence && showStatusNote && (
                <div className="sched-full">
                  <div className={`sched-status-note sched-status-note-${form.status}`}>
                    <label className="sched-fld">
                      {form.status === "fail" ? "⚠️ Reason for failure" : form.status === "cancel" ? "🚫 Reason for cancellation" : "📝 Ongoing note"}
                      <span className="sched-req"> *</span>
                    </label>
                    <input type="text" className="sched-txt"
                      placeholder={form.status === "fail" ? "e.g. Missing parts…" : form.status === "cancel" ? "e.g. Client cancelled…" : "e.g. Waiting for parts…"}
                      value={form.status_note} disabled={!canEditJob} autoFocus
                      onChange={(e) => set("status_note", e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {err && <div className="sched-modal-alert">{err}</div>}
          </div>

          {/* Footer */}
          <div className="sched-modal-foot">
            {isEdit && canEditJob && (
              <button type="button" className="sched-btn sched-btn-danger sched-btn-sm"
                style={{ marginRight: "auto" }} onClick={() => setShowDeleteConfirm(true)} disabled={busy}>
                🗑 Delete Ticket
              </button>
            )}
            <button type="button" className="sched-btn sched-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            {canEditJob && (
              <button type="button" className="sched-btn sched-btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? "Saving…" : isEdit ? "Save changes" : "Create ticket"}
              </button>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete Job Ticket?"
        message="This will permanently delete the ticket. This cannot be undone."
        confirmText="Delete Ticket"
        confirmVariant="danger"
        isBusy={busy}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

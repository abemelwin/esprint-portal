"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Job, Staff, Branch, JobType, JobStatus } from "../types";
import { TYPES, TYPE_KEYS, STATUS } from "../constants";

// ── NetSuite URL helper ───────────────────────────────────────────
function buildNetsuiteUrl(jtNo: string): string {
  const clean = jtNo.replace(/\D/g, "");
  if (!clean) return "";
  return `https://system.netsuite.com/app/crm/support/supportcase.nl?id=${clean}`;
}
function cleanNetsuiteUrl(raw: string): string {
  if (!raw) return "";
  const t = raw.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("/app/")) return `https://system.netsuite.com${t}`;
  return t;
}

// ── Searchable Staff Picker ───────────────────────────────────────
function StaffPicker({
  staffList, value, onChange, disabled,
}: { staffList: Staff[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current  = staffList.find(s => s.id === value);
  const filtered = staffList.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(id: string) { onChange(id); setOpen(false); setSearch(""); }

  if (disabled) {
    return (
      <input
        className="sch-sel w-full"
        value={current?.name ?? "—"}
        disabled
        readOnly
      />
    );
  }

  return (
    <div className="sch-bp-wrap" ref={ref} style={{ width: "100%" }}>
      <button
        type="button"
        className={`sch-bp-trigger sch-sp-trigger${open ? " active" : ""}`}
        style={{ width: "100%" }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="sch-sp-avatar">
          {current ? current.name.charAt(0).toUpperCase() : "👤"}
        </span>
        <span className="sch-sp-name" style={{ color: current ? "var(--sch-ink1)" : "var(--sch-muted)" }}>
          {current ? current.name : "Select employee…"}
        </span>
        <span className="sch-bp-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="sch-bp-dropdown sch-sp-dropdown" style={{ zIndex: 300 }}>
          <div className="sch-bp-search-row">
            <span style={{ fontSize: 13, color: "var(--sch-muted)" }}>🔍</span>
            <input
              className="sch-bp-search"
              autoFocus
              placeholder="Search employee by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <span
                style={{ fontSize: 10, color: "var(--sch-muted)", cursor: "pointer", padding: "2px 4px" }}
                onClick={() => setSearch("")}
              >✕</span>
            )}
          </div>
          <div className="sch-bp-list">
            <div
              className={`sch-bp-item${!value ? " active" : ""}`}
              onClick={() => pick("")}
            >
              <span style={{ color: "var(--sch-muted)", fontSize: 12 }}>— Clear Selection —</span>
            </div>
            {filtered.length === 0 ? (
              <div className="sch-bp-empty">No matching employees</div>
            ) : (
              filtered.map(s => (
                <div
                  key={s.id}
                  className={`sch-bp-item${s.id === value ? " active" : ""}`}
                  onClick={() => pick(s.id)}
                >
                  <span className="sch-sp-avatar-sm">{s.name.charAt(0).toUpperCase()}</span>
                  <span className="sch-sp-name">{s.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Confirm Delete Modal ──────────────────────────────────────────
function ConfirmDelete({
  onCancel, onConfirm, busy,
}: { onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  return (
    <div className="sch-confirm-overlay" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sch-confirm-card">
        <div className="sch-confirm-body">
          <div className="sch-confirm-icon">🗑</div>
          <p className="sch-confirm-title">Delete Job Ticket?</p>
          <p className="sch-confirm-desc">
            This action cannot be undone. The ticket and all its details will be permanently removed.
          </p>
        </div>
        <div className="sch-confirm-foot">
          <button className="sch-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className="sch-btn"
            style={{ background: "linear-gradient(180deg,#ef4444,#dc2626)", color: "#fff", borderColor: "#dc2626" }}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main JobModal ─────────────────────────────────────────────────
interface Props {
  payload: { date: string; job?: Job } | null;
  onClose: () => void;
  staff: Staff[];
  branches: Branch[];
  onSave: (job: Omit<Job, "id"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  canEdit?: boolean;
}

const EMPTY_FORM = (date: string) => ({
  id:          undefined as string | undefined,
  date,
  jt_no:       "",
  jt_url:      "",
  staff_id:    "",
  branch_id:   "",
  customer:    "",
  location:    "",
  machine:     "",
  serial_no:   "",
  type:        "" as JobType | "",
  type_other:  "",
  status:      "pending" as JobStatus,
  status_note: "",
});

type FormState = ReturnType<typeof EMPTY_FORM>;

export function JobModal({
  payload, onClose, staff, branches,
  onSave, onDelete, isAdmin = true, canEdit = true,
}: Props) {
  const isEdit = !!(payload?.job);
  const [form,          setForm]          = useState<FormState>(EMPTY_FORM(payload?.date ?? ""));
  const [err,           setErr]           = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUrlField,  setShowUrlField]  = useState(false);

  useEffect(() => {
    if (!payload) return;
    if (payload.job) {
      const j = payload.job;
      setForm({
        id:          j.id,
        date:        j.date,
        jt_no:       j.jt_no       ?? "",
        jt_url:      (j as any).jt_url ?? "",
        staff_id:    j.staff_id,
        branch_id:   j.branch_id,
        customer:    j.customer    ?? "",
        location:    (j as any).location   ?? "",
        machine:     (j as any).machine    ?? "",
        serial_no:   (j as any).serial_no  ?? "",
        type:        j.type,
        type_other:  j.type_other  ?? "",
        status:      j.status,
        status_note: j.status_note ?? "",
      });
    } else {
      setForm(EMPTY_FORM(payload.date));
    }
    setErr("");
    setShowUrlField(false);
    setShowDeleteConfirm(false);
  }, [payload]);

  if (!payload) return null;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    if (!canEdit) return;
    setForm(f => ({ ...f, [k]: v }));
  }

  const isAbsence        = form.type === "leave" || form.type === "absent";
  const customerRequired = form.type === "onsite" || form.type === "installation";
  const jtRequired       = form.type === "onsite" || form.type === "installation";
  const showStatusNote   = form.status === "fail" || form.status === "ongoing" || form.status === "cancel";

  function validate(): string | null {
    if (!form.type)                                return "Job type is required.";
    if (jtRequired && !form.jt_no.trim())         return "Netsuite# is required for this job type.";
    if (!form.staff_id)                            return "Employee is required.";
    if (!form.branch_id)                           return "Branch is required.";
    if (customerRequired && !form.customer.trim()) return "Customer name is required.";
    if (form.type === "others" && !form.type_other.trim()) return "Please describe the service.";
    if ((form.status === "fail" || form.status === "ongoing" || form.status === "cancel") && !form.status_note.trim()) {
      if (form.status === "fail")   return "Please provide the reason for failure.";
      if (form.status === "cancel") return "Please provide a reason for cancellation.";
      return "Please provide an ongoing note.";
    }
    return null;
  }

  function handleSave() {
    if (!canEdit) return;
    const e = validate(); if (e) { setErr(e); return; }
    setErr("");
    onSave({
      id:          form.id,
      date:        form.date,
      jt_no:       isAbsence ? "" : form.jt_no.trim(),
      staff_id:    form.staff_id,
      branch_id:   form.branch_id,
      customer:    isAbsence ? "" : form.customer.trim(),
      type:        form.type as JobType,
      type_other:  form.type === "others" ? form.type_other.trim() : "",
      status:      isAbsence ? "success" : form.status,
      status_note: showStatusNote ? form.status_note.trim() : "",
      // extra fields stored on the object but not in base type
      ...(isAbsence ? {} : {
        location:  (form as any).location?.trim() ?? "",
        machine:   (form as any).machine?.trim()  ?? "",
        serial_no: (form as any).serial_no?.trim() ?? "",
        jt_url:    cleanNetsuiteUrl((form as any).jt_url ?? ""),
      }),
    } as any);
    onClose();
  }

  function handleStaffChange(id: string) {
    if (!canEdit) return;
    const s = staff.find(st => st.id === id);
    const autoB = s?.home_branch_id && branches.some(b => b.id === s.home_branch_id)
      ? s.home_branch_id : form.branch_id;
    setForm(f => ({ ...f, staff_id: id, branch_id: autoB }));
  }

  const fldCls = "sch-sel w-full";
  const inpCls = "sch-sel w-full";
  const lbl    = (txt: string, req = false) => (
    <label className="sch-fld">{txt}{req && <span className="sch-req"> *</span>}</label>
  );

  const TypeBtn = ({ t, icon, label }: { t: string; icon: string; label: string }) => (
    <button
      type="button"
      className={`sch-seg-radio-btn${form.type === t ? ` active t-${t === "installation" ? "install" : t}` : ""}`}
      style={{
        flex: "1 1 auto",
        border: "1px solid",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 650,
        cursor: canEdit ? "pointer" : "default",
        transition: "all .12s",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: form.type === t ? TYPE_COLORS[t] : "var(--sch-s2)",
        borderColor: form.type === t ? TYPE_COLORS[t] : "var(--sch-border)",
        color: form.type === t ? "#fff" : "var(--sch-ink2)",
      }}
      disabled={!canEdit}
      onClick={() => set("type", t as JobType)}
    >
      <span>{icon}</span><span>{label}</span>
    </button>
  );

  const StatusBtn = ({ s, icon, label }: { s: string; icon: string; label: string }) => (
    <button
      type="button"
      style={{
        flex: "1 1 auto",
        border: "1px solid",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 650,
        cursor: canEdit ? "pointer" : "default",
        transition: "all .12s",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: form.status === s ? STATUS_COLORS[s] : "var(--sch-s2)",
        borderColor: form.status === s ? STATUS_COLORS[s] : "var(--sch-border)",
        color: form.status === s ? "#fff" : "var(--sch-ink2)",
      }}
      disabled={!canEdit}
      onClick={() => set("status", s as JobStatus)}
    >
      <span>{icon}</span><span>{label}</span>
    </button>
  );

  const statusNoteClass = form.status === "fail" ? "is-fail" : form.status === "cancel" ? "is-cancel" : "is-ongoing";
  const statusNotePlaceholder =
    form.status === "fail"   ? "e.g. Missing parts, client rescheduled…" :
    form.status === "cancel" ? "e.g. Client cancelled, no-show…" :
    "e.g. Waiting for parts delivery…";
  const statusNoteLabel =
    form.status === "fail"   ? "⚠️ Reason for failure" :
    form.status === "cancel" ? "🚫 Reason for cancellation" :
    "📝 Ongoing note";

  const currentBranch = branches.find(b => b.id === form.branch_id);
  const jobDate = payload.job?.date ?? payload.date;

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-5"
        style={{ background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)" }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="bg-white flex flex-col overflow-hidden"
          style={{ width: "min(580px,96vw)", maxHeight: "90vh", borderRadius: 18, boxShadow: "0 24px 60px -12px rgba(15,23,42,.28)", border: "1px solid var(--sch-border)" }}
        >
          {/* Header */}
          <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--sch-border)", display: "flex", alignItems: "center", gap: 12, background: "var(--sch-s1)" }}>
            <div className={`sch-modal-badge-icon${isAbsence ? " absence" : ""}`}>
              {isAbsence ? "🌴" : isEdit ? "📝" : "➕"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--sch-ink1)" }}>
                {isAbsence
                  ? (isEdit ? "Edit Absence" : "Mark Absence")
                  : (isEdit ? (canEdit ? "Edit Job Ticket" : "Job Ticket Details") : "New Job Ticket")}
                {!canEdit && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#fff3e0", color: "#e65100", marginLeft: 8 }}>
                    🔒 View Only
                  </span>
                )}
              </div>
              <div className="sch-modal-head-sub">
                <span>📅 {jobDate}</span>
                {currentBranch && <span>· 🏢 {currentBranch.name}</span>}
              </div>
            </div>
            <button
              type="button"
              style={{ fontSize: 18, color: "var(--sch-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6 }}
              onClick={onClose}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
            {!canEdit && (
              <div className="sch-view-banner">
                <span>🔒</span>
                <span><strong>Viewing Mode:</strong> You have view-only access. Changes cannot be saved.</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
              {/* Date (readonly) */}
              <div>
                {lbl("Date")}
                <div className="sch-input-icon-wrap">
                  <span className="icon">📅</span>
                  <input className={`${inpCls} sch-readonly`} value={jobDate} disabled readOnly />
                </div>
              </div>

              {/* Netsuite # */}
              <div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 5 }}>
                  <label className="sch-fld" style={{ margin: 0 }}>
                    Netsuite#{jtRequired && <span className="sch-req"> *</span>}
                  </label>
                  {(form.jt_no || (form as any).jt_url) && (
                    <a
                      href={form.jt_no ? buildNetsuiteUrl(form.jt_no) : cleanNetsuiteUrl((form as any).jt_url ?? "")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sch-ns-link"
                    >🔗 Open in NetSuite</a>
                  )}
                </div>
                <div className="sch-input-icon-wrap">
                  <span className="icon">🔖</span>
                  <input
                    className={inpCls}
                    placeholder="e.g. NS-1050"
                    value={form.jt_no}
                    disabled={!canEdit}
                    onChange={e => set("jt_no", e.target.value)}
                  />
                </div>
                {canEdit && (
                  <div style={{ marginTop: 5, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                    {(form as any).jt_url ? (
                      <span style={{ color: "#059669", fontWeight: 650 }}>✓ Link saved</span>
                    ) : (
                      <span style={{ color: "var(--sch-muted)", fontSize: 11 }}>Tip: Paste from NetSuite to capture link</span>
                    )}
                    <button
                      type="button"
                      className="sch-btn ghost sm"
                      style={{ padding: "1px 6px", fontSize: 11 }}
                      onClick={() => setShowUrlField(v => !v)}
                    >
                      {showUrlField ? "▴ Hide URL" : (form as any).jt_url ? "✎ Edit URL" : "＋ Add URL"}
                    </button>
                  </div>
                )}
                {showUrlField && canEdit && (
                  <div style={{ marginTop: 6, background: "var(--sch-s2)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--sch-border)" }}>
                    <label className="sch-fld" style={{ marginBottom: 4 }}>NetSuite Record URL</label>
                    <input
                      className={inpCls}
                      placeholder="https://system.netsuite.com/app/…"
                      value={(form as any).jt_url ?? ""}
                      onChange={e => setForm(f => ({ ...f, jt_url: cleanNetsuiteUrl(e.target.value) }))}
                    />
                  </div>
                )}
              </div>

              {/* Staff */}
              <div>
                {lbl("Employee", true)}
                <StaffPicker staffList={staff} value={form.staff_id} onChange={handleStaffChange} disabled={!canEdit} />
              </div>

              {/* Branch */}
              <div>
                {lbl("Branch Serviced", true)}
                <select
                  className={fldCls}
                  value={form.branch_id}
                  disabled={!canEdit}
                  onChange={e => set("branch_id", e.target.value)}
                >
                  <option value="">Select Branch…</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name} · {b.note}</option>)}
                </select>
              </div>

              {!isAbsence && (
                <>
                  {/* Customer */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    {lbl("Customer Name", customerRequired)}
                    <div className="sch-input-icon-wrap">
                      <span className="icon">🏢</span>
                      <input
                        className={inpCls}
                        placeholder="e.g. National Bookstore / SM Store"
                        value={form.customer}
                        disabled={!canEdit}
                        onChange={e => set("customer", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    {lbl("Location / Department")}
                    <div className="sch-input-icon-wrap">
                      <span className="icon">📍</span>
                      <input
                        className={inpCls}
                        placeholder="e.g. 2F, Near Admin Office"
                        value={(form as any).location ?? ""}
                        disabled={!canEdit}
                        onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Machine + Serial */}
                  <div>
                    {lbl("Machine Model")}
                    <div className="sch-input-icon-wrap">
                      <span className="icon">🖨️</span>
                      <input
                        className={inpCls}
                        placeholder="e.g. Epson L3210"
                        value={(form as any).machine ?? ""}
                        disabled={!canEdit}
                        onChange={e => setForm(f => ({ ...f, machine: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    {lbl("Serial Number")}
                    <div className="sch-input-icon-wrap">
                      <span className="icon">🔢</span>
                      <input
                        className={inpCls}
                        placeholder="e.g. X4Y123456"
                        value={(form as any).serial_no ?? ""}
                        disabled={!canEdit}
                        onChange={e => setForm(f => ({ ...f, serial_no: e.target.value }))}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Job Type */}
              <div style={{ gridColumn: "1 / -1" }}>
                {lbl("Job Type", true)}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <TypeBtn t="installation" icon="🛠️" label="Installation" />
                  <TypeBtn t="onsite"       icon="🚗" label="Onsite" />
                  <TypeBtn t="hotline"      icon="📞" label="Hotline" />
                  <TypeBtn t="others"       icon="⚙️" label="Others" />
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <TypeBtn t="leave"  icon="🌴" label="On Leave" />
                    <TypeBtn t="absent" icon="🚫" label="Mark Absent" />
                  </div>
                )}
              </div>

              {/* Others description */}
              {form.type === "others" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  {lbl("Describe Service", true)}
                  <input
                    className={inpCls}
                    placeholder="e.g. Preventive maintenance, network config…"
                    value={form.type_other}
                    disabled={!canEdit}
                    onChange={e => set("type_other", e.target.value)}
                  />
                </div>
              )}

              {/* Status */}
              {!isAbsence && (
                <div style={{ gridColumn: "1 / -1" }}>
                  {lbl("Status")}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <StatusBtn s="pending" icon="⏳" label="Pending" />
                    <StatusBtn s="ongoing" icon="◐"  label="Ongoing" />
                    <StatusBtn s="success" icon="✓"  label="Successful" />
                    <StatusBtn s="fail"    icon="✕"  label="Not successful" />
                    <StatusBtn s="cancel"  icon="🚫" label="Cancelled" />
                  </div>
                </div>
              )}

              {/* Status note */}
              {!isAbsence && showStatusNote && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className={`sch-status-note ${statusNoteClass}`}>
                    {lbl(`${statusNoteLabel}`, true)}
                    <input
                      className={inpCls}
                      placeholder={statusNotePlaceholder}
                      value={form.status_note}
                      disabled={!canEdit}
                      autoFocus
                      onChange={e => set("status_note", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {err && (
              <div className="sch-modal-err">
                <span>⚠️</span><span>{err}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 22px", borderTop: "1px solid var(--sch-border)", display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center", background: "var(--sch-s2)" }}>
            {isEdit && canEdit && form.id && (
              <button
                type="button"
                className="sch-btn"
                style={{ marginRight: "auto", color: "#ef4444", borderColor: "rgba(239,68,68,.3)", background: "color-mix(in srgb,#ef4444 8%,var(--sch-s1))" }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
                Delete Ticket
              </button>
            )}
            <button type="button" className="sch-btn" onClick={onClose}>Cancel</button>
            {canEdit && (
              <button
                type="button"
                className="sch-btn primary"
                onClick={handleSave}
              >
                {isEdit ? "Save Changes" : "Add Ticket"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDelete
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            if (form.id && onDelete) {
              onDelete(form.id);
              setShowDeleteConfirm(false);
              onClose();
            }
          }}
          busy={false}
        />
      )}
    </>
  );
}

// ── Color maps ────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  installation: "#4f46e5",
  onsite:       "#2563eb",
  hotline:      "#ea580c",
  others:       "#475569",
  leave:        "#d97706",
  absent:       "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#64748b",
  ongoing: "#2563eb",
  success: "#10b981",
  fail:    "#ef4444",
  cancel:  "#94a3b8",
};

"use client";

import type { Job, Staff, Branch } from "../types";
import { TYPES, STATUS } from "../constants";
import { ymd, fmtD } from "../dates";

export type DrillKind =
  | "job-today"
  | "success"
  | "open"
  | "avail-today"
  | "staff";

interface Props {
  kind: DrillKind;
  currentMonth: Date;
  reportMonth: Date;
  view: string;
  filters: { branch: string; emp: string; type: string; status: string } | null;
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
  onClose: () => void;
}

const TITLES: Record<DrillKind, string> = {
  "job-today":  "Ongoing Today",
  "success":    "Successful this month",
  "open":       "Not yet successful this month",
  "avail-today":"Available Today",
  "staff":      "Total Field Staff",
};

export function KpiDrillModal({
  kind, currentMonth, reportMonth, view, filters,
  jobs, staff, branches, onClose,
}: Props) {
  const today    = ymd(new Date());
  const m        = view === "reports" ? reportMonth : currentMonth;
  const isAbsence = (j: Job) => j.type === "leave" || j.type === "absent";

  function matchesFilter(j: Job) {
    if (!filters) return true;
    if (filters.branch && j.branch_id !== filters.branch) return false;
    if (filters.emp    && j.staff_id  !== filters.emp)    return false;
    if (filters.type   && j.type      !== filters.type)   return false;
    if (filters.status && j.status    !== filters.status) return false;
    return true;
  }

  const monthJobs = jobs.filter(j => {
    if (isAbsence(j))        return false;
    if (!matchesFilter(j))   return false;
    const d = new Date(j.date + "T00:00:00");
    return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
  });

  const todayJobs = jobs.filter(j => {
    if (isAbsence(j))      return false;
    if (!matchesFilter(j)) return false;
    return j.date === today;
  });

  const fieldRoles = ["senior", "junior", "trainee"];
  const fieldStaff = staff.filter(s => fieldRoles.includes(s.role));
  const busyToday  = new Set(jobs.filter(j => j.date === today).map(j => j.staff_id));
  const availToday = fieldStaff.filter(s => !busyToday.has(s.id));

  const staffById  = (id: string) => staff.find(s => s.id === id);
  const branchById = (id: string) => branches.find(b => b.id === b.id);
  const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";

  // Build rows based on kind
  let rows: Job[] = [];
  let showStaffList = false;
  let staffList: Staff[] = [];

  if (kind === "job-today")  rows = todayJobs;
  if (kind === "success")    rows = monthJobs.filter(j => j.status === "success");
  if (kind === "open")       rows = monthJobs.filter(j => j.status !== "success");
  if (kind === "avail-today") { showStaffList = true; staffList = availToday; }
  if (kind === "staff")       { showStaffList = true; staffList = fieldStaff; }

  const thCls = "text-[11px] font-bold text-slate-500 uppercase tracking-wide px-3 py-2 bg-slate-50 border-b border-slate-200 text-left whitespace-nowrap";
  const tdCls = "px-3 py-2.5 border-b border-slate-100 text-[12.5px] whitespace-nowrap";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[60] p-5"
      style={{ background: "rgba(15,23,42,.65)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--sch-s1)",
          border: "1px solid var(--sch-border)",
          borderRadius: 18,
          width: "min(720px,96vw)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px -12px rgba(15,23,42,.28)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 22px",
          borderBottom: "1px solid var(--sch-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--sch-s1)",
          borderRadius: "18px 18px 0 0",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sch-ink1)" }}>
              {TITLES[kind]}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--sch-muted)" }}>
              {kind === "job-today" || kind === "avail-today"
                ? fmtD(new Date())
                : `${m.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
              {showStaffList ? ` · ${staffList.length} people` : ` · ${rows.length} ticket${rows.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: 18, color: "var(--sch-muted)", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6 }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {showStaffList ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th className={thCls}>Name</th>
                  <th className={thCls}>Role</th>
                  <th className={thCls}>Branch</th>
                  {kind === "avail-today" && <th className={thCls}>Status</th>}
                </tr>
              </thead>
              <tbody>
                {staffList.length === 0 && (
                  <tr><td colSpan={4} className="sch-empty py-10">No data.</td></tr>
                )}
                {staffList.map(s => (
                  <tr key={s.id} style={{ transition: "background .1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--sch-s2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td className={tdCls} style={{ fontWeight: 650 }}>{s.name}</td>
                    <td className={tdCls} style={{ color: "var(--sch-muted)" }}>{s.role}</td>
                    <td className={tdCls}>{branchName(s.home_branch_id)}</td>
                    {kind === "avail-today" && (
                      <td className={tdCls}>
                        <span className="sch-badge free">Available</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Netsuite #</th>
                  <th className={thCls}>Employee</th>
                  <th className={thCls}>Branch</th>
                  <th className={thCls}>Customer</th>
                  <th className={thCls}>Type</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="sch-empty py-10">No tickets.</td></tr>
                )}
                {rows.map(j => {
                  const s = staffById(j.staff_id);
                  return (
                    <tr key={j.id}
                      style={{ transition: "background .1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--sch-s2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>
                      <td className={tdCls} style={{ color: "var(--sch-muted)" }}>{j.date}</td>
                      <td className={tdCls} style={{ fontWeight: 700 }}>{j.jt_no ?? "—"}</td>
                      <td className={tdCls}>{s?.name ?? "—"}</td>
                      <td className={tdCls}>{branchName(j.branch_id)}</td>
                      <td className={tdCls} style={{ color: "var(--sch-ink2)" }}>{j.customer ?? "—"}</td>
                      <td className={tdCls}>
                        <span className={`sch-type-tag ${TYPES[j.type]?.cls ?? ""}`}>
                          {TYPES[j.type]?.label ?? j.type}
                        </span>
                      </td>
                      <td className={tdCls}>
                        {j.type !== "leave" && j.type !== "absent" && (
                          <span className={`sch-pill ${STATUS[j.status]?.cls ?? ""}`}>
                            {STATUS[j.status]?.label ?? j.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 22px", borderTop: "1px solid var(--sch-border)", background: "var(--sch-s2)", borderRadius: "0 0 18px 18px", display: "flex", justifyContent: "flex-end" }}>
          <button className="sch-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

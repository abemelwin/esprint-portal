"use client";

import { useState } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { ymd, fmtD, monthName } from "../lib/dates";
import { TYPES, TYPE_KEYS, ROLES, ROLE_ORDER, STATUS, isAdminOrCoordinator } from "../lib/constants";

interface KpiDrillModalProps {
  kind: string;
  currentMonth: Date;
  reportMonth: Date;
  view: string;
  filters: Record<string, string> | null;
  onClose: () => void;
}

function AvailableNamesDropdown({ staffList }: { staffList: { id: string; name: string; hotline?: boolean }[] }) {
  const [selected, setSelected] = useState("");
  if (!staffList?.length) return <span style={{ color: "var(--sched-muted)", fontStyle: "italic" }}>— none —</span>;
  return (
    <div style={{ minWidth: 220, maxWidth: 300, display: "flex", alignItems: "center", gap: 6 }}>
      <select className="sched-sel" value={selected} onChange={(e) => setSelected(e.target.value)}
        style={{ width: "100%", fontSize: 12, padding: "4px 8px" }}>
        <option value="">👥 {staffList.length} Available Staff (Click to view)</option>
        {staffList.map((s, i) => (
          <option key={s.id || i} value={s.id || s.name}>{i + 1}. {s.name}{s.hotline ? " ☎ Hotline" : ""}</option>
        ))}
      </select>
      {selected && <button type="button" className="sched-btn sched-btn-ghost sched-btn-sm" onClick={() => setSelected("")}>✕</button>}
    </div>
  );
}

export default function KpiDrillModal({ kind, currentMonth, reportMonth, view, filters, onClose }: KpiDrillModalProps) {
  const { jobs, staff, appUsers, branches, inScope, scopedBranches, isAdmin, scopedBranchIds } = useScheduler();
  const m       = view === "reports" ? reportMonth : currentMonth;
  const todayKey = ymd(new Date());
  const todayLbl = fmtD(new Date());

  const branchList = scopedBranches().filter((b) => {
    if (filters?.branch) return b.id === filters.branch;
    return true;
  });

  const isAbsence = (j: { type: string }) => j.type === "leave" || j.type === "absent";

  function matchesFilter(j: { branch_id: string; staff_id: string; type: string; status: string }) {
    if (!filters) return true;
    if (filters.branch && j.branch_id !== filters.branch) return false;
    if (filters.emp    && j.staff_id  !== filters.emp)    return false;
    if (filters.type   && j.type      !== filters.type)   return false;
    if (filters.status && j.status    !== filters.status) return false;
    return true;
  }

  const staffById  = (id: string) => staff.find((s) => s.id === id);
  const branchById = (id: string) => branches.find((b) => b.id === id);

  const activeStaffList = (staff || []).filter((s) => {
    if (isAdminOrCoordinator(s, appUsers)) return false;
    if (filters?.emp && s.id !== filters.emp) return false;
    return true;
  });

  function getBranchHomedStaff(branchId: string) {
    return activeStaffList.filter((s) => {
      if (!scopedBranchIds) return s.home_branch_id === branchId;
      return s.home_branch_id === branchId && scopedBranchIds.includes(s.home_branch_id);
    });
  }

  function monthJobs() {
    return jobs.filter((j) => {
      if (!inScope(j) || isAbsence(j) || !matchesFilter(j)) return false;
      const d = new Date(j.date + "T00:00:00");
      return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
    });
  }

  let title = "", sub = "", content: React.ReactNode = null;

  if (kind === "job-today") {
    const todayJobs = jobs.filter((j) => inScope(j) && !isAbsence(j) && j.date === todayKey && matchesFilter(j));
    title = "Ongoing Today — per Branch";
    sub   = `${todayLbl} · ${todayJobs.length} job ticket(s)`;
    const tot: Record<string, number> = {}; TYPE_KEYS.forEach((k) => { tot[k] = 0; });
    const rows = branchList.map((b) => {
      const bj = todayJobs.filter((j) => j.branch_id === b.id); if (!bj.length) return null;
      const c: Record<string, number> = {}; TYPE_KEYS.forEach((k) => { c[k] = bj.filter((j) => j.type === k).length; tot[k] += c[k]; });
      return { b, bj, c };
    }).filter(Boolean) as { b: any; bj: any[]; c: Record<string, number> }[];

    content = (
      <table className="sched-rt">
        <thead><tr><th style={{ minWidth: 170 }}>Branch</th>{TYPE_KEYS.map((k) => <th key={k} className="num">{TYPES[k].label}</th>)}<th className="num">Total</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={TYPE_KEYS.length + 2} className="sched-empty-note">No tickets today.</td></tr>}
          {rows.map(({ b, bj, c }) => (
            <tr key={b.id}>
              <td><b>{b.name}</b> <span style={{ color: "var(--sched-muted)", fontSize: 11.5 }}>· {b.note}</span></td>
              {TYPE_KEYS.map((k) => <td key={k} className="num">{c[k] > 0 ? <b>{c[k]}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>)}
              <td className="num"><b style={{ color: "var(--sched-senior)" }}>{bj.length}</b></td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="sched-tot">
              <td><b>ALL BRANCHES</b></td>
              {TYPE_KEYS.map((k) => <td key={k} className="num">{tot[k] > 0 ? <b>{tot[k]}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>)}
              <td className="num"><b>{todayJobs.length}</b></td>
            </tr>
          )}
        </tbody>
      </table>
    );
  } else if (kind === "avail-today") {
    const assigned = new Set(jobs.filter((j) => inScope(j) && j.date === todayKey && (filters?.branch ? j.branch_id === filters.branch : true)).map((j) => j.staff_id));
    let freeCount = 0;
    const rows = branchList.map((b) => {
      const homed = getBranchHomedStaff(b.id); if (!homed.length) return null;
      const free  = homed.filter((s) => !assigned.has(s.id)); freeCount += free.length;
      return { b, homed, free };
    }).filter(Boolean) as any[];
    title = "Available Today — per Branch";
    sub   = `${todayLbl} · ${freeCount} staff with no task today`;
    content = (
      <table className="sched-rt">
        <thead><tr><th style={{ minWidth: 170 }}>Branch</th><th className="num">Free</th><th className="num">Assigned</th><th className="num">Staff</th><th>Available names</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="sched-empty-note">No staff yet.</td></tr>}
          {rows.map(({ b, homed, free }) => (
            <tr key={b.id}>
              <td><b>{b.name}</b> <span style={{ color: "var(--sched-muted)", fontSize: 11.5 }}>· {b.note}</span></td>
              <td className="num"><b style={{ color: free.length > 0 ? "#059669" : "var(--sched-muted)" }}>{free.length}</b></td>
              <td className="num">{homed.length - free.length}</td>
              <td className="num"><b>{homed.length}</b></td>
              <td><AvailableNamesDropdown staffList={free} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (kind === "staff") {
    const activeRoles = ["manager","bsm","senior","junior","trainee"];
    const tot: Record<string, number> = {}; activeRoles.forEach((r) => { tot[r] = 0; }); let totH = 0, totAll = 0;
    const rows = branchList.map((b) => {
      const homed = getBranchHomedStaff(b.id); if (!homed.length) return null;
      const c: Record<string, number> = {}; activeRoles.forEach((r) => { c[r] = homed.filter((s) => s.role === r).length; tot[r] += c[r]; });
      const h = homed.filter((s) => s.hotline).length; totH += h; totAll += homed.length;
      return { b, homed, c, h };
    }).filter(Boolean) as any[];
    title = "Total Staff — per Branch";
    sub   = `${totAll} staff across ${branchList.length} branch(es)`;
    content = (
      <table className="sched-rt">
        <thead><tr><th style={{ minWidth: 170 }}>Branch</th>{activeRoles.map((r) => <th key={r} className="num" title={ROLES[r].label}>{ROLES[r].short}</th>)}<th className="num" title="Hotline">☎</th><th className="num">Total</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={activeRoles.length + 3} className="sched-empty-note">No staff found.</td></tr>}
          {rows.map(({ b, homed, c, h }) => (
            <tr key={b.id}>
              <td><b>{b.name}</b> <span style={{ color: "var(--sched-muted)", fontSize: 11.5 }}>· {b.note}</span></td>
              {activeRoles.map((r) => <td key={r} className="num">{c[r] > 0 ? <b>{c[r]}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>)}
              <td className="num">{h > 0 ? <b style={{ color: "#ec4899" }}>{h}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>
              <td className="num"><b style={{ color: "var(--sched-senior)" }}>{homed.length}</b></td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="sched-tot">
              <td><b>ALL BRANCHES</b></td>
              {activeRoles.map((r) => <td key={r} className="num">{tot[r] > 0 ? <b>{tot[r]}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>)}
              <td className="num">{totH > 0 ? <b style={{ color: "#ec4899" }}>{totH}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>
              <td className="num"><b>{totAll}</b></td>
            </tr>
          )}
        </tbody>
      </table>
    );
  } else {
    const wantOpen = kind === "open";
    const mj       = monthJobs();
    const filtered  = wantOpen ? mj.filter((j) => j.status !== "success") : mj.filter((j) => j.status === "success");
    title = (wantOpen ? "Not Yet Successful" : "Successful") + " — per Branch";
    sub   = `${monthName(m)} · ${filtered.length} job ticket(s)`;
    if (wantOpen) {
      let tp = 0, to = 0, tf = 0;
      const rows = branchList.map((b) => {
        const bj = filtered.filter((j) => j.branch_id === b.id); if (!bj.length) return null;
        const p = bj.filter((j) => j.status === "pending").length;
        const o = bj.filter((j) => j.status === "ongoing").length;
        const f = bj.filter((j) => j.status === "fail").length;
        tp += p; to += o; tf += f;
        return { b, bj, p, o, f };
      }).filter(Boolean) as any[];
      content = (
        <table className="sched-rt">
          <thead><tr><th style={{ minWidth: 170 }}>Branch</th><th className="num">Pending</th><th className="num">Ongoing</th><th className="num">Not successful</th><th className="num">Total</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="sched-empty-note">Nothing open. 🎉</td></tr>}
            {rows.map(({ b, bj, p, o, f }) => (
              <tr key={b.id}>
                <td><b>{b.name}</b> <span style={{ color: "var(--sched-muted)", fontSize: 11.5 }}>· {b.note}</span></td>
                <td className="num">{p > 0 ? <b>{p}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                <td className="num">{o > 0 ? <b style={{ color: "var(--sched-st-ongoing)" }}>{o}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                <td className="num">{f > 0 ? <b style={{ color: "var(--sched-st-fail)" }}>{f}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>
                <td className="num"><b>{bj.length}</b></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="sched-tot">
                <td><b>ALL BRANCHES</b></td>
                <td className="num">{tp > 0 ? <b>{tp}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>
                <td className="num">{to > 0 ? <b style={{ color: "var(--sched-st-ongoing)" }}>{to}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>
                <td className="num">{tf > 0 ? <b style={{ color: "var(--sched-st-fail)" }}>{tf}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>
                <td className="num"><b>{filtered.length}</b></td>
              </tr>
            )}
          </tbody>
        </table>
      );
    } else {
      const tt: Record<string, number> = {}; TYPE_KEYS.forEach((k) => { tt[k] = 0; });
      const rows = branchList.map((b) => {
        const bj = filtered.filter((j) => j.branch_id === b.id); if (!bj.length) return null;
        const c: Record<string, number> = {}; TYPE_KEYS.forEach((k) => { c[k] = bj.filter((j) => j.type === k).length; tt[k] += c[k]; });
        return { b, bj, c };
      }).filter(Boolean) as any[];
      content = (
        <table className="sched-rt">
          <thead><tr><th style={{ minWidth: 170 }}>Branch</th>{TYPE_KEYS.map((k) => <th key={k} className="num">{TYPES[k].label}</th>)}<th className="num">Total</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={TYPE_KEYS.length + 2} className="sched-empty-note">No successful tickets yet.</td></tr>}
            {rows.map(({ b, bj, c }) => (
              <tr key={b.id}>
                <td><b>{b.name}</b> <span style={{ color: "var(--sched-muted)", fontSize: 11.5 }}>· {b.note}</span></td>
                {TYPE_KEYS.map((k) => <td key={k} className="num">{c[k] > 0 ? <b>{c[k]}</b> : <span style={{ opacity: 0.35 }}>—</span>}</td>)}
                <td className="num"><b style={{ color: "#059669" }}>{bj.length}</b></td>
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="sched-tot">
                <td><b>ALL BRANCHES</b></td>
                {TYPE_KEYS.map((k) => <td key={k} className="num">{tt[k] > 0 ? <b>{tt[k]}</b> : <span style={{ opacity: 0.4 }}>—</span>}</td>)}
                <td className="num"><b>{filtered.length}</b></td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }
  }

  return (
    <div className="sched-modal-bg">
      <div className="sched-modal" style={{ width: "min(860px, 96vw)" }}>
        <div className="sched-modal-head">
          <h3>{title}</h3><div className="sched-spacer" />
        </div>
        <div className="sched-modal-body" style={{ padding: "16px 20px 20px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--sched-muted)" }}>{sub}</p>
          <div className="sched-rtable-wrap">{content}</div>
        </div>
        <div className="sched-modal-foot">
          <button className="sched-btn sched-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

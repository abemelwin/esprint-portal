"use client";

import { useMemo } from "react";
import type { Job, Staff, Branch, SchedulerFilters } from "../types";
import { monthName, mondayOf, ymd, weekStartLabel } from "../dates";
import { TYPES, TYPE_KEYS, STATUS } from "../constants";

interface Props {
  reportMonth: Date;
  setReportMonth: (fn: (m: Date) => Date) => void;
  rFilters: Pick<SchedulerFilters, "branch" | "emp">;
  setRFilters: (fn: (f: Pick<SchedulerFilters, "branch" | "emp">) => Pick<SchedulerFilters, "branch" | "emp">) => void;
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
}

export function ReportsView({ reportMonth, setReportMonth, rFilters, setRFilters, jobs, staff, branches }: Props) {
  function prevMonth() { setReportMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setReportMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday()   { setReportMonth(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }); }

  const staffById  = (id: string) => staff.find(s => s.id === id);
  const branchById = (id: string) => branches.find(b => b.id === id);

  const monthJobs = useMemo(() => jobs.filter(j => {
    if (rFilters.branch && j.branch_id !== rFilters.branch) return false;
    if (rFilters.emp    && j.staff_id  !== rFilters.emp)    return false;
    const d = new Date(j.date + "T00:00:00");
    return d.getMonth() === reportMonth.getMonth() && d.getFullYear() === reportMonth.getFullYear();
  }), [jobs, reportMonth, rFilters]);

  // Report 1: per employee / week / type
  type R1Row = { sid: string; wStart: string; total: number; [key: string]: string | number };
  const r1Rows = useMemo<R1Row[]>(() => {
    const rows: R1Row[] = [];
    const empIds = [...new Set(monthJobs.map(j => j.staff_id))];
    for (const sid of empIds) {
      const empJobs = monthJobs.filter(j => j.staff_id === sid);
      const weeks   = [...new Set(empJobs.map(j => ymd(mondayOf(new Date(j.date + "T00:00:00")))))].sort();
      for (const wStart of weeks) {
        const wJobs = empJobs.filter(j => ymd(mondayOf(new Date(j.date + "T00:00:00"))) === wStart);
        const row: R1Row = { sid, wStart, total: wJobs.length };
        TYPE_KEYS.forEach(t => { row[t] = wJobs.filter(j => j.type === t).length; });
        rows.push(row);
      }
    }
    return rows;
  }, [monthJobs]);

  // Report 2: not successful / open
  const r2Rows = useMemo(() =>
    jobs.filter(j => j.status === "pending" || j.status === "fail")
        .sort((a, b) => a.date.localeCompare(b.date))
  , [jobs]);

  function dlCSV(rows: (string | number)[][], filename: string) {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = filename;
    a.click();
  }

  function csvR1() {
    const header = ["Employee", "Week of", ...TYPE_KEYS.map(t => TYPES[t].label), "Total"];
    const rows   = r1Rows.map(r => [staffById(r.sid)?.name ?? r.sid, r.wStart, ...TYPE_KEYS.map(t => r[t]), r.total]);
    dlCSV([header, ...rows], `report1-${monthName(reportMonth).replace(" ", "_")}.csv`);
  }

  function csvR2() {
    const header = ["Date", "Netsuite#", "Employee", "Branch", "Customer", "Type", "Status", "Note"];
    const rows   = r2Rows.map(j => [
      j.date, j.jt_no ?? "", staffById(j.staff_id)?.name ?? "—",
      branchById(j.branch_id)?.name ?? "—", j.customer ?? "",
      j.type, j.status, j.status_note ?? "",
    ]);
    dlCSV([header, ...rows], "report2-open-tickets.csv");
  }

  const hasFilter = !!(rFilters.branch || rFilters.emp);
  const filteredStaff = staff.filter(s => !rFilters.branch || s.home_branch_id === rFilters.branch);

  return (
    <div>
      {/* Toolbar */}
      <div className="sch-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="sch-month-nav">
            <button className="sch-btn sm" onClick={prevMonth}>◀</button>
            <div className="sch-month-label">{monthName(reportMonth)}</div>
            <button className="sch-btn sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sch-btn sm" onClick={goToday}>Today</button>
        </div>
        <div className="sch-sep" />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="sch-fl">
            <label>Branch</label>
            <select className="sch-sel" value={rFilters.branch}
              onChange={e => setRFilters(f => ({ ...f, branch: e.target.value }))}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="sch-fl">
            <label>Employee</label>
            <select className="sch-sel" value={rFilters.emp}
              onChange={e => setRFilters(f => ({ ...f, emp: e.target.value }))}>
              <option value="">All Staff</option>
              {filteredStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {hasFilter && (
            <button className="sch-btn sm ghost"
              onClick={() => setRFilters(() => ({ branch: "", emp: "" }))}
              style={{ color: "#ef4444", borderColor: "#fca5a5", borderStyle: "dashed" }}>
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      {/* Report 1 */}
      <div className="sch-report">
        <div className="sch-rhead">
          <div>
            <h2>1 · Service Summary — per Employee / Week / Type</h2>
            <p>{monthName(reportMonth)} · {monthJobs.length} job ticket(s)</p>
          </div>
          <div style={{ flex: 1 }} />
          <button className="sch-btn sm" onClick={csvR1}>⤒ CSV</button>
        </div>
        <div className="sch-rtable-wrap">
          <table className="sch-rt">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week</th>
                {TYPE_KEYS.map(t => <th key={t} className="num">{TYPES[t].label}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {r1Rows.length === 0 && (
                <tr><td colSpan={TYPE_KEYS.length + 3} className="sch-empty">No job tickets this month.</td></tr>
              )}
              {r1Rows.map((r, i) => (
                <tr key={i}>
                  <td>{staffById(r.sid)?.name ?? r.sid}</td>
                  <td>{weekStartLabel(r.wStart)}</td>
                  {TYPE_KEYS.map(t => <td key={t} className="num">{r[t] || ""}</td>)}
                  <td className="num"><b>{r.total}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report 2 */}
      <div className="sch-report">
        <div className="sch-rhead">
          <div>
            <h2>2 · Service Not Yet Successful</h2>
            <p>All open job tickets (Pending or Not Successful) — follow-up backlog across all dates.</p>
          </div>
          <div style={{ flex: 1 }} />
          <button className="sch-btn sm" onClick={csvR2}>⤒ CSV</button>
        </div>
        <div className="sch-rtable-wrap">
          <table className="sch-rt">
            <thead>
              <tr>
                <th>Date</th><th>Netsuite#</th><th>Employee</th><th>Branch</th>
                <th>Customer</th><th>Type</th><th>Status</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {r2Rows.length === 0 && (
                <tr><td colSpan={8} className="sch-empty">No open tickets. 🎉</td></tr>
              )}
              {r2Rows.map(j => (
                <tr key={j.id}>
                  <td>{j.date}</td>
                  <td><b>{j.jt_no ?? "—"}</b></td>
                  <td>{staffById(j.staff_id)?.name ?? "—"}</td>
                  <td>{branchById(j.branch_id)?.name ?? "—"}</td>
                  <td>{j.customer ?? ""}</td>
                  <td><span className={`sch-type-tag ${TYPES[j.type]?.cls ?? ""}`}>{TYPES[j.type]?.label ?? j.type}</span></td>
                  <td>{j.type !== "leave" && j.type !== "absent" && <span className={`sch-pill ${STATUS[j.status]?.cls ?? ""}`}>{STATUS[j.status]?.label ?? j.status}</span>}</td>
                  <td style={{ color: "var(--sch-muted)" }}>{j.status_note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

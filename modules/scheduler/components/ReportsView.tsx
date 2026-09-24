"use client";

import { useMemo } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { monthName, weekNumber, mondayOf, addDays, ymd } from "../lib/dates";
import { TYPES, TYPE_KEYS, STATUS, isAdminOrCoordinator } from "../lib/constants";

interface RFilters { branch: string; emp: string }
interface ReportsViewProps {
  reportMonth: Date;
  setReportMonth: React.Dispatch<React.SetStateAction<Date>>;
  rFilters: RFilters;
  setRFilters: React.Dispatch<React.SetStateAction<RFilters>>;
}

export default function ReportsView({ reportMonth, setReportMonth, rFilters, setRFilters }: ReportsViewProps) {
  const { jobs, staff, appUsers, branches, inScope } = useScheduler();

  function prevMonth() { setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setReportMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday()   { setReportMonth(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); }); }

  const staffById  = (id: string) => staff.find((s) => s.id === id);
  const branchById = (id: string) => branches.find((b) => b.id === id);

  const visibleStaffList = useMemo(() => (staff || []).filter((s) => {
    if (isAdminOrCoordinator(s, appUsers)) return false;
    if (rFilters.branch && s.home_branch_id !== rFilters.branch) return false;
    return true;
  }), [staff, appUsers, rFilters.branch]);

  const monthJobs = useMemo(() => jobs.filter((j) => {
    if (!inScope(j)) return false;
    if (rFilters.branch && j.branch_id !== rFilters.branch) return false;
    if (rFilters.emp    && j.staff_id  !== rFilters.emp)    return false;
    const d = new Date(j.date + "T00:00:00");
    return d.getMonth() === reportMonth.getMonth() && d.getFullYear() === reportMonth.getFullYear();
  }), [jobs, reportMonth, rFilters]);

  // Report 1: per employee / week / type
  const r1Rows = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    const empIds = [...new Set(monthJobs.map((j) => j.staff_id))];
    empIds.forEach((sid) => {
      const empJobs = monthJobs.filter((j) => j.staff_id === sid);
      const weeks   = [...new Set(empJobs.map((j) => ymd(mondayOf(new Date(j.date + "T00:00:00")))))].sort();
      weeks.forEach((wStart) => {
        const wJobs = empJobs.filter((j) => ymd(mondayOf(new Date(j.date + "T00:00:00"))) === wStart);
        const row: Record<string, unknown> = { sid, wStart, total: wJobs.length };
        TYPE_KEYS.forEach((t) => { (row as any)[t] = wJobs.filter((j) => j.type === t).length; });
        rows.push(row);
      });
    });
    return rows;
  }, [monthJobs]);

  // Report 2: not successful
  const r2Rows = useMemo(() =>
    jobs.filter((j) => inScope(j) && (j.status === "pending" || j.status === "fail"))
        .sort((a, b) => a.date.localeCompare(b.date)),
  [jobs]);

  function dl(rows: unknown[][], filename: string) {
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a   = document.createElement("a");
    a.href    = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = filename; a.click();
  }

  function csvR1() {
    const header = ["Employee", "Week of", ...TYPE_KEYS.map((t) => TYPES[t].label), "Total"];
    const rows   = r1Rows.map((r) => {
      const s = staffById(r.sid as string);
      return [s?.name || r.sid, r.wStart, ...TYPE_KEYS.map((t) => (r as any)[t]), r.total];
    });
    dl([header, ...rows] as unknown[][], `report1-${monthName(reportMonth).replace(" ", "_")}.csv`);
  }

  function csvR2() {
    const header = ["Date","Netsuite#","Employee","Branch","Customer","Type","Status","Note"];
    const rows   = r2Rows.map((j) => {
      const s = staffById(j.staff_id); const b = branchById(j.branch_id);
      return [j.date, j.jt_no, s?.name || "—", b?.name || "—", j.customer, j.type, j.status, j.status_note || ""];
    });
    dl([header, ...rows] as unknown[][], "report2-open-tickets.csv");
  }

  const wFmt = (s: string) => { const d = new Date(s + "T00:00:00"); return `Wk of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`; };

  return (
    <div>
      <div className="sched-toolbar">
        <div className="sched-toolbar-nav">
          <div className="sched-month-nav">
            <button className="sched-btn sched-btn-sm" onClick={prevMonth}>◀</button>
            <div className="sched-month-label">{monthName(reportMonth)}</div>
            <button className="sched-btn sched-btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sched-btn sched-btn-sm sched-today-btn" onClick={goToday}>Today</button>
        </div>
        <div className="sched-sep" />
        <div className="sched-filters">
          <div className="sched-fl">
            <label>Branch</label>
            <select className="sched-sel" value={rFilters.branch}
              onChange={(e) => setRFilters((f) => ({ ...f, branch: e.target.value }))}>
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="sched-fl">
            <label>Employee</label>
            <select className="sched-sel" value={rFilters.emp}
              onChange={(e) => setRFilters((f) => ({ ...f, emp: e.target.value }))}>
              <option value="">All Staff</option>
              {visibleStaffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {(rFilters.branch || rFilters.emp) && (
            <button className="sched-btn sched-btn-sm sched-btn-ghost"
              onClick={() => setRFilters({ branch: "", emp: "" })}>✕ Reset</button>
          )}
        </div>
      </div>

      {/* Report 1 */}
      <div className="sched-report">
        <div className="sched-rhead">
          <div>
            <h2>1 · Service Summary — per Employee / Week / Type</h2>
            <p>{monthName(reportMonth)} · {monthJobs.length} job ticket(s)</p>
          </div>
          <div className="sched-spacer" />
          <button className="sched-btn sched-btn-sm" onClick={csvR1}>⤒ CSV</button>
        </div>
        <div className="sched-rtable-wrap">
          <table className="sched-rt">
            <thead>
              <tr>
                <th>Employee</th><th>Week</th>
                {TYPE_KEYS.map((t) => <th key={t} className="num">{TYPES[t].label}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {r1Rows.length === 0 && <tr><td colSpan={TYPE_KEYS.length + 3} className="sched-empty-note">No job tickets this month.</td></tr>}
              {r1Rows.map((r, i) => {
                const s = staffById(r.sid as string);
                return (
                  <tr key={i}>
                    <td>{s?.name || (r.sid as string)}</td>
                    <td>{wFmt(r.wStart as string)}</td>
                    {TYPE_KEYS.map((t) => <td key={t} className="num">{(r as any)[t] || ""}</td>)}
                    <td className="num"><b>{r.total as number}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report 2 */}
      <div className="sched-report">
        <div className="sched-rhead">
          <div>
            <h2>2 · Service Not Yet Successful</h2>
            <p>All open job tickets (Pending or Not Successful) — follow-up backlog across all dates.</p>
          </div>
          <div className="sched-spacer" />
          <button className="sched-btn sched-btn-sm" onClick={csvR2}>⤒ CSV</button>
        </div>
        <div className="sched-rtable-wrap">
          <table className="sched-rt">
            <thead>
              <tr>
                <th>Date</th><th>Netsuite#</th><th>Employee</th><th>Branch</th>
                <th>Customer</th><th>Type</th><th>Status</th><th>Note</th>
              </tr>
            </thead>
            <tbody>
              {r2Rows.length === 0 && <tr><td colSpan={8} className="sched-empty-note">No open tickets. 🎉</td></tr>}
              {r2Rows.map((j) => {
                const s = staffById(j.staff_id); const b = branchById(j.branch_id);
                return (
                  <tr key={j.id}>
                    <td>{j.date}</td>
                    <td><b>{j.jt_no}</b></td>
                    <td>{s?.name || "—"}</td>
                    <td>{b?.name || "—"}</td>
                    <td>{j.customer}</td>
                    <td><span className={`sched-type-tag sched-${TYPES[j.type]?.cls || ""}`}>{TYPES[j.type]?.label || j.type}</span></td>
                    <td><span className={`sched-pill sched-${STATUS[j.status]?.cls || ""}`}>{STATUS[j.status]?.label || j.status}</span></td>
                    <td style={{ color: "var(--sched-muted)" }}>{j.status_note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

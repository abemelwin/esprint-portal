"use client";

import { useState, useMemo, useRef } from "react";
import type { Job, Staff, Branch, SchedulerFilters } from "../types";
import { ymd, mondayOf, addDays, sameYMD, monthName } from "../dates";
import { TYPES, STATUS, DOW } from "../constants";
import { AvailabilityPanel } from "./AvailabilityPanel";

// ── Floating Date Picker (mirrors DatePickerPopup.jsx from original) ──────────
const DCP_DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DatePickerPopup({ value, onChange }: {
  value: string; onChange: (d: string) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [pickYear, setPickYear] = useState<number | null>(null);
  const [pickMon,  setPickMon]  = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const selDate  = value ? new Date(value + "T00:00:00") : new Date();
  const viewYear = pickYear ?? selDate.getFullYear();
  const viewMon  = pickMon  ?? selDate.getMonth();
  const todayStr = ymd(new Date());

  function prevMon() {
    if (viewMon === 0) { setPickYear(viewYear - 1); setPickMon(11); }
    else               { setPickYear(viewYear);     setPickMon(viewMon - 1); }
  }
  function nextMon() {
    if (viewMon === 11) { setPickYear(viewYear + 1); setPickMon(0); }
    else                { setPickYear(viewYear);     setPickMon(viewMon + 1); }
  }

  const firstDow  = new Date(viewYear, viewMon, 1).getDay();
  const daysInMon = new Date(viewYear, viewMon + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel    = new Date(viewYear, viewMon, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const triggerLabel  = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : "Pick a date";

  return (
    <div className="sch-dcp-wrap" ref={ref}>
      <button type="button" className="sch-dcp-trigger" onClick={() => setOpen(o => !o)}>
        <span>📅</span>
        <span style={{ fontWeight: 650 }}>{triggerLabel}</span>
        <span style={{ fontSize: 9, color: "var(--sch-muted)", marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="sch-dcp-popup">
          <div className="sch-dcp-head">
            <button type="button" className="sch-dcp-nav" onClick={prevMon}>‹</button>
            <span className="sch-dcp-month-label">{monthLabel}</span>
            <button type="button" className="sch-dcp-nav" onClick={nextMon}>›</button>
          </div>
          <div className="sch-dcp-grid">
            {DCP_DOW.map(d => <span key={d} className="sch-dcp-dow">{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const iso   = ymd(new Date(viewYear, viewMon, d));
              const isTod = iso === todayStr;
              const isSel = iso === value;
              return (
                <button
                  key={d} type="button"
                  className={`sch-dcp-day${isTod ? " today" : ""}${isSel ? " selected" : ""}`}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >{d}</button>
              );
            })}
          </div>
          <div className="sch-dcp-footer">
            <button type="button" className="sch-dcp-today-btn" onClick={() => {
              const n = new Date();
              setPickYear(n.getFullYear()); setPickMon(n.getMonth());
              onChange(ymd(n)); setOpen(false);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CalendarView ─────────────────────────────────────────────────────────
interface Props {
  currentMonth: Date;
  setCurrentMonth: (fn: (m: Date) => Date) => void;
  filters: SchedulerFilters;
  setFilters: (fn: (f: SchedulerFilters) => SchedulerFilters) => void;
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
  canEdit: boolean;
  onOpenJob: (payload: { date: string; job?: Job }) => void;
}

export function CalendarView({
  currentMonth, setCurrentMonth, filters, setFilters,
  jobs, staff, branches, canEdit, onOpenJob,
}: Props) {
  const [dayDetail, setDayDetail] = useState<{ dateKey: string; jobs: Job[] } | null>(null);

  // ── Day / Month toggle (default: specific day = today) ─────────
  const [calViewMode, setCalViewMode] = useState<"day" | "month">("day");
  const [specificDay, setSpecificDay] = useState(ymd(new Date()));

  function prevMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday() {
    setCurrentMonth(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
    setSpecificDay(ymd(new Date()));
    setCalViewMode("day");
  }

  // Full Mon-start grid
  const firstMon  = mondayOf(currentMonth);
  const lastOfMon = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const gridEnd   = addDays(mondayOf(lastOfMon), 6);
  const allCells: Date[] = [];
  let cur = new Date(firstMon);
  while (cur <= gridEnd) { allCells.push(new Date(cur)); cur = addDays(cur, 1); }

  // In "day" mode: only the week row containing specificDay
  const visibleCells = useMemo(() => {
    if (calViewMode === "month") return allCells;
    const d         = new Date(specificDay + "T00:00:00");
    const weekStart = mondayOf(d);
    const weekEnd   = addDays(weekStart, 6);
    return allCells.filter(c => c >= weekStart && c <= weekEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calViewMode, specificDay, allCells.length, firstMon.getTime()]);

  const staffById = (id: string) => staff.find(s => s.id === id);

  function filteredJobs(dateKey: string): Job[] {
    return jobs.filter(j => {
      if (j.date !== dateKey) return false;
      if (filters.branch && j.branch_id !== filters.branch) return false;
      if (filters.emp    && j.staff_id  !== filters.emp)    return false;
      if (filters.type   && j.type      !== filters.type)   return false;
      if (filters.status && j.status    !== filters.status) return false;
      return true;
    });
  }

  const hasFilter = !!(filters.branch || filters.emp || filters.type || filters.status);

  return (
    <div>
      {/* Toolbar */}
      <div className="sch-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          <div className="sch-month-nav">
            <button className="sch-btn sm" onClick={prevMonth}>◀</button>
            <div className="sch-month-label">{monthName(currentMonth)}</div>
            <button className="sch-btn sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sch-btn sm" onClick={goToday}>Today</button>

          {/* Day / Month toggle */}
          <div className="sch-seg">
            <button className={calViewMode === "day"   ? "active" : ""} onClick={() => setCalViewMode("day")}>Specific day</button>
            <button className={calViewMode === "month" ? "active" : ""} onClick={() => setCalViewMode("month")}>This month</button>
          </div>

          {calViewMode === "day" && (
            <DatePickerPopup
              value={specificDay}
              onChange={day => {
                setSpecificDay(day);
                const d = new Date(day + "T00:00:00");
                setCurrentMonth(() => new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            />
          )}

          {canEdit && (
            <button className="sch-btn primary sm" onClick={() => onOpenJob({ date: ymd(new Date()) })}>
              + New Ticket
            </button>
          )}
        </div>

        <div className="sch-sep" />

        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1 }}>
          <div className="sch-fl">
            <label>Branch</label>
            <select className="sch-sel" value={filters.branch}
              onChange={e => setFilters(f => ({ ...f, branch: e.target.value, emp: "" }))}>
              <option value="">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="sch-fl">
            <label>Employee</label>
            <select className="sch-sel" value={filters.emp}
              onChange={e => setFilters(f => ({ ...f, emp: e.target.value }))}>
              <option value="">All Staff</option>
              {staff.filter(s => !filters.branch || s.home_branch_id === filters.branch)
                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="sch-fl">
            <label>Type</label>
            <select className="sch-sel" value={filters.type}
              onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All Types</option>
              <option value="installation">Installation</option>
              <option value="onsite">Onsite</option>
              <option value="hotline">Hotline</option>
              <option value="others">Others</option>
            </select>
          </div>
          <div className="sch-fl">
            <label>Status</label>
            <select className="sch-sel" value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="ongoing">Ongoing</option>
              <option value="success">Successful</option>
              <option value="fail">Not successful</option>
              <option value="cancel">Cancelled</option>
            </select>
          </div>
          {hasFilter && (
            <button className="sch-btn sm ghost"
              onClick={() => setFilters(() => ({ branch: "", emp: "", type: "", status: "" }))}
              style={{ color: "#ef4444", borderColor: "#fca5a5", borderStyle: "dashed" }}>
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      <div className="sch-layout">
        {/* Calendar panel */}
        <div className="sch-panel">
          <div className="sch-panel-head">
            <h2>{calViewMode === "day" ? "Daily Schedule" : "Monthly Schedule"}</h2>
            <div style={{ flex: 1 }} />
            <div className="sch-legend">
              <span className="li"><span className="sch-swatch" style={{ background: "var(--sch-t-install)" }} />Installation</span>
              <span className="li"><span className="sch-swatch" style={{ background: "var(--sch-t-onsite)" }} />Onsite</span>
              <span className="li"><span className="sch-swatch" style={{ background: "var(--sch-t-hotline)" }} />Hotline</span>
              <span className="li"><span className="sch-swatch" style={{ background: "var(--sch-t-others)" }} />Others</span>
              <span className="li"><span className="sch-dot" style={{ background: "var(--sch-success)" }} />Done</span>
              <span className="li"><span className="sch-dot" style={{ background: "var(--sch-ongoing)" }} />Ongoing</span>
              <span className="li"><span className="sch-dot" style={{ background: "var(--sch-pending)" }} />Pending</span>
              <span className="li"><span className="sch-dot" style={{ background: "var(--sch-fail)" }} />Failed</span>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="sch-cal">
              {DOW.map(d => <div key={d} className="sch-dow">{d}</div>)}
              {visibleCells.map(cell => {
                const isOther    = cell.getMonth() !== currentMonth.getMonth();
                const isToday    = sameYMD(cell, new Date());
                const isSpecific = calViewMode === "day" && ymd(cell) === specificDay;
                const dateKey    = ymd(cell);
                const dayJobs    = filteredJobs(dateKey);

                return (
                  <div
                    key={dateKey}
                    className={`sch-cell${isOther ? " other" : ""}${isToday || isSpecific ? " today" : ""}`}
                    onClick={canEdit ? () => onOpenJob({ date: dateKey }) : undefined}
                    style={{ cursor: canEdit ? "pointer" : "default" }}
                  >
                    <div className="sch-cell-bar">
                      <span className="dnum">{cell.getDate()}</span>
                      {canEdit && (
                        <button
                          type="button"
                          style={{ width: 22, height: 22, padding: 0, fontSize: 13, fontWeight: 800, display: "grid", placeItems: "center", border: "1px solid var(--sch-border)", borderRadius: 6, background: "var(--sch-s2)", color: "var(--sch-senior)", cursor: "pointer", transition: "all .15s" }}
                          onClick={e => { e.stopPropagation(); onOpenJob({ date: dateKey }); }}
                        >+</button>
                      )}
                    </div>
                    <div className="sch-jobs">
                      {dayJobs.slice(0, 3).map(j => {
                        const s         = staffById(j.staff_id);
                        const cls       = TYPES[j.type]?.cls ?? "";
                        const isAbsence = j.type === "leave" || j.type === "absent";
                        const label     = isAbsence ? TYPES[j.type]?.label : j.jt_no;
                        return (
                          <div
                            key={j.id}
                            className={`sch-chip ${cls}`}
                            onClick={canEdit ? e => { e.stopPropagation(); onOpenJob({ date: dateKey, job: j }); } : e => e.stopPropagation()}
                            style={{ cursor: canEdit ? "pointer" : "default" }}
                            title={j.jt_no ? `NetSuite #: ${j.jt_no}` : undefined}
                          >
                            <span className={`sch-st ${STATUS[j.status]?.cls ?? ""}`} />
                            <span className="jn">{label || "--"}</span>
                            <span className="who">{s?.name?.split(",")[0] ?? "--"}</span>
                          </div>
                        );
                      })}
                      {dayJobs.length > 3 && (
                        <button
                          type="button"
                          className="sch-more-btn"
                          onClick={e => { e.stopPropagation(); setDayDetail({ dateKey, jobs: dayJobs }); }}
                        >+{dayJobs.length - 3} more</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Availability panel */}
        <AvailabilityPanel currentMonth={currentMonth} staff={staff} branches={branches} jobs={jobs} />
      </div>

      {/* Day detail overlay */}
      {dayDetail && (
        <div
          className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-5"
          onClick={() => setDayDetail(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">{dayDetail.dateKey} — {dayDetail.jobs.length} tickets</h3>
              <button type="button" onClick={() => setDayDetail(null)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>
            <div className="p-5 flex flex-col gap-2">
              {dayDetail.jobs.map(j => {
                const s   = staffById(j.staff_id);
                const cls = TYPES[j.type]?.cls ?? "";
                return (
                  <div key={j.id} className={`sch-chip ${cls}`} style={{ cursor: "default" }}>
                    <span className={`sch-st ${STATUS[j.status]?.cls ?? ""}`} />
                    <span className="jn">{j.jt_no || TYPES[j.type]?.label || "--"}</span>
                    <span className="who">{s?.name ?? "--"}</span>
                    {j.customer && <span style={{ color: "var(--sch-muted)", fontSize: 11, marginLeft: "auto" }}>{j.customer}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

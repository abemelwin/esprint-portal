"use client";

import React, { useState, useRef, useEffect } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import { ymd, monthName } from "../lib/dates";
import { TYPES, STATUS, ROLES, ROLE_ORDER, REGIONS, REGION_COLORS, type Job } from "../lib/constants";

// ── Mini date picker ──────────────────────────────────────────────────────────
const DOW_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DatePickerPopup({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pickYear, setPickYear] = useState<number | null>(null);
  const [pickMon,  setPickMon]  = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const selDate  = value ? new Date(value + "T00:00:00") : new Date();
  const viewYear = pickYear ?? selDate.getFullYear();
  const viewMon  = pickMon  ?? selDate.getMonth();
  const today    = ymd(new Date());

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function prevMon() { viewMon === 0 ? (setPickYear(viewYear-1), setPickMon(11)) : (setPickYear(viewYear), setPickMon(viewMon-1)); }
  function nextMon() { viewMon === 11 ? (setPickYear(viewYear+1), setPickMon(0)) : (setPickYear(viewYear), setPickMon(viewMon+1)); }

  const firstDow  = new Date(viewYear, viewMon, 1).getDay();
  const daysInMon = new Date(viewYear, viewMon + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMon, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const triggerLabel = value ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Pick a date";

  return (
    <div className="sched-dcp-wrap" ref={ref}>
      <button className="sched-dcp-trigger" onClick={() => setOpen((o) => !o)}>
        <span>📅</span><span>{triggerLabel}</span><span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="sched-dcp-popup">
          <div className="sched-dcp-head">
            <button className="sched-dcp-nav" onClick={prevMon}>‹</button>
            <span className="sched-dcp-month">{monthLabel}</span>
            <button className="sched-dcp-nav" onClick={nextMon}>›</button>
          </div>
          <div className="sched-dcp-grid">
            {DOW_LABELS.map((d) => <span key={d} className="sched-dcp-dow">{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const iso    = ymd(new Date(viewYear, viewMon, d));
              const isTod  = iso === today;
              const isSel  = iso === value;
              return (
                <button key={d} className={`sched-dcp-day${isTod ? " today" : ""}${isSel ? " selected" : ""}`}
                  onClick={() => { onChange(iso); setOpen(false); }}>{d}</button>
              );
            })}
          </div>
          <div className="sched-dcp-footer">
            <button className="sched-dcp-today-btn" onClick={() => {
              const n = new Date(); setPickYear(n.getFullYear()); setPickMon(n.getMonth());
              onChange(ymd(n)); setOpen(false);
            }}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff row ─────────────────────────────────────────────────────────────────
const COLLAPSE_THRESHOLD = 4;
function StaffRow({ person, tasks, onOpenJob, readOnly }: { person: any; tasks: Job[]; onOpenJob?: (p: any) => void; readOnly: boolean }) {
  const absences  = tasks.filter((j) => j.type === "leave" || j.type === "absent");
  const workTasks = tasks.filter((j) => j.type !== "leave" && j.type !== "absent");
  const [expanded, setExpanded] = useState(workTasks.length < COLLAPSE_THRESHOLD);
  const statusOrder = (s: string) => s === "ongoing" ? 0 : s === "pending" ? 1 : s === "success" ? 2 : 3;
  workTasks.sort((a, b) => statusOrder(a.status) - statusOrder(b.status) || a.date.localeCompare(b.date));
  const ongoingCount = workTasks.filter((j) => j.status === "ongoing").length;
  const pendingCount = workTasks.filter((j) => j.status === "pending").length;
  const failCount    = workTasks.filter((j) => j.status === "fail").length;
  const hasMultiple  = workTasks.length > 1;
  const absenceLabel = absences.length ? [...new Set(absences.map((a) => TYPES[a.type]?.label))].join(", ") : "";
  const isCollapsible = workTasks.length >= COLLAPSE_THRESHOLD;

  return (
    <div className={`sched-ovl-staff${absences.length ? " sched-is-absent" : ""}`}>
      <div className="sched-ovl-staff-head">
        <span className="sched-ovl-staff-name">{person.name}</span>
        {person.hotline && <span className="sched-htag">☎</span>}
        <div className="sched-spacer" />
        {absences.length
          ? <span className="sched-ovl-badge sched-off">{absenceLabel}</span>
          : workTasks.length === 0
            ? <span className="sched-ovl-badge sched-free">Available</span>
            : (
              <span className={`sched-ovl-badge sched-busy${isCollapsible ? " sched-clickable" : ""}`}
                onClick={isCollapsible ? () => setExpanded((e) => !e) : undefined}>
                {workTasks.length} task{workTasks.length !== 1 ? "s" : ""}
                {isCollapsible && !expanded && (
                  <span className="sched-status-pills">
                    {ongoingCount > 0 && <span className="sched-pill sched-ongoing">{ongoingCount} ongoing</span>}
                    {pendingCount > 0 && <span className="sched-pill sched-pending">{pendingCount} {hasMultiple ? "next" : "pending"}</span>}
                    {failCount    > 0 && <span className="sched-pill sched-fail">{failCount} failed</span>}
                  </span>
                )}
                {isCollapsible && <span>{expanded ? "▲" : "▼"}</span>}
              </span>
            )
        }
      </div>
      {workTasks.length > 0 && expanded && (
        <div className="sched-ovl-tasks">
          {workTasks.map((j) => (
            <div key={j.id} className={`sched-ovl-task${readOnly ? "" : " sched-clickable-task"}`}
              style={readOnly ? { cursor: "default" } : {}}
              onClick={readOnly ? undefined : () => onOpenJob?.({ date: j.date, job: j })}>
              <span className="sched-ovl-date">{j.date.slice(5)}</span>
              <span className={`sched-ovl-type sched-${TYPES[j.type]?.cls || ""}`}>{TYPES[j.type]?.label || j.type}</span>
              <span className="sched-ovl-cust">{j.customer || "—"}</span>
              <div className="sched-spacer" />
              {j.status !== "success" && (
                <span className={`sched-pill sched-${STATUS[j.status]?.cls || ""}`}>
                  {j.status === "pending" && hasMultiple ? "Next" : STATUS[j.status]?.label || j.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role group ────────────────────────────────────────────────────────────────
function RoleGroup({ role, group, tasksFor, onOpenJob, searchTerm, readOnly }: any) {
  const workCount = group.reduce((sum: number, p: any) => sum + tasksFor(p.id).filter((j: Job) => j.type !== "leave" && j.type !== "absent").length, 0);
  const busy      = group.filter((p: any) => tasksFor(p.id).filter((j: Job) => j.type !== "leave" && j.type !== "absent").length > 0);
  const filtered  = searchTerm ? group.filter((p: any) => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : group;
  const [open, setOpen] = useState(busy.length > 0);
  const isOpen = searchTerm ? filtered.length > 0 : open;
  if (searchTerm && filtered.length === 0) return null;

  return (
    <div className="sched-ovl-role-block">
      <div className="sched-ovl-role-label" onClick={() => !searchTerm && setOpen((o) => !o)}>
        <span className="sched-swatch" style={{ background: ROLES[role]?.color }} />
        {ROLES[role]?.label}
        <span className="sched-ovl-role-cnt">{group.length}</span>
        <div style={{ flex: 1 }} />
        {workCount > 0 && <span className="sched-ovl-role-busy">{workCount} task{workCount !== 1 ? "s" : ""}</span>}
        {!searchTerm && <span style={{ fontSize: 10, marginLeft: 6 }}>{open ? "▲" : "▼"}</span>}
      </div>
      {isOpen && filtered.map((person: any) => (
        <StaffRow key={person.id} person={person} tasks={tasksFor(person.id)} onOpenJob={onOpenJob} readOnly={readOnly} />
      ))}
    </div>
  );
}

// ── Branch detail ─────────────────────────────────────────────────────────────
function BranchDetail({ branch, dateFilter, jobs, staff, onOpenJob, readOnly }: any) {
  const { isAdmin } = useScheduler();
  const branchStaff = staff.filter((s: any) => s.home_branch_id === branch.id);
  const tasksFor = (id: string) => {
    if (dateFilter.mode === "day") return jobs.filter((j: Job) => j.staff_id === id && j.branch_id === branch.id && j.date === dateFilter.date);
    return jobs.filter((j: Job) => j.staff_id === id && j.branch_id === branch.id && j.date.startsWith(dateFilter.prefix));
  };
  const [search, setSearch] = useState("");
  if (branchStaff.length === 0) return <div className="sched-empty-row">No staff assigned to {branch.name}.</div>;

  const visibleRoles = isAdmin ? ROLE_ORDER : ROLE_ORDER.filter((r) => r !== "coordinator");

  return (
    <div className="sched-ovl-branch-detail">
      <div className="sched-search-wrap" style={{ marginBottom: 6 }}>
        <span>🔍</span>
        <input className="sched-search-input" placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <span style={{ cursor: "pointer" }} onClick={() => setSearch("")}>✕</span>}
      </div>
      {visibleRoles.map((role) => {
        const group = branchStaff.filter((s: any) => {
          if (role === "coordinator") return s.role === "coordinator" || s.role === "service_coordinator";
          if (role === "manager") return s.role === "manager" || s.role === "service_manager";
          if (role === "senior") return s.role === "senior" || s.role === "senior_fse";
          if (role === "junior") return s.role === "junior" || s.role === "junior_fse" || s.role === "field_service_engineer";
          return s.role === role;
        });
        if (!group.length) return null;
        return <RoleGroup key={role} role={role} group={group} tasksFor={tasksFor} onOpenJob={onOpenJob} searchTerm={search} readOnly={readOnly} />;
      })}
    </div>
  );
}

// ── Branch picker ─────────────────────────────────────────────────────────────
function BranchPicker({ branches, selected, onChange }: any) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const current  = branches.find((b: any) => b.id === selected) || branches[0];
  const filtered = branches.filter((b: any) => `${b.name} ${b.note}`.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="sched-bp-wrap" ref={ref}>
      <button className="sched-bp-trigger" onClick={() => setOpen((o) => !o)}>
        {current ? <><span className="sched-bp-code">{current.name}</span><span className="sched-bp-note">{current.note}</span></> : <span className="sched-bp-note">Select branch</span>}
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="sched-bp-dropdown">
          <div className="sched-bp-search-row">
            <span>🔍</span>
            <input className="sched-bp-search" autoFocus placeholder="Search branch…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sched-bp-list">
            {filtered.length === 0
              ? <div className="sched-bp-empty">No results</div>
              : filtered.map((b: any) => (
                <div key={b.id} className={`sched-bp-item${b.id === selected ? " active" : ""}`}
                  onClick={() => { onChange(b.id); setOpen(false); setSearch(""); }}>
                  <span className="sched-bp-code">{b.name}</span>
                  <span className="sched-bp-note">{b.note}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Region section ────────────────────────────────────────────────────────────
function RegionSection({ regionName, dateFilter, onOpenJob, scopedBranchIds, readOnly }: any) {
  const { branches, jobs, staff } = useScheduler();
  const regionCodes       = REGIONS[regionName] || [];
  const allRegionBranches = branches.filter((b) => regionCodes.includes(b.name));
  const regionBranches    = scopedBranchIds ? allRegionBranches.filter((b) => scopedBranchIds.includes(b.id)) : allRegionBranches;
  const regionColor       = REGION_COLORS[regionName];
  const [selected, setSelected] = useState(regionBranches[0]?.id || "");
  const branch = regionBranches.find((b) => b.id === selected) || regionBranches[0];

  return (
    <div className="sched-ovl-region">
      <div className="sched-ovl-region-head" style={{ borderLeftColor: regionColor }}>
        <div className="sched-ovl-region-label" style={{ color: regionColor }}>{regionName}</div>
        <div className="sched-ovl-region-filter">
          {regionBranches.length > 1
            ? <BranchPicker branches={regionBranches} selected={selected} onChange={setSelected} />
            : <span className="sched-bp-trigger" style={{ cursor: "default" }}>
                <span className="sched-bp-code">{regionBranches[0]?.name}</span>
                <span className="sched-bp-note">{regionBranches[0]?.note}</span>
              </span>
          }
        </div>
      </div>
      {branch
        ? <BranchDetail branch={branch} dateFilter={dateFilter} jobs={jobs} staff={staff} onOpenJob={onOpenJob} readOnly={readOnly} />
        : <div className="sched-empty-row">No branches configured for {regionName}.</div>
      }
    </div>
  );
}

// ── Main OverviewView ─────────────────────────────────────────────────────────
interface OverviewViewProps {
  currentMonth: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  onOpenJob: (p: { date: string; job?: Job }) => void;
  scopedBranchIds: string[] | null;
  readOnly: boolean;
}

export default function OverviewView({ currentMonth, setCurrentMonth, onOpenJob, scopedBranchIds, readOnly }: OverviewViewProps) {
  const { branches } = useScheduler();
  const [viewMode,    setViewMode]    = useState("month");
  const [specificDay, setSpecificDay] = useState(ymd(new Date()));

  function prevMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday()   { const n = new Date(); setCurrentMonth(new Date(n.getFullYear(), n.getMonth(), 1)); setSpecificDay(ymd(n)); }

  const monthPrefix = ymd(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)).slice(0, 7);
  const dateFilter  = viewMode === "day"
    ? { mode: "day",   date: specificDay }
    : { mode: "month", prefix: monthPrefix };

  const visibleRegions = Object.keys(REGIONS).filter((regionName) => {
    if (!scopedBranchIds) return true;
    const codes = REGIONS[regionName] || [];
    return branches.filter((b) => codes.includes(b.name)).some((b) => scopedBranchIds.includes(b.id));
  });

  return (
    <div className="sched-ovl-root">
      <div className="sched-toolbar">
        <div className="sched-toolbar-nav">
          <div className="sched-month-nav">
            <button className="sched-btn sched-btn-sm" onClick={prevMonth}>◀</button>
            <div className="sched-month-label">{monthName(currentMonth)}</div>
            <button className="sched-btn sched-btn-sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sched-btn sched-btn-sm sched-today-btn" onClick={goToday}>Today</button>
        </div>
        <div className="sched-sep" />
        <div className="sched-filters">
          <div className="sched-seg-toggle" style={{ flexShrink: 0 }}>
            <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>This month</button>
            <button className={viewMode === "day"   ? "active" : ""} onClick={() => setViewMode("day")}>Specific day</button>
          </div>
          {viewMode === "day" && (
            <DatePickerPopup value={specificDay} onChange={(day) => {
              setSpecificDay(day);
              const d = new Date(day + "T00:00:00");
              setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }} />
          )}
          {readOnly && (
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--sched-muted)", background: "var(--sched-surface-2)", border: "1px solid var(--sched-border)", borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap" }}>
              🔒 View only
            </span>
          )}
        </div>
      </div>
      <div className="sched-ovl-region-cols">
        {visibleRegions.map((regionName) => (
          <RegionSection key={regionName} regionName={regionName} dateFilter={dateFilter}
            onOpenJob={onOpenJob} scopedBranchIds={scopedBranchIds} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
}

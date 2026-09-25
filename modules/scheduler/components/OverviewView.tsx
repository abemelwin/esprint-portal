"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Job, Staff, Branch } from "../types";
import { TYPES, STATUS, ROLES, ROLE_ORDER } from "../constants";
import { ymd, monthName } from "../dates";

// ── Constants ─────────────────────────────────────────────────────
const REGIONS: Record<string, string[]> = {
  "North Luzon":    ["CAB", "ISA", "PANG"],
  "South Luzon":    ["CAV", "CAMSUR", "MAK", "PAL", "RIZ"],
  "Visayas":        ["BAC", "CEB", "ILO", "TAC"],
  "North Mindanao": ["BUK", "BUT", "CDO", "PAG", "ZAM"],
  "South Mindanao": ["DAV", "GENSAN", "TAG"],
};
const REGION_COLORS: Record<string, string> = {
  "North Luzon":    "#2a78d6",
  "South Luzon":    "#0ea5e9",
  "Visayas":        "#b5179e",
  "North Mindanao": "#1baf7a",
  "South Mindanao": "#10b981",
};
const COLLAPSE_THRESHOLD = 4;
const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ── Floating Date Picker ──────────────────────────────────────────
function DatePickerPopup({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const [open,     setOpen]     = useState(false);
  const [pickYear, setPickYear] = useState<number | null>(null);
  const [pickMon,  setPickMon]  = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const selDate  = value ? new Date(value + "T00:00:00") : new Date();
  const viewYear = pickYear ?? selDate.getFullYear();
  const viewMon  = pickMon  ?? selDate.getMonth();
  const todayStr = ymd(new Date());

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function prevMon() {
    if (viewMon === 0) { setPickYear(viewYear - 1); setPickMon(11); }
    else               { setPickYear(viewYear);     setPickMon(viewMon - 1); }
  }
  function nextMon() {
    if (viewMon === 11) { setPickYear(viewYear + 1); setPickMon(0); }
    else                { setPickYear(viewYear);     setPickMon(viewMon + 1); }
  }

  const firstDow   = new Date(viewYear, viewMon, 1).getDay();
  const daysInMon  = new Date(viewYear, viewMon + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMon; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(viewYear, viewMon, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const triggerLabel = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "Pick a date";

  function goToday() {
    const n = new Date();
    setPickYear(n.getFullYear());
    setPickMon(n.getMonth());
    onChange(ymd(n));
    setOpen(false);
  }

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
            {DOW_LABELS.map(d => <span key={d} className="sch-dcp-dow">{d}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const iso    = ymd(new Date(viewYear, viewMon, d));
              const isTod  = iso === todayStr;
              const isSel  = iso === value;
              return (
                <button
                  key={d}
                  type="button"
                  className={`sch-dcp-day${isTod ? " today" : ""}${isSel ? " selected" : ""}`}
                  onClick={() => { onChange(iso); setOpen(false); }}
                >{d}</button>
              );
            })}
          </div>
          <div className="sch-dcp-footer">
            <button type="button" className="sch-dcp-today-btn" onClick={goToday}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branch Picker ─────────────────────────────────────────────────
function BranchPicker({ branches, selected, onChange }: {
  branches: Branch[]; selected: string; onChange: (id: string) => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current  = branches.find(b => b.id === selected) ?? branches[0];
  const filtered = branches.filter(b =>
    `${b.name} ${b.note}`.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(id: string) { onChange(id); setOpen(false); setSearch(""); }

  if (branches.length <= 1) {
    return (
      <span className="sch-bp-trigger" style={{ cursor: "default" }}>
        <span className="sch-bp-code">{current?.name}</span>
        <span className="sch-bp-note">{current?.note}</span>
      </span>
    );
  }

  return (
    <div className="sch-bp-wrap" ref={ref}>
      <button type="button" className={`sch-bp-trigger${open ? " active" : ""}`} onClick={() => setOpen(o => !o)}>
        {current ? (
          <><span className="sch-bp-code">{current.name}</span><span className="sch-bp-note">{current.note}</span></>
        ) : <span className="sch-bp-note">Select branch</span>}
        <span className="sch-bp-arrow">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="sch-bp-dropdown">
          <div className="sch-bp-search-row">
            <span style={{ fontSize: 13 }}>🔍</span>
            <input
              className="sch-bp-search"
              autoFocus
              placeholder="Search branch…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="sch-bp-list">
            {filtered.length === 0
              ? <div className="sch-bp-empty">No results</div>
              : filtered.map(b => (
                <div
                  key={b.id}
                  className={`sch-bp-item${b.id === selected ? " active" : ""}`}
                  onClick={() => pick(b.id)}
                >
                  <span className="sch-bp-code">{b.name}</span>
                  <span className="sch-bp-note">{b.note}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff Row ─────────────────────────────────────────────────────
function StaffRow({ person, tasks, onOpenJob, readOnly }: {
  person: Staff; tasks: Job[]; onOpenJob?: (p: { date: string; job: Job }) => void; readOnly: boolean;
}) {
  const absences  = tasks.filter(j => j.type === "leave" || j.type === "absent");
  const workTasks = tasks.filter(j => j.type !== "leave" && j.type !== "absent");
  const [expanded, setExpanded] = useState(workTasks.length < COLLAPSE_THRESHOLD);

  const statusOrder = (s: string) =>
    s === "ongoing" ? 0 : s === "pending" ? 1 : s === "success" ? 2 : 3;
  const sorted = [...workTasks].sort((a, b) =>
    statusOrder(a.status) - statusOrder(b.status) || a.date.localeCompare(b.date)
  );

  const ongoingCount = sorted.filter(j => j.status === "ongoing").length;
  const pendingCount = sorted.filter(j => j.status === "pending").length;
  const failCount    = sorted.filter(j => j.status === "fail").length;
  const isCollapsible = sorted.length >= COLLAPSE_THRESHOLD;
  const hasMultiple   = sorted.length > 1;
  const absenceLabel  = absences.length
    ? [...new Set(absences.map(a => TYPES[a.type]?.label))].join(", ")
    : "";

  return (
    <div className={`sch-ovl-staff${absences.length ? " is-absent" : ""}`}>
      <div className="sch-ovl-staff-head">
        <span className="sch-ovl-staff-name">{person.name}</span>
        {(person as any).hotline && (
          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, fontWeight: 700, color: "#fff", background: "#ea580c", flexShrink: 0 }}>☎</span>
        )}
        <div style={{ flex: 1 }} />
        {absences.length ? (
          <span className="sch-ovl-badge off">{absenceLabel}</span>
        ) : sorted.length === 0 ? (
          <span className="sch-ovl-badge free">Available</span>
        ) : (
          <span
            className="sch-ovl-badge busy"
            onClick={isCollapsible ? () => setExpanded(e => !e) : undefined}
          >
            {sorted.length} task{sorted.length !== 1 ? "s" : ""}
            {isCollapsible && !expanded && (
              <span style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                {ongoingCount > 0 && <span className="sch-pill ongoing" style={{ fontSize: 10 }}>{ongoingCount} ongoing</span>}
                {pendingCount > 0 && <span className="sch-pill pending" style={{ fontSize: 10 }}>{pendingCount} next</span>}
                {failCount    > 0 && <span className="sch-pill fail"    style={{ fontSize: 10 }}>{failCount} failed</span>}
              </span>
            )}
            {isCollapsible && <span className="sch-ovl-chevron">{expanded ? "▲" : "▼"}</span>}
          </span>
        )}
      </div>

      {sorted.length > 0 && expanded && (
        <div className="sch-ovl-tasks">
          {sorted.map(j => (
            <div
              key={j.id}
              className={`sch-ovl-task${readOnly ? " readonly" : ""}`}
              onClick={readOnly ? undefined : () => onOpenJob?.({ date: j.date, job: j })}
            >
              <span className="sch-ovl-date">{j.date.slice(5)}</span>
              <span className={`sch-ovl-type ${TYPES[j.type]?.cls ?? ""}`}>
                {TYPES[j.type]?.label ?? j.type}
              </span>
              <span className="sch-ovl-cust">{j.customer ?? "—"}</span>
              <div style={{ flex: 1 }} />
              {j.status !== "success" && (
                <span className={`sch-pill ${STATUS[j.status]?.cls ?? ""}`}>
                  {j.status === "pending" && hasMultiple ? "Next" : STATUS[j.status]?.label ?? j.status}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role Group ────────────────────────────────────────────────────
function RoleGroup({ role, group, tasksFor, onOpenJob, search, readOnly }: {
  role: string;
  group: Staff[];
  tasksFor: (id: string) => Job[];
  onOpenJob?: (p: { date: string; job: Job }) => void;
  search: string;
  readOnly: boolean;
}) {
  const filtered    = search ? group.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : group;
  const busyCount   = group.filter(p => tasksFor(p.id).filter(j => j.type !== "leave" && j.type !== "absent").length > 0).length;
  const taskCount   = group.reduce((sum, p) => sum + tasksFor(p.id).filter(j => j.type !== "leave" && j.type !== "absent").length, 0);
  const [open, setOpen] = useState(busyCount > 0);

  if (search && filtered.length === 0) return null;
  if (!group.length) return null;

  const isOpen = search ? filtered.length > 0 : open;

  return (
    <div className="sch-ovl-role-block">
      <div className="sch-ovl-role-label" onClick={() => !search && setOpen(o => !o)}>
        <span className="sch-swatch" style={{ background: ROLES[role]?.color, width: 9, height: 9, borderRadius: 2, flexShrink: 0, display: "inline-block" }} />
        {ROLES[role]?.label}
        <span className="sch-ovl-role-cnt">{group.length}</span>
        <div style={{ flex: 1 }} />
        {taskCount > 0 && (
          <span className="sch-ovl-role-busy">{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
        )}
        {!search && <span className="sch-ovl-chevron">{open ? "▲" : "▼"}</span>}
      </div>
      {isOpen && filtered.map(person => (
        <StaffRow
          key={person.id}
          person={person}
          tasks={tasksFor(person.id)}
          onOpenJob={onOpenJob}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

// ── Branch Detail ─────────────────────────────────────────────────
function BranchDetail({ branch, dateFilter, jobs, staff, onOpenJob, readOnly }: {
  branch: Branch;
  dateFilter: { mode: "month"; prefix: string } | { mode: "day"; date: string };
  jobs: Job[];
  staff: Staff[];
  onOpenJob?: (p: { date: string; job: Job }) => void;
  readOnly: boolean;
}) {
  const [search, setSearch] = useState("");
  const branchStaff = staff.filter(s => s.home_branch_id === branch.id);

  function tasksFor(staffId: string): Job[] {
    if (dateFilter.mode === "day") {
      return jobs.filter(j => j.staff_id === staffId && j.branch_id === branch.id && j.date === dateFilter.date);
    }
    return jobs.filter(j =>
      j.staff_id === staffId && j.branch_id === branch.id && j.date.startsWith(dateFilter.prefix)
    );
  }

  if (branchStaff.length === 0) {
    return <div className="sch-ovl-empty">No staff assigned to {branch.name}.</div>;
  }

  return (
    <div className="sch-ovl-detail">
      <div className="sch-ovl-search-wrap" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--sch-muted)" }}>🔍</span>
        <input
          placeholder="Search staff…"
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

      {ROLE_ORDER.map(role => {
        const group = branchStaff.filter(s => {
          if (role === "manager")     return s.role === "manager";
          if (role === "bsm")         return s.role === "bsm";
          if (role === "coordinator") return s.role === "coordinator";
          if (role === "senior")      return s.role === "senior";
          if (role === "junior")      return s.role === "junior";
          return s.role === role;
        });
        return (
          <RoleGroup
            key={role}
            role={role}
            group={group}
            tasksFor={tasksFor}
            onOpenJob={onOpenJob}
            search={search}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

// ── Region Section ────────────────────────────────────────────────
function RegionSection({ regionName, dateFilter, jobs, staff, branches, onOpenJob, scopedBranchIds, readOnly }: {
  regionName: string;
  dateFilter: { mode: "month"; prefix: string } | { mode: "day"; date: string };
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
  onOpenJob?: (p: { date: string; job: Job }) => void;
  scopedBranchIds: string[] | null;
  readOnly: boolean;
}) {
  const regionCodes      = REGIONS[regionName] ?? [];
  const allRegionBranches = branches.filter(b => regionCodes.includes(b.name));
  const regionBranches   = scopedBranchIds
    ? allRegionBranches.filter(b => scopedBranchIds.includes(b.id))
    : allRegionBranches;
  const regionColor = REGION_COLORS[regionName];

  const [selected, setSelected] = useState(regionBranches[0]?.id ?? "");
  const branch = regionBranches.find(b => b.id === selected) ?? regionBranches[0];

  if (!regionBranches.length) return null;

  return (
    <div className="sch-ovl-region">
      <div className="sch-ovl-region-head" style={{ borderLeftColor: regionColor }}>
        <span className="sch-ovl-region-label" style={{ color: regionColor }}>{regionName}</span>
        <div className="sch-ovl-region-filter">
          <BranchPicker branches={regionBranches} selected={selected} onChange={setSelected} />
        </div>
      </div>

      {branch ? (
        <BranchDetail
          branch={branch}
          dateFilter={dateFilter}
          jobs={jobs}
          staff={staff}
          onOpenJob={onOpenJob}
          readOnly={readOnly}
        />
      ) : (
        <div className="sch-ovl-empty">No branches configured for {regionName}.</div>
      )}
    </div>
  );
}

// ── Main OverviewView ─────────────────────────────────────────────
interface Props {
  currentMonth: Date;
  setCurrentMonth: (fn: (m: Date) => Date) => void;
  jobs: Job[];
  staff: Staff[];
  branches: Branch[];
  onOpenJob?: (payload: { date: string; job?: Job }) => void;
  scopedBranchIds?: string[] | null;
  readOnly?: boolean;
}

export function OverviewView({
  currentMonth, setCurrentMonth, jobs, staff, branches,
  onOpenJob, scopedBranchIds = null, readOnly = false,
}: Props) {
  const [viewMode,    setViewMode]    = useState<"month" | "day">("month");
  const [specificDay, setSpecificDay] = useState(ymd(new Date()));

  function prevMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday() {
    const n = new Date();
    setCurrentMonth(() => new Date(n.getFullYear(), n.getMonth(), 1));
    setSpecificDay(ymd(n));
  }

  const monthPrefix  = ymd(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)).slice(0, 7);
  const dateFilter   = viewMode === "day"
    ? { mode: "day"   as const, date:   specificDay }
    : { mode: "month" as const, prefix: monthPrefix };

  // Filter visible regions to only those containing scoped branches
  const visibleRegions = Object.keys(REGIONS).filter(regionName => {
    if (!scopedBranchIds) return true;
    const codes   = REGIONS[regionName] ?? [];
    const brnches = branches.filter(b => codes.includes(b.name));
    return brnches.some(b => scopedBranchIds.includes(b.id));
  });

  return (
    <div className="sch-ovl-root">
      {/* Toolbar */}
      <div className="sch-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div className="sch-month-nav">
            <button className="sch-btn sm" onClick={prevMonth}>◀</button>
            <div className="sch-month-label">{monthName(currentMonth)}</div>
            <button className="sch-btn sm" onClick={nextMonth}>▶</button>
          </div>
          <button className="sch-btn sm" onClick={goToday}>Today</button>
        </div>

        <div className="sch-sep" />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Month / Day toggle */}
          <div className="sch-seg">
            <button className={viewMode === "month" ? "active" : ""} onClick={() => setViewMode("month")}>
              This month
            </button>
            <button className={viewMode === "day" ? "active" : ""} onClick={() => setViewMode("day")}>
              Specific day
            </button>
          </div>

          {viewMode === "day" && (
            <DatePickerPopup
              value={specificDay}
              onChange={day => {
                setSpecificDay(day);
                const d = new Date(day + "T00:00:00");
                setCurrentMonth(() => new Date(d.getFullYear(), d.getMonth(), 1));
              }}
            />
          )}

          {readOnly && (
            <span style={{ fontSize: 11, color: "var(--sch-muted)", background: "var(--sch-s2)", border: "1px solid var(--sch-border)", borderRadius: 4, padding: "2px 8px", whiteSpace: "nowrap" }}>
              🔒 View only
            </span>
          )}
        </div>
      </div>

      {/* Regional columns */}
      <div className="sch-ovl-cols">
        {visibleRegions.map(regionName => (
          <RegionSection
            key={regionName}
            regionName={regionName}
            dateFilter={dateFilter}
            jobs={jobs}
            staff={staff}
            branches={branches}
            onOpenJob={onOpenJob ? p => onOpenJob({ date: p.date, job: p.job }) : undefined}
            scopedBranchIds={scopedBranchIds}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

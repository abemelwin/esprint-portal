"use client";

import { useState } from "react";
import type { Job, Staff, Branch, SchedulerFilters } from "../types";
import { SEED_BRANCHES, SEED_STAFF } from "../constants";
import { SchedulerTopNav } from "./SchedulerTopNav";
import { KpiRow } from "./KpiRow";
import { CalendarView } from "./CalendarView";
import { ReportsView } from "./ReportsView";
import { OverviewView } from "./OverviewView";
import { JobModal } from "./JobModal";
import { KpiDrillModal, type DrillKind } from "./KpiDrillModal";
import { RegistrationApprovalModal } from "./RegistrationApprovalModal";
import { BranchModal } from "./BranchModal";
import { StaffModal } from "./StaffModal";

interface Props {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  canEdit: boolean;
  canViewOverview: boolean;
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function SchedulerClient({ userName, userRole, isAdmin, canEdit, canViewOverview }: Props) {
  const [view, setView] = useState<"calendar" | "reports" | "overview">("calendar");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  // ── Data (in-memory — swap for API when DB is ready) ───────────
  const [jobs,     setJobs]     = useState<Job[]>([]);
  const [staff,    setStaff]    = useState<Staff[]>(SEED_STAFF);
  const [branches, setBranches] = useState<Branch[]>(SEED_BRANCHES);

  // ── Modal states ───────────────────────────────────────────────
  const [jobModal,      setJobModal]      = useState<{ date: string; job?: Job } | null>(null);
  const [drillKind,     setDrillKind]     = useState<DrillKind | null>(null);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [branchOpen,    setBranchOpen]    = useState(false);
  const [staffOpen,     setStaffOpen]     = useState(false);
  const [usersOpen,     setUsersOpen]     = useState(false);

  const [filters,  setFilters]  = useState<SchedulerFilters>({ branch: "", emp: "", type: "", status: "" });
  const [rFilters, setRFilters] = useState<Pick<SchedulerFilters, "branch" | "emp">>({ branch: "", emp: "" });

  // ── CRUD helpers ───────────────────────────────────────────────
  function handleSaveJob(data: Omit<Job, "id"> & { id?: string }) {
    if (data.id) setJobs(prev => prev.map(j => j.id === data.id ? { ...j, ...data } as Job : j));
    else         setJobs(prev => [...prev, { ...data, id: newId() } as Job]);
  }
  function handleDeleteJob(id: string) { setJobs(prev => prev.filter(j => j.id !== id)); }

  // Branch CRUD
  function handleAddBranch(name: string, note: string) {
    setBranches(prev => [...prev, { id: newId(), name, note }]);
  }
  function handleRemoveBranch(id: string) { setBranches(prev => prev.filter(b => b.id !== id)); }

  // Staff CRUD
  function handleAddStaff(s: Omit<Staff, "id">) { setStaff(prev => [...prev, { ...s, id: newId() }]); }
  function handleEditStaff(s: Staff)              { setStaff(prev => prev.map(x => x.id === s.id ? s : x)); }
  function handleRemoveStaff(id: string)          { setStaff(prev => prev.filter(s => s.id !== id)); }

  // Export JSON
  function handleExport() {
    const blob = new Blob([JSON.stringify({ branches, staff, jobs }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `esprint-schedule-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  // Import JSON
  function handleImport() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json";
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.branches) setBranches(data.branches);
        if (data.staff)    setStaff(data.staff);
        if (data.jobs)     setJobs(data.jobs);
        alert("Import successful!");
      } catch { alert("Invalid file."); }
    };
    input.click();
  }

  const effectiveView = view === "overview" && !canViewOverview ? "calendar" : view;

  return (
    <div className="sch-root" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top nav (header + tab sub-nav) */}
      <SchedulerTopNav
        view={view}
        setView={v => setView(v as "calendar" | "reports" | "overview")}
        userName={userName}
        userRole={userRole}
        isAdmin={isAdmin}
        canViewOverview={canViewOverview}
        pendingCount={0}
        onApprovals={() => setApprovalsOpen(true)}
        onStaff={() => setStaffOpen(true)}
        onBranch={() => setBranchOpen(true)}
        onUsers={() => setUsersOpen(true)}
        onExport={handleExport}
        onImport={handleImport}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "20px 24px 32px", maxWidth: 1680, margin: "0 auto", width: "100%" }}>
          {effectiveView !== "overview" && (
            <KpiRow
              view={effectiveView} currentMonth={currentMonth} reportMonth={reportMonth}
              jobs={jobs} staff={staff} branches={branches}
              filters={effectiveView === "calendar" ? filters : null}
              isAdmin={isAdmin} onDrill={kind => setDrillKind(kind)}
            />
          )}

          {effectiveView === "calendar" && (
            <CalendarView
              currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              filters={filters} setFilters={setFilters}
              jobs={jobs} staff={staff} branches={branches}
              canEdit={canEdit} onOpenJob={payload => setJobModal(payload)}
            />
          )}
          {effectiveView === "reports" && (
            <ReportsView
              reportMonth={reportMonth} setReportMonth={setReportMonth}
              rFilters={rFilters} setRFilters={setRFilters}
              jobs={jobs} staff={staff} branches={branches}
            />
          )}
          {effectiveView === "overview" && (
            <OverviewView
              currentMonth={currentMonth} setCurrentMonth={setCurrentMonth}
              jobs={jobs} staff={staff} branches={branches}
              onOpenJob={canEdit ? payload => setJobModal(payload) : undefined}
              scopedBranchIds={null} readOnly={!canEdit}
            />
          )}

          <div style={{ textAlign: "center", color: "var(--sch-muted, #64748b)", fontSize: 11.5, marginTop: 32 }}>
            ES Print Group of Companies · Support Team Scheduler
          </div>
        </div>
      </div>

      {/* Modals */}
      {jobModal && (
        <JobModal payload={jobModal} onClose={() => setJobModal(null)}
          staff={staff} branches={branches}
          onSave={handleSaveJob} onDelete={handleDeleteJob}
          isAdmin={isAdmin} canEdit={canEdit} />
      )}
      {drillKind && (
        <KpiDrillModal kind={drillKind} currentMonth={currentMonth} reportMonth={reportMonth}
          view={effectiveView} filters={effectiveView === "calendar" ? filters : null}
          jobs={jobs} staff={staff} branches={branches} onClose={() => setDrillKind(null)} />
      )}
      {approvalsOpen && (
        <RegistrationApprovalModal onClose={() => setApprovalsOpen(false)} branches={branches} />
      )}
      {branchOpen && (
        <BranchModal branches={branches}
          onAddBranch={handleAddBranch} onRemoveBranch={handleRemoveBranch}
          onClose={() => setBranchOpen(false)} />
      )}
      {staffOpen && (
        <StaffModal staff={staff} branches={branches}
          onAddStaff={handleAddStaff} onEditStaff={handleEditStaff} onRemoveStaff={handleRemoveStaff}
          onClose={() => setStaffOpen(false)} />
      )}
      {/* UsersModal placeholder — shows Approvals for now */}
      {usersOpen && (
        <RegistrationApprovalModal onClose={() => setUsersOpen(false)} branches={branches} />
      )}
    </div>
  );
}

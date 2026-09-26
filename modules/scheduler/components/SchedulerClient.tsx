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

interface Props {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  canEdit: boolean;
  canViewOverview: boolean;
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function SchedulerClient({
  userName, userRole, isAdmin, canEdit, canViewOverview,
}: Props) {
  const [view, setView] = useState<"calendar" | "reports" | "overview">("calendar");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [reportMonth, setReportMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [staff]               = useState<Staff[]>(SEED_STAFF);
  const [branches]            = useState<Branch[]>(SEED_BRANCHES);

  const [jobModal,   setJobModal]   = useState<{ date: string; job?: Job } | null>(null);
  const [drillKind,  setDrillKind]  = useState<DrillKind | null>(null);

  const [filters,  setFilters]  = useState<SchedulerFilters>({ branch: "", emp: "", type: "", status: "" });
  const [rFilters, setRFilters] = useState<Pick<SchedulerFilters, "branch" | "emp">>({ branch: "", emp: "" });

  function handleSaveJob(data: Omit<Job, "id"> & { id?: string }) {
    if (data.id) {
      setJobs(prev => prev.map(j => j.id === data.id ? { ...j, ...data } as Job : j));
    } else {
      setJobs(prev => [...prev, { ...data, id: newId() } as Job]);
    }
  }

  function handleDeleteJob(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id));
  }

  const effectiveView = view === "overview" && !canViewOverview ? "calendar" : view;

  return (
    <div className="sch-root" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <SchedulerTopNav
        view={view}
        setView={v => setView(v as "calendar" | "reports" | "overview")}
        userName={userName}
        userRole={userRole}
        canViewOverview={canViewOverview}
        isAdmin={isAdmin}
      />

      <main style={{ padding: "20px 24px 60px", maxWidth: 1680, margin: "0 auto", width: "100%" }}>
        {/* KPI row */}
        {effectiveView !== "overview" && (
          <KpiRow
            view={effectiveView}
            currentMonth={currentMonth}
            reportMonth={reportMonth}
            jobs={jobs}
            staff={staff}
            branches={branches}
            filters={effectiveView === "calendar" ? filters : null}
            isAdmin={isAdmin}
            onDrill={kind => setDrillKind(kind)}
          />
        )}

        {effectiveView === "calendar" && (
          <CalendarView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            filters={filters}
            setFilters={setFilters}
            jobs={jobs}
            staff={staff}
            branches={branches}
            canEdit={canEdit}
            onOpenJob={payload => setJobModal(payload)}
          />
        )}

        {effectiveView === "reports" && (
          <ReportsView
            reportMonth={reportMonth}
            setReportMonth={setReportMonth}
            rFilters={rFilters}
            setRFilters={setRFilters}
            jobs={jobs}
            staff={staff}
            branches={branches}
          />
        )}

        {effectiveView === "overview" && (
          <OverviewView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            jobs={jobs}
            staff={staff}
            branches={branches}
            onOpenJob={canEdit ? payload => setJobModal(payload) : undefined}
            scopedBranchIds={null}
            readOnly={!canEdit}
          />
        )}

        <div style={{ textAlign: "center", color: "var(--sch-muted)", fontSize: 11.5, marginTop: 40 }}>
          ES Print Group of Companies · Support Team Scheduler
        </div>
      </main>

      {/* Job Ticket modal */}
      {jobModal && (
        <JobModal
          payload={jobModal}
          onClose={() => setJobModal(null)}
          staff={staff}
          branches={branches}
          onSave={handleSaveJob}
          onDelete={handleDeleteJob}
          isAdmin={isAdmin}
          canEdit={canEdit}
        />
      )}

      {/* KPI drill modal */}
      {drillKind && (
        <KpiDrillModal
          kind={drillKind}
          currentMonth={currentMonth}
          reportMonth={reportMonth}
          view={effectiveView}
          filters={effectiveView === "calendar" ? filters : null}
          jobs={jobs}
          staff={staff}
          branches={branches}
          onClose={() => setDrillKind(null)}
        />
      )}
    </div>
  );
}

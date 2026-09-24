"use client";

/**
 * SchedulerClient — the root interactive component for the Support Scheduler module.
 * Rendered inside app/(portal)/scheduler/layout.tsx within SchedulerProvider.
 *
 * Handles view state, modal state, and routes between CalendarView / ReportsView / OverviewView.
 * Auth is already guaranteed by the portal layout — currentUser from SchedulerContext maps to
 * the scheduler's own Supabase app_users table.
 */

import { useState, useEffect } from "react";
import { useScheduler } from "../lib/SchedulerContext";
import CalendarView   from "./CalendarView";
import ReportsView    from "./ReportsView";
import OverviewView   from "./OverviewView";
import KpiRow         from "./KpiRow";
import JobModal       from "./JobModal";
import StaffModal     from "./StaffModal";
import BranchModal    from "./BranchModal";
import UsersModal     from "./UsersModal";
import KpiDrillModal  from "./KpiDrillModal";
import RegistrationApprovalModal from "./RegistrationApprovalModal";
import type { Job } from "../lib/constants";

// Props injected by the server layout (from portal RBAC)
export interface SchedulerClientProps {
  /** Portal user's full name (for greeting / display) */
  portalUserName: string;
  /** Scheduler module role string */
  portalUserRole: string;
  /** Whether the portal user is an admin of this module */
  isPortalAdmin: boolean;
  /** Which view to open on mount (default: "calendar") */
  initialView?: "calendar" | "reports" | "overview";
}

export function SchedulerClient({ portalUserName, portalUserRole, isPortalAdmin, initialView = "calendar" }: SchedulerClientProps) {
  const { currentUser, loading, isAdmin, pendingRegCount } = useScheduler();

  type View = "calendar" | "reports" | "overview";
  const [view,         setView]         = useState<View>(initialView);
  const [currentMonth, setCurrentMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [reportMonth,  setReportMonth]  = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });

  // Modal states
  const [jobModal,          setJobModal]          = useState<{ date: string; job?: Job } | null>(null);
  const [staffOpen,         setStaffOpen]         = useState(false);
  const [branchOpen,        setBranchOpen]        = useState(false);
  const [usersOpen,         setUsersOpen]         = useState(false);
  const [kpiDrill,          setKpiDrill]          = useState<{ kind: string } | null>(null);
  const [regApprovalOpen,   setRegApprovalOpen]   = useState(false);

  // Calendar & report filters
  const [filters,  setFilters]  = useState({ branch: "", emp: "", type: "", status: "" });
  const [rFilters, setRFilters] = useState({ branch: "", emp: "" });

  // Role logic derived from the scheduler's own app_users record
  // Falls back to portal role when scheduler user record not yet provisioned
  const effectiveRole = currentUser?.role || portalUserRole;
  const effectiveAdmin = isAdmin || isPortalAdmin;

  const isArnold           = !!(currentUser?.name?.includes("Arnold"));
  const isServiceManager   = effectiveRole === "service_manager";
  const isServiceCoord     = effectiveRole === "service_coordinator";
  const isBranch           = effectiveRole === "branch";
  const isReadOnly         = !isAdmin && (
    effectiveRole === "senior_fse" || effectiveRole === "junior_fse" ||
    effectiveRole === "field_service_engineer" || effectiveRole === "trainee" ||
    effectiveRole === "employee" || currentUser?.can_edit === false
  );
  const canViewOverview = !isBranch && (effectiveAdmin || isArnold || isServiceManager || isServiceCoord);

  useEffect(() => {
    if (!canViewOverview && view === "overview") setView("calendar");
  }, [canViewOverview]); // eslint-disable-line react-hooks/exhaustive-deps

  // Loading state — show a minimal spinner until the Supabase session resolves
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--sched-muted, #64748b)", gap: 10, fontSize: 14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "sched-spin 0.8s linear infinite" }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading scheduler…
      </div>
    );
  }

  return (
    <div className="sched-root">
      {/* ── Module sub-header (tabs + admin tools) ── */}
      <div className="sched-subheader">
        <div className="sched-tabs">
          <button className={`sched-tab${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>
            📅 Schedule
          </button>
          <button className={`sched-tab${view === "reports" ? " active" : ""}`} onClick={() => setView("reports")}>
            📊 Reports
          </button>
          {canViewOverview && (
            <button className={`sched-tab${view === "overview" ? " active" : ""}`} onClick={() => setView("overview")}>
              🗺 Overview
            </button>
          )}
        </div>

        <div className="sched-subheader-spacer" />

        {effectiveAdmin && (
          <div className="sched-admin-tools">
            <button className="sched-btn sched-btn-sm sched-btn-ghost" onClick={() => setUsersOpen(true)}>
              🔑 Users
            </button>
            <button className="sched-btn sched-btn-sm sched-btn-ghost sched-reg-btn" onClick={() => setRegApprovalOpen(true)}>
              📋 Approvals
              {pendingRegCount > 0 && <span className="sched-reg-badge">{pendingRegCount}</span>}
            </button>
            <button className="sched-btn sched-btn-sm sched-btn-ghost" onClick={() => setBranchOpen(true)}>
              🏢 Branches
            </button>
            <button className="sched-btn sched-btn-sm sched-btn-ghost" onClick={() => setStaffOpen(true)}>
              👥 Staff
            </button>
          </div>
        )}
      </div>

      {/* ── Main view ── */}
      <div className="sched-content">
        {view === "calendar" || (view === "overview" && !canViewOverview) ? (
          <CalendarView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            filters={filters}
            setFilters={setFilters}
            onOpenJob={(payload) => setJobModal(payload)}
          />
        ) : view === "reports" ? (
          <ReportsView
            reportMonth={reportMonth}
            setReportMonth={setReportMonth}
            rFilters={rFilters}
            setRFilters={setRFilters}
          />
        ) : (
          <OverviewView
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            onOpenJob={(payload) => setJobModal(payload)}
            scopedBranchIds={
              (effectiveAdmin || isServiceCoord)
                ? null
                : (isServiceManager || isBranch || isReadOnly)
                  ? (currentUser?.branch_ids || [])
                  : null
            }
            readOnly={isReadOnly}
          />
        )}
      </div>

      {/* ── Modals ── */}
      {jobModal       && <JobModal payload={jobModal} onClose={() => setJobModal(null)} />}
      {staffOpen      && <StaffModal  onClose={() => setStaffOpen(false)} />}
      {branchOpen     && <BranchModal onClose={() => setBranchOpen(false)} />}
      {usersOpen      && <UsersModal  onClose={() => setUsersOpen(false)} />}
      {regApprovalOpen && <RegistrationApprovalModal onClose={() => setRegApprovalOpen(false)} />}
    </div>
  );
}

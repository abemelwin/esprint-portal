"use client";

/**
 * SchedulerContext — global state for the Support Scheduler module.
 * Ported from esprint-support-scheduler/src/lib/AppContext.jsx
 *
 * Provides branches, staff, jobs, appUsers, pendingRegs, auth helpers,
 * realtime subscriptions, and permission helpers via useScheduler().
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { schedulerSupabase, schedulerSupabaseSignup } from "./supabase";
import { namesMatch, isAdminOrCoordinator } from "./constants";
import type {
  Branch,
  StaffMember,
  Job,
  AppUser,
  PendingRegistration,
} from "./constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchedulerContextValue {
  // Auth
  currentUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;

  // Data
  branches: Branch[];
  staff: StaffMember[];
  jobs: Job[];
  appUsers: AppUser[];
  pendingRegs: PendingRegistration[];
  pendingRegCount: number;

  // Loaders
  loadBranches: () => Promise<void>;
  loadStaff: () => Promise<void>;
  loadJobs: () => Promise<void>;
  loadAppUsers: () => Promise<void>;
  loadPendingRegs: () => Promise<void>;

  // Setters (for optimistic UI)
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  setStaff: React.Dispatch<React.SetStateAction<StaffMember[]>>;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
  setAppUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;

  // Permissions
  isAdmin: boolean;
  isServiceManager: boolean;
  scopedBranchIds: string[] | null;
  editableBranchIds: string[] | null;
  canEditBranch: (branchId?: string | null) => boolean;
  inScope: (job: Job) => boolean;
  scopedBranches: () => Branch[];
  visibleStaff: () => StaffMember[];

  // Admin helpers
  updateUserRole: (userId: string, newRole: string) => Promise<unknown>;
  updateUserBranches: (userId: string, branchIds: string[]) => Promise<unknown>;
  toggleUserActive: (userId: string, isActive: boolean) => Promise<unknown>;
  updateUserCanEdit: (userId: string, canEdit: boolean) => Promise<unknown>;

  // Supabase clients (exposed for components that write directly)
  supabase: typeof schedulerSupabase;
  supabaseSignup: typeof schedulerSupabaseSignup;
}

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function SchedulerProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading]         = useState(true);

  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [staff,       setStaff]       = useState<StaffMember[]>([]);
  const [jobs,        setJobs]        = useState<Job[]>([]);
  const [appUsers,    setAppUsers]    = useState<AppUser[]>([]);
  const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);

  // ── Auth session ────────────────────────────────────────────────────────────
  useEffect(() => {
    schedulerSupabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user.id);
      else setLoading(false);
    });
    const {
      data: { subscription },
    } = schedulerSupabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id);
      else {
        setCurrentUser(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(uid: string) {
    const { data } = await schedulerSupabase
      .from("app_users")
      .select("*")
      .eq("auth_id", uid)
      .single();
    setCurrentUser((data as AppUser) || null);
    setLoading(false);
  }

  // ── Data loaders ─────────────────────────────────────────────────────────────
  const loadBranches = useCallback(async () => {
    const { data } = await schedulerSupabase.from("branches").select("*").order("name");
    setBranches((data as Branch[]) || []);
  }, []);

  const loadStaff = useCallback(async () => {
    const { data } = await schedulerSupabase.from("staff").select("*").order("name");
    const filtered = ((data as StaffMember[]) || []).filter(
      (s) => !s.name?.toLowerCase().includes("eileen")
    );
    setStaff(filtered);
  }, []);

  const loadJobs = useCallback(async () => {
    const { data } = await schedulerSupabase
      .from("jobs")
      .select("*")
      .order("date", { ascending: false });
    setJobs((data as Job[]) || []);
  }, []);

  const loadAppUsers = useCallback(async () => {
    const { data } = await schedulerSupabase.from("app_users").select("*").order("name");
    setAppUsers((data as AppUser[]) || []);
  }, []);

  const loadPendingRegs = useCallback(async () => {
    const { data } = await schedulerSupabase
      .from("pending_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    setPendingRegs((data as PendingRegistration[]) || []);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadBranches();
    loadStaff();
    loadJobs();
    loadAppUsers();
    if (currentUser.role === "admin") loadPendingRegs();
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const ch = schedulerSupabase
      .channel(`sched-db-${currentUser.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" },     () => loadJobs())
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" },    () => loadStaff())
      .on("postgres_changes", { event: "*", schema: "public", table: "branches" }, () => loadBranches())
      .on("postgres_changes", { event: "*", schema: "public", table: "app_users" },() => loadAppUsers())
      .on("postgres_changes", { event: "*", schema: "public", table: "pending_registrations" }, () => {
        if (currentUser.role === "admin") loadPendingRegs();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") loadJobs();
      });

    const refreshOnWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") loadJobs();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", refreshOnWake);
    if (typeof window   !== "undefined") window.addEventListener("online", refreshOnWake);

    return () => {
      schedulerSupabase.removeChannel(ch);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", refreshOnWake);
      if (typeof window   !== "undefined") window.removeEventListener("online", refreshOnWake);
    };
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin helpers ─────────────────────────────────────────────────────────────
  async function updateUserRole(userId: string, newRole: string) {
    const { error } = await schedulerSupabase.from("app_users").update({ role: newRole }).eq("id", userId);
    if (!error) await loadAppUsers();
    return error;
  }
  async function updateUserBranches(userId: string, branchIds: string[]) {
    const { error } = await schedulerSupabase.from("app_users").update({ branch_ids: branchIds }).eq("id", userId);
    if (!error) await loadAppUsers();
    return error;
  }
  async function toggleUserActive(userId: string, isActive: boolean) {
    const { error } = await schedulerSupabase.from("app_users").update({ is_active: isActive }).eq("id", userId);
    if (!error) await loadAppUsers();
    return error;
  }
  async function updateUserCanEdit(userId: string, canEdit: boolean) {
    const { error } = await schedulerSupabase.from("app_users").update({ can_edit: canEdit }).eq("id", userId);
    if (!error) await loadAppUsers();
    return error;
  }

  // ── Permission helpers ────────────────────────────────────────────────────────
  const isAdmin          = currentUser?.role === "admin";
  const isServiceManager = currentUser?.role === "service_manager";

  const VIEW_ONLY_ROLES = [
    "service_coordinator","senior_fse","junior_fse","field_service_engineer","trainee","employee",
  ];
  const isViewOnlyRole = VIEW_ONLY_ROLES.includes(currentUser?.role ?? "");

  const scopedBranchIds: string[] | null = isAdmin
    ? null
    : Array.from(
        new Set([
          ...(currentUser?.main_branch_id ? [currentUser.main_branch_id] : []),
          ...(currentUser?.edit_branch_ids || []),
          ...(currentUser?.branch_ids || []),
          ...(currentUser?.view_branch_ids || []),
        ])
      );

  const editableBranchIds: string[] | null = isAdmin
    ? null
    : isViewOnlyRole || currentUser?.can_edit === false
      ? []
      : (currentUser?.edit_branch_ids && currentUser.edit_branch_ids.length > 0)
        ? Array.from(
            new Set([
              ...(currentUser.main_branch_id ? [currentUser.main_branch_id] : []),
              ...currentUser.edit_branch_ids,
            ])
          )
        : currentUser?.main_branch_id
          ? Array.from(
              new Set([
                currentUser.main_branch_id,
                ...(currentUser.branch_ids || []).filter(
                  (id) => !(currentUser?.view_branch_ids || []).includes(id)
                ),
              ])
            )
          : (currentUser?.branch_ids || []).filter(
              (id) => !(currentUser?.view_branch_ids || []).includes(id)
            );

  function canEditBranch(branchId?: string | null): boolean {
    if (!currentUser) return false;
    if (isAdmin) return true;
    if (isViewOnlyRole) return false;
    if (currentUser.can_edit === false) return false;
    if (!branchId)
      return editableBranchIds === null || editableBranchIds.length > 0;
    if (editableBranchIds === null) return true;
    return editableBranchIds.includes(branchId);
  }

  function inScope(job: Job): boolean {
    if (!scopedBranchIds) return true;
    return scopedBranchIds.includes(job.branch_id);
  }
  function scopedBranches(): Branch[] {
    if (!scopedBranchIds) return branches;
    return branches.filter((b) => scopedBranchIds!.includes(b.id));
  }
  function visibleStaff(): StaffMember[] {
    const activeStaff = staff.filter(
      (s) => !s.name?.toLowerCase().includes("eileen")
    );
    if (!scopedBranchIds) return activeStaff;
    return activeStaff.filter((s) =>
      scopedBranchIds!.includes(s.home_branch_id)
    );
  }

  // ── Auth actions ──────────────────────────────────────────────────────────────
  async function signIn(email: string, password: string) {
    const { error } = await schedulerSupabase.auth.signInWithPassword({ email, password });
    return error;
  }
  async function signOut() {
    await schedulerSupabase.auth.signOut();
  }

  const pendingRegCount = pendingRegs.filter((r) => r.status === "pending").length;

  return (
    <SchedulerContext.Provider
      value={{
        currentUser, loading, signIn, signOut,
        branches, staff, jobs, appUsers, pendingRegs, pendingRegCount,
        loadBranches, loadStaff, loadJobs, loadAppUsers, loadPendingRegs,
        setBranches, setStaff, setJobs, setAppUsers,
        isAdmin, isServiceManager,
        scopedBranchIds, editableBranchIds,
        canEditBranch, inScope, scopedBranches, visibleStaff,
        updateUserRole, updateUserBranches, toggleUserActive, updateUserCanEdit,
        supabase: schedulerSupabase,
        supabaseSignup: schedulerSupabaseSignup,
      }}
    >
      {children}
    </SchedulerContext.Provider>
  );
}

export function useScheduler(): SchedulerContextValue {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error("useScheduler must be used within SchedulerProvider");
  return ctx;
}

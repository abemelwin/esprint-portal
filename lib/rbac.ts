/**
 * Two-level Role-Based Access Control (RBAC).
 *
 * LEVEL 1 — Portal level:
 *   - super_admin: sees everything, assigns module access + module admins.
 *   - user:        sees only the modules assigned to them.
 *
 * LEVEL 2 — Module level (per module):
 *   - Each user has a role WITHIN each module they can access.
 *   - A "module admin" for a given module can assign roles to other
 *     users inside that module (without bothering the super admin).
 *
 * This mirrors the existing Check Monitoring 14-role model so the
 * migrated module keeps identical behavior.
 */

import type { ModuleKey } from "./modules";

export type PortalRole = "super_admin" | "user";

/** The 14 roles that exist inside the Check Monitoring module. */
export type CheckRole =
  | "Super Admin"
  | "Admin"
  | "Operations"
  | "Acctg Head"
  | "AR Manager"
  | "AR Supervisor"
  | "AR Staff"
  | "Treasury Manager"
  | "Treasury Staff"
  | "Branch Manager"
  | "Branch AR/Finance Staff"
  | "Branch Staff"
  | "AE"
  | "AE Access";

/** A user's access to a single module. */
export interface ModuleAccess {
  module: ModuleKey;
  /** Role within the module (module-specific string). */
  role: string;
  /** Can this user manage other users' roles inside this module? */
  isModuleAdmin: boolean;
  /** Branch scope (for branch-scoped roles). Empty = all branches. */
  branches?: string[];
  /** AE codes this user can see / supervise (for AE + TL roles). */
  aes?: string[];
  /** Subsidiary scope (e.g. "ESPMI/APSI"). Optional, matches original. */
  subsidiary?: string;
}

/** The full identity of a logged-in portal user. */
export interface PortalUser {
  id: string;
  email: string;
  fullName: string;
  portalRole: PortalRole;
  /** All modules this user can access, with their per-module role. */
  access: ModuleAccess[];
}

// ─── Portal-level helpers ─────────────────────────────────────────

export function isSuperAdmin(user: PortalUser): boolean {
  return user.portalRole === "super_admin";
}

/** Modules this user is allowed to open. Super admin gets all. */
export function accessibleModules(user: PortalUser): ModuleKey[] {
  if (isSuperAdmin(user)) {
    return [
      "checks",
      "hris",
      "machines",
      "scheduler",
      "sales",
      "support",
    ];
  }
  return user.access.map((a) => a.module);
}

export function canAccessModule(user: PortalUser, module: ModuleKey): boolean {
  return isSuperAdmin(user) || user.access.some((a) => a.module === module);
}

/** Get the user's access record for a module (undefined if none). */
export function moduleAccessOf(
  user: PortalUser,
  module: ModuleKey
): ModuleAccess | undefined {
  return user.access.find((a) => a.module === module);
}

/** Is the user an admin OF a specific module (can manage its users)? */
export function isModuleAdmin(user: PortalUser, module: ModuleKey): boolean {
  if (isSuperAdmin(user)) return true;
  const acc = moduleAccessOf(user, module);
  return acc?.isModuleAdmin ?? false;
}

// ─── Check Monitoring role groups (ported from existing rbac.ts) ──

export const CHECK_ADMIN_ROLES: CheckRole[] = [
  "Super Admin",
  "Admin",
  "Operations",
  "Acctg Head",
  "AR Manager",
];

export const CHECK_CREATE_ROLES: CheckRole[] = [
  "Super Admin",
  "Admin",
  "Operations",
  "AR Manager",
  "AR Supervisor",
  "AR Staff",
  "Branch AR/Finance Staff",
];

export const CHECK_EDIT_ROLES: CheckRole[] = [
  "Super Admin",
  "Admin",
  "Operations",
  "AR Manager",
  "AR Supervisor",
  "AR Staff",
  "Treasury Manager",
  "Treasury Staff",
  "Branch Manager",
  "Branch AR/Finance Staff",
];

export const CHECK_VIEW_ONLY_ROLES: CheckRole[] = [
  "Branch Staff",
  "AE",
  "AE Access",
];

// ─── Machine Monitoring role groups ──────────────────────────────

export type MachineRole =
  | "inventory_accounting"
  | "sales_admin"
  | "asm"
  | "team_leader"
  | "account_exec"
  | "Super Admin"
  | "Admin";

export interface MachinePermissions {
  canEdit: boolean;
  canDelete: boolean;
  canReserve: boolean;
  canDeliver: boolean;
  canUnreserve: boolean;
  canManageLookups: boolean;
  canViewClient: boolean;
}

export function getMachinePermissions(user: PortalUser): MachinePermissions {
  if (isSuperAdmin(user)) {
    return {
      canEdit: true,
      canDelete: true,
      canReserve: true,
      canDeliver: true,
      canUnreserve: true,
      canManageLookups: true,
      canViewClient: true,
    };
  }

  const access = moduleAccessOf(user, "machines");
  if (!access) {
    return {
      canEdit: false,
      canDelete: false,
      canReserve: false,
      canDeliver: false,
      canUnreserve: false,
      canManageLookups: false,
      canViewClient: false,
    };
  }

  if (access.isModuleAdmin || access.role === "inventory_accounting" || access.role === "Admin" || access.role === "Super Admin") {
    return {
      canEdit: true,
      canDelete: true,
      canReserve: true,
      canDeliver: true,
      canUnreserve: true,
      canManageLookups: true,
      canViewClient: true,
    };
  }

  // sales_admin, asm, team_leader, account_exec
  return {
    canEdit: false,
    canDelete: false,
    canReserve: true,
    canDeliver: false,
    canUnreserve: false,
    canManageLookups: false,
    canViewClient: false, // hidden unless assigned
  };
}

// ─── Sales Portal role groups ────────────────────────────────────
// Mirrors the orig Vue app's role/permission system exactly.
// Source: Sales Portal/supabase/migrations/20250101000014_create_role_permissions.sql
//         + 20250101000015_add_create_quotes_column.sql
//         + 20250101000018_add_use_calculator_permission.sql

export type SalesRole =
  | "product_technical_head"
  | "product_development_manager"
  | "service_manager"
  | "sales_admin_manager"
  | "sales_admin_supervisor"
  | "sales_admin_assistant"
  | "area_sales_manager"
  | "account_executive"
  | "sales_assistant"
  | "user"
  // Legacy / display aliases
  | "Admin"
  | "product_manager"
  | "superadmin"
  | "Super Admin";

export interface SalesPermissions {
  // quote building
  canCreateQuotes: boolean;
  useCalculator: boolean;
  // catalog management
  canManageCatalog: boolean;
  canUploadCatalog: boolean;
  // product info / files
  canManageProductFiles: boolean;
  // admin
  canViewAllQuotes: boolean;
  canManageUsers: boolean;
}

// Role-group helpers (mirrors orig isSalesRole / isSalesAdminRole checks)
function isSalesGroup(role: string): boolean {
  return [
    "superadmin","sales_admin_manager","sales_admin_supervisor","sales_admin_assistant",
    "area_sales_manager","account_executive","sales_assistant","user",
    "Admin","Super Admin",
  ].includes(role);
}
function isProductTechGroup(role: string): boolean {
  return ["product_manager","product_technical_head","product_development_manager","service_manager"].includes(role);
}
function isSalesAdminGroup(role: string): boolean {
  return ["superadmin","sales_admin_manager","sales_admin_supervisor","area_sales_manager","Admin","Super Admin"].includes(role);
}

// Narrower group: only manager + supervisor get catalog edit/upload (NOT area_sales_manager)
function isCatalogAdminGroup(role: string): boolean {
  return ["superadmin","sales_admin_manager","sales_admin_supervisor","Admin","Super Admin"].includes(role);
}

export function getSalesPermissions(user: PortalUser): SalesPermissions {
  // Super admins get everything
  if (isSuperAdmin(user)) {
    return {
      canCreateQuotes: true, useCalculator: true,
      canManageCatalog: true, canUploadCatalog: true,
      canManageProductFiles: true, canViewAllQuotes: true, canManageUsers: true,
    };
  }

  const access = moduleAccessOf(user, "sales");
  if (!access) {
    return {
      canCreateQuotes: false, useCalculator: false,
      canManageCatalog: false, canUploadCatalog: false,
      canManageProductFiles: false, canViewAllQuotes: false, canManageUsers: false,
    };
  }

  // Module admin gets everything
  if (access.isModuleAdmin || access.role === "Admin" || access.role === "Super Admin") {
    return {
      canCreateQuotes: true, useCalculator: true,
      canManageCatalog: true, canUploadCatalog: true,
      canManageProductFiles: true, canViewAllQuotes: true, canManageUsers: true,
    };
  }

  const role = access.role ?? "user";

  // ── Exact permission matrix from orig Sales Portal ──────────────────────────
  // Source: role_permissions seed + permissions.ts fallback logic
  // sales roles: create_quotes=true, use_calculator=true
  // product/tech roles: create_quotes=false, use_calculator=true, manage_product_files=true,
  //                     edit_machine_catalog=true, upload_machine_catalog=true
  // sales_admin_manager/supervisor: edit_catalog=true, upload_catalog=true
  // manage_users: ONLY superadmin in orig (manage_users=false for all regular roles)

  const isSales        = isSalesGroup(role);
  const isProductTech  = isProductTechGroup(role);
  const isSalesAdmin   = isSalesAdminGroup(role); // manager, supervisor, asm
  const isCatalogAdmin = isCatalogAdminGroup(role); // manager, supervisor only

  return {
    // create_quotes: true for all sales roles; false for product/tech/service roles
    canCreateQuotes: isSales,

    // use_calculator: true for everyone (orig default = true, no role sets it false)
    useCalculator: true,

    // edit_machine_catalog: sales_admin_manager, sales_admin_supervisor + all product/tech
    canManageCatalog: isCatalogAdmin || isProductTech,

    // upload_machine_catalog: same groups as edit
    canUploadCatalog: isCatalogAdmin || isProductTech,

    // manage_product_files: ONLY product/tech group (orig: false for all sales roles)
    canManageProductFiles: isProductTech,

    // canViewAllQuotes: sales admin group (manager, supervisor, asm) can see all quotes
    canViewAllQuotes: isSalesAdmin,

    // manage_users: false for ALL regular roles in orig (only superadmin = portal super_admin)
    canManageUsers: false,
  };
}



// ─── Support Scheduler role groups ───────────────────────────────────────────

export type SchedulerRole =
  | "admin"
  | "service_manager"
  | "service_coordinator"
  | "senior_fse"
  | "junior_fse"
  | "field_service_engineer"
  | "trainee"
  | "employee"
  | "branch"
  | "Super Admin";

export interface SchedulerPermissions {
  /** Can create / edit / delete job tickets */
  canEditJobs: boolean;
  /** Can manage staff roster */
  canManageStaff: boolean;
  /** Can manage branches */
  canManageBranches: boolean;
  /** Can manage app users (grant access, set roles) */
  canManageUsers: boolean;
  /** Can view the multi-branch Overview tab */
  canViewOverview: boolean;
  /** Has read-only access (no mutations) */
  isReadOnly: boolean;
}

export function getSchedulerPermissions(
  user: PortalUser
): SchedulerPermissions {
  if (isSuperAdmin(user)) {
    return {
      canEditJobs: true,
      canManageStaff: true,
      canManageBranches: true,
      canManageUsers: true,
      canViewOverview: true,
      isReadOnly: false,
    };
  }

  const access = moduleAccessOf(user, "scheduler");
  if (!access) {
    return {
      canEditJobs: false,
      canManageStaff: false,
      canManageBranches: false,
      canManageUsers: false,
      canViewOverview: false,
      isReadOnly: true,
    };
  }

  const role = access.role as SchedulerRole;
  const isAdmin = access.isModuleAdmin || role === "admin";
  const isManagerOrCoord =
    role === "service_manager" || role === "service_coordinator";
  const isViewOnly =
    role === "senior_fse" ||
    role === "junior_fse" ||
    role === "field_service_engineer" ||
    role === "trainee" ||
    role === "employee";

  return {
    canEditJobs: isAdmin || role === "service_manager" || role === "branch",
    canManageStaff: isAdmin,
    canManageBranches: isAdmin,
    canManageUsers: isAdmin,
    canViewOverview: isAdmin || isManagerOrCoord,
    isReadOnly: isViewOnly,
  };
}

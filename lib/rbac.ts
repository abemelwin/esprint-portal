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
  /** AE codes this user can see (for AE roles). */
  aes?: string[];
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

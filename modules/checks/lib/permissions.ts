/**
 * Check Monitoring — permission helpers (ported from the original
 * esprint-check-monitoring/lib/rbac.ts, adapted to the portal).
 *
 * The original derived permissions from Supabase user_metadata. Here we
 * work from the CheckContext (role + branch/AE scope) produced by
 * app/(portal)/checks/lib/access.ts, but the ROLE GROUPS and rules are
 * kept identical so behavior matches the original system exactly.
 */

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

/** Roles that can view the Admin & Users page and manage users. */
export const ADMIN_ROLES: string[] = [
  "Super Admin", "Admin", "AR Manager", "AR Supervisor",
  "Treasury Manager", "Acctg Head", "Operations",
];

/** Roles that can create new checks. */
export const CREATE_ROLES: string[] = [
  "Super Admin", "Admin", "Branch Manager", "Acctg Head", "AR Manager",
  "AR Supervisor", "AR Staff", "Treasury Manager", "Treasury Staff",
];

/** Roles that can add/modify events on existing checks. */
export const EDIT_ROLES: string[] = [
  "Super Admin", "Admin", "Branch Manager", "Acctg Head", "AR Manager",
  "AR Supervisor", "AR Staff", "Treasury Manager", "Treasury Staff",
];

/** Roles that are view-only. */
export const VIEW_ONLY_ROLES: string[] = [
  "Branch Staff", "Branch AR/Finance Staff",
];

/** Scope of a user for permission checks. */
export interface CheckPerms {
  role: string;
  branches: string[]; // ['ALL'] or [] = all; else specific branch ids
  aes: string[]; // AE codes this user is restricted to
}

export function canCreate(perms: CheckPerms): boolean {
  return CREATE_ROLES.includes(perms.role);
}

export function canEdit(perms: CheckPerms): boolean {
  return EDIT_ROLES.includes(perms.role);
}

export function canManageUsers(perms: CheckPerms): boolean {
  return ADMIN_ROLES.includes(perms.role);
}

export function canDeleteCheck(perms: CheckPerms): boolean {
  return perms.role === "Super Admin" || perms.role === "Admin";
}

export function isSuperAdmin(perms: CheckPerms): boolean {
  return perms.role === "Super Admin";
}

export function isViewOnly(perms: CheckPerms): boolean {
  return VIEW_ONLY_ROLES.includes(perms.role);
}

export function isAEAccess(perms: CheckPerms): boolean {
  return perms.role === "AE Access";
}

/** All roles can write notes (mirrors original). */
export function canWriteNotes(_perms: CheckPerms): boolean {
  return true;
}

/**
 * Whether a user can see a specific check (branch OR AE match).
 * Mirrors the original canSeeCheck exactly.
 * Empty branches ([]) OR ['ALL'] means all branches.
 */
export function canSeeCheck(
  perms: CheckPerms,
  check: { branch: string; ae?: string | null }
): boolean {
  // AE / AE Access: can ONLY see checks assigned to their AE codes
  if (perms.role === "AE" || perms.role === "AE Access") {
    return perms.aes.length > 0 && !!check.ae && perms.aes.includes(check.ae);
  }
  const allBranches = perms.branches.length === 0 || perms.branches.includes("ALL");
  if (allBranches) return true;
  if (perms.branches.includes(check.branch)) return true;
  if (perms.aes.length > 0 && check.ae && perms.aes.includes(check.ae)) return true;
  return false;
}

/** Build CheckPerms from the CheckContext produced by access.ts. */
export function permsFromContext(ctx: {
  role: string;
  branches: string[];
  aes: string[];
}): CheckPerms {
  return { role: ctx.role, branches: ctx.branches, aes: ctx.aes };
}

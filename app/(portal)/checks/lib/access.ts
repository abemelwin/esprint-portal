/**
 * Check Monitoring — server-side access guard.
 *
 * Ensures the current user can open the checks module, and returns
 * their check-module role + scoping (branches / AE codes) for use in
 * data filtering and UI permission checks.
 */

import { cache } from "react";
import { getCurrentUser } from "@/lib/session";
import {
  canAccessModule,
  moduleAccessOf,
  isSuperAdmin,
  isModuleAdmin,
  type PortalUser,
} from "@/lib/rbac";

export interface CheckContext {
  user: PortalUser;
  role: string; // e.g. "Admin", "AR Staff", "AE"
  isAdmin: boolean; // module admin OR super admin
  branches: string[]; // branch scope ([] = all)
  aes: string[]; // AE code scope ([] = all)
}

/** Returns the check context, or null if the user has no access. Memoized per request. */
export const getCheckContext = cache(async (): Promise<CheckContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!canAccessModule(user, "checks")) return null;

  const access = moduleAccessOf(user, "checks");
  return {
    user,
    role: isSuperAdmin(user) ? "Super Admin" : access?.role ?? "View Only",
    isAdmin: isModuleAdmin(user, "checks"),
    branches: access?.branches ?? [],
    aes: access?.aes ?? [],
  };
});


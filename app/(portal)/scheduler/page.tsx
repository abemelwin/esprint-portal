import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { canAccessModule, isSuperAdmin, isModuleAdmin, getSchedulerPermissions } from "@/lib/rbac";
import { SchedulerClient } from "@/modules/scheduler/components/SchedulerClient";

export default async function SchedulerPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    redirect("/dashboard");
  }

  const perms       = getSchedulerPermissions(user);
  const isAdmin     = isSuperAdmin(user) || isModuleAdmin(user, "scheduler");
  const roleLabel   = isSuperAdmin(user)
    ? "Super Admin"
    : user.access.find(a => a.module === "scheduler")?.role ?? "Staff";

  // Map portal roles to scheduler display labels
  const roleDisplay: Record<string, string> = {
    admin:                  "Admin",
    service_manager:        "Service Manager",
    service_coordinator:    "Service Coordinator",
    senior_fse:             "Senior FSE",
    junior_fse:             "Junior FSE",
    field_service_engineer: "Junior FSE",
    trainee:                "Trainee",
    employee:               "Employee",
    branch:                 "Branch",
    "Super Admin":          "Super Admin",
  };

  return (
    <SchedulerClient
      userName={user.fullName}
      userRole={roleDisplay[roleLabel] ?? roleLabel}
      isAdmin={isAdmin}
      canEdit={perms.canEditJobs}
      canViewOverview={perms.canViewOverview}
    />
  );
}

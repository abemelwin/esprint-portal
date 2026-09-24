import { getCurrentUser } from "@/lib/session";
import { isModuleAdmin, isSuperAdmin } from "@/lib/rbac";
import { SchedulerClient } from "@/modules/scheduler/components/SchedulerClient";

export default async function SchedulerReportsPage() {
  const user = (await getCurrentUser())!;

  const isAdmin   = isSuperAdmin(user) || isModuleAdmin(user, "scheduler");
  const roleLabel = isSuperAdmin(user)
    ? "Super Admin"
    : user.access.find((a) => a.module === "scheduler")?.role || "Viewer";

  return (
    <SchedulerClient
      portalUserName={user.fullName}
      portalUserRole={roleLabel}
      isPortalAdmin={isAdmin}
      initialView="reports"
    />
  );
}

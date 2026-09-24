import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, isModuleAdmin, isSuperAdmin } from "@/lib/rbac";
import { SchedulerShell } from "@/modules/scheduler/components/scheduler-shell";
import { SchedulerProvider } from "@/modules/scheduler/lib/SchedulerContext";
import "@/modules/scheduler/scheduler.css";

export default async function SchedulerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    redirect("/dashboard");
  }

  const isAdmin   = isSuperAdmin(user) || isModuleAdmin(user, "scheduler");
  const roleLabel = isSuperAdmin(user)
    ? "Super Admin"
    : user.access.find((a) => a.module === "scheduler")?.role || "Viewer";

  return (
    <SchedulerProvider>
      <SchedulerShell
        userName={user.fullName}
        userRole={roleLabel}
        isAdmin={isAdmin}
      >
        {children}
      </SchedulerShell>
    </SchedulerProvider>
  );
}

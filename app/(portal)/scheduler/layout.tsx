import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import SessionKeepAlive from "@/components/session-keep-alive";

/**
 * Scheduler has its own full-page layout — no portal nav, no overflow:hidden.
 * The SchedulerTopNav handles its own sticky header.
 */
export default async function SchedulerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "scheduler")) {
    redirect("/dashboard");
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <SessionKeepAlive />
      {/* Scrollable content area — sticky header inside children handles itself */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

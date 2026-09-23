import { redirect } from "next/navigation";
import { getCheckContext } from "./lib/access";
import { PortalNav } from "@/components/portal-nav";
import { ChecksSidebar } from "@/modules/checks/components/checks-sidebar";
import { ToastProvider } from "@/modules/checks/components/Toast";
import { initialsOf } from "@/lib/utils";

/**
 * Check Monitoring module layout.
 * - Guards access (redirects to dashboard if user lacks the module).
 * - Renders the portal top nav + the module's own left sidebar.
 */
export default async function ChecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCheckContext();
  if (!ctx) {
    // No access to this module — bounce to portal home
    redirect("/dashboard");
  }

  // AE role gating (mirrors the original AppShell):
  //   - "AE"        = individual account executive (Client Report only)
  //   - "AE Access" = Team Leader account; a real TL manages >1 AE and also
  //                   gets the AE Dashboard.
  const isAE = ctx.role === "AE";
  const isAEAccess = ctx.role === "AE Access";
  const isTL = isAEAccess && ctx.aes.length > 1;

  return (
    <ToastProvider>
      <PortalNav
        userName={ctx.user.fullName}
        userRole={ctx.role}
        userInitials={initialsOf(ctx.user.fullName)}
        currentModule="Check Monitoring"
      />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <ChecksSidebar
          userName={ctx.user.fullName}
          userRole={ctx.role}
          isAdmin={ctx.isAdmin}
          isAE={isAE}
          isAEAccess={isAEAccess}
          isTL={isTL}
        />
        <div style={{ flex: 1, overflowY: "auto", background: "#eef4fb" }}>
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, isModuleAdmin, isSuperAdmin, getSalesPermissions } from "@/lib/rbac";
import { SalesShell } from "@/modules/sales/components/sales-shell";

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    redirect("/dashboard");
  }

  const perms    = getSalesPermissions(user);
  const isAdmin  = isSuperAdmin(user) || isModuleAdmin(user, "sales");
  const rawRole  = user.access.find((a) => a.module === "sales")?.role;
  const roleLabel = isAdmin || rawRole === "superadmin" || rawRole === "Super Admin" || rawRole === "Admin"
    ? "Admin"
    : rawRole || "Sales Executive";

  return (
    <SalesShell
      userName={user.fullName}
      userRole={roleLabel}
      isAdmin={isAdmin}
      canCreateQuotes={perms.canCreateQuotes}
      useCalculator={perms.useCalculator}
    >
      {children}
    </SalesShell>
  );
}

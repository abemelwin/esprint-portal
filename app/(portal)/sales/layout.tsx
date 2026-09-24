import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, isModuleAdmin, isSuperAdmin } from "@/lib/rbac";
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

  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "sales");
  const roleLabel = isSuperAdmin(user)
    ? "Super Admin"
    : user.access.find((a) => a.module === "sales")?.role || "Sales Executive";

  return (
    <SalesShell
      userName={user.fullName}
      userRole={roleLabel}
      isAdmin={isAdmin}
    >
      {children}
    </SalesShell>
  );
}

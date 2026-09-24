import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, isModuleAdmin, isSuperAdmin } from "@/lib/rbac";
import { MachinesShell } from "@/modules/machines/components/machines-shell";

export default async function MachinesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    redirect("/dashboard");
  }

  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "machines");
  const roleLabel = isSuperAdmin(user)
    ? "Super Admin"
    : user.access.find((a) => a.module === "machines")?.role || "Operator";

  return (
    <MachinesShell
      userName={user.fullName}
      userRole={roleLabel}
      isAdmin={isAdmin}
    >
      {children}
    </MachinesShell>
  );
}

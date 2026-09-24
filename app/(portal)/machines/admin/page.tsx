import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin, isModuleAdmin } from "@/lib/rbac";
import { AdminClient } from "@/modules/machines/components/AdminClient";

export default async function MachineAdminPage() {
  const user = (await getCurrentUser())!;
  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "machines");

  if (!isAdmin) {
    redirect("/machines");
  }

  return <AdminClient />;
}

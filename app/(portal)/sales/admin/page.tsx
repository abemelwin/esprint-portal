import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin, isModuleAdmin } from "@/lib/rbac";
import { AdminClient } from "@/modules/sales/components/AdminClient";

export default async function SalesAdminPage() {
  const user = (await getCurrentUser())!;
  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "sales");

  if (!isAdmin) {
    redirect("/sales");
  }

  return <AdminClient />;
}

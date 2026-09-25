import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getSalesPermissions } from "@/lib/rbac";
import { SalesUsersClient } from "@/modules/sales/components/SalesUsersClient";

export default async function SalesUsersPage() {
  const user = (await getCurrentUser())!;
  const perms = getSalesPermissions(user);

  if (!perms.canManageUsers) {
    redirect("/sales/quote-builder");
  }

  return <SalesUsersClient currentUserId={user.id} />;
}

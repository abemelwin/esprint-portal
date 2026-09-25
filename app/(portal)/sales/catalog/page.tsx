import { getCurrentUser } from "@/lib/session";
import { getSalesPermissions } from "@/lib/rbac";
import { CatalogClient } from "@/modules/sales/components/CatalogClient";

export default async function CatalogPage() {
  const user = await getCurrentUser();
  const canManage = user ? getSalesPermissions(user).canManageProductFiles : false;
  return <CatalogClient canManageFiles={canManage} />;
}

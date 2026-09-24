import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin, isModuleAdmin } from "@/lib/rbac";
import { TBAClient } from "@/modules/machines/components/TBAClient";

export default async function TBAPage() {
  const user = (await getCurrentUser())!;
  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "machines");

  return <TBAClient isAdmin={isAdmin} />;
}

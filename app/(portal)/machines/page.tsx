import { getCurrentUser } from "@/lib/session";
import { getMachinePermissions } from "@/lib/rbac";
import { MachinesClient } from "@/modules/machines/components/MachinesClient";

export default async function MachinesPage() {
  const user = (await getCurrentUser())!;
  const perms = getMachinePermissions(user);

  return <MachinesClient permissions={perms} userEmail={user.email} />;
}

import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin, isModuleAdmin, getMachinePermissions, moduleAccessOf } from "@/lib/rbac";
import { TBAClient } from "@/modules/machines/components/TBAClient";

export default async function TBAPage() {
  const user = (await getCurrentUser())!;
  const perms   = getMachinePermissions(user);
  const access  = moduleAccessOf(user, "machines");

  return (
    <TBAClient
      canReserve={perms.canReserve}
      canViewAllClients={perms.canViewClient}
      aeCode={access?.aes?.[0] ?? null}
      approvedAEs={access?.aes ?? []}
    />
  );
}

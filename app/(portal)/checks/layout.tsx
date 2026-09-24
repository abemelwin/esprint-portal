import { redirect } from "next/navigation";
import { getCheckContext } from "./lib/access";
import { ChecksShell } from "@/modules/checks/components/checks-shell";
import { ToastProvider } from "@/modules/checks/components/Toast";
import { canCreate, isViewOnly } from "@/modules/checks/lib/permissions";
import { permsFromContext } from "@/modules/checks/lib/permissions";

export default async function ChecksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCheckContext();
  if (!ctx) {
    redirect("/dashboard");
  }

  const isAE = ctx.role === "AE";
  const isAEAccess = ctx.role === "AE Access";
  const isTL = isAEAccess && ctx.aes.length > 1;
  const perms = permsFromContext(ctx);

  return (
    <ToastProvider>
      <ChecksShell
        userName={ctx.user.fullName}
        userRole={ctx.role}
        isAdmin={ctx.isAdmin}
        isAE={isAE}
        isAEAccess={isAEAccess}
        isTL={isTL}
        canCreate={canCreate(perms)}
        isViewOnly={isViewOnly(perms)}
      >
        {children}
      </ChecksShell>
    </ToastProvider>
  );
}

import { redirect } from "next/navigation";
import { getCheckContext } from "./lib/access";
import { ChecksShell } from "@/modules/checks/components/checks-shell";
import { ToastProvider } from "@/modules/checks/components/Toast";

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

  return (
    <ToastProvider>
      <ChecksShell
        userName={ctx.user.fullName}
        userRole={ctx.role}
        isAdmin={ctx.isAdmin}
        isAE={isAE}
        isAEAccess={isAEAccess}
        isTL={isTL}
      >
        {children}
      </ChecksShell>
    </ToastProvider>
  );
}

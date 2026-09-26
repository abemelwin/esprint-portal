import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import SessionKeepAlive from "@/components/session-keep-alive";

/**
 * Protected layout — everything under (portal) requires a logged-in
 * user. Unauthenticated users are redirected to /login.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", flexDirection: "column", background: "#f1f5f9" }}>
      <SessionKeepAlive />
      {children}
    </div>
  );
}

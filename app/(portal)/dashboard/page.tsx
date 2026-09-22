import { getCurrentUser } from "@/lib/session";
import { accessibleModules, moduleAccessOf, isSuperAdmin } from "@/lib/rbac";
import { MODULES } from "@/lib/modules";
import { PortalNav } from "@/components/portal-nav";
import { AppCard } from "@/components/app-card";
import { initialsOf } from "@/lib/utils";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!; // layout guarantees non-null

  const modules = accessibleModules(user).map((key) => MODULES[key]);
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <PortalNav
        userName={user.fullName}
        userRole={isSuperAdmin(user) ? "Super Admin" : "Portal User"}
        userInitials={initialsOf(user.fullName)}
      />

      <main style={{ flex: 1, overflowY: "auto", background: "#f8fafc", padding: "40px 48px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-.4px", marginBottom: 6 }}>
              Welcome back, {firstName}!
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              <span style={{ color: "#2563eb", fontWeight: 700 }}>ES Print Media Inc.</span> Business Operations Portal
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 15px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,.5)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>All systems operational</span>
          </div>
        </div>

        {/* Role notice for non-super-admins */}
        {!isSuperAdmin(user) && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "14px 18px", marginBottom: 24 }}>
            <svg width="18" height="18" fill="none" stroke="#3b82f6" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 500 }}>
              You have access to {modules.length} module{modules.length !== 1 ? "s" : ""}. Contact your administrator to request more.
            </p>
          </div>
        )}

        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Your Modules</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 18 }}>
          {modules.map((m) => {
            const access = moduleAccessOf(user, m.key);
            return (
              <AppCard
                key={m.key}
                module={m}
                roleLabel={access?.role}
                isModuleAdmin={access?.isModuleAdmin || isSuperAdmin(user)}
              />
            );
          })}
        </div>
      </main>
    </>
  );
}

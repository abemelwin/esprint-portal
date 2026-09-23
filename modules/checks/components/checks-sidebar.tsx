"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  section?: string;
  adminOnly?: boolean;
  aeOnly?: boolean; // Team Leader only (AE Dashboard)
}

const NAV: NavItem[] = [
  { href: "/checks/ae-dashboard", label: "AE Dashboard", aeOnly: true },
  { href: "/checks", label: "Dashboard", section: "OVERVIEW" },
  { href: "/checks/all", label: "All Checks" },
  { href: "/checks/reports/hold", label: "Hold Checks", section: "REPORTS" },
  { href: "/checks/reports/deposits", label: "Deposits" },
  { href: "/checks/reports/alteration", label: "Alteration" },
  { href: "/checks/reports/clients", label: "Client Report" },
  { href: "/checks/reports/penalty", label: "Penalty" },
  { href: "/checks/reports/reconstruct", label: "Reconstruct" },
  { href: "/checks/reports/bad-account", label: "Bad Account" },
  { href: "/checks/clients", label: "Clients", section: "DATA" },
  { href: "/checks/admin/import", label: "Bulk Import", section: "SETTINGS", adminOnly: true },
  { href: "/checks/admin/deleted", label: "Deleted Checks", adminOnly: true },
  { href: "/checks/admin/delete-requests", label: "Delete Requests", adminOnly: true },
  { href: "/checks/admin", label: "Admin & Users", adminOnly: true },
  { href: "/checks/admin/reference", label: "Reference Tables", section: "SYSTEM CONTROL", adminOnly: true },
];

interface ChecksSidebarProps {
  userName: string;
  userRole: string;
  isAdmin: boolean;
  branchLabel?: string;
  /** True when role === "AE" (individual account executive). */
  isAE?: boolean;
  /** True when role === "AE Access" (Team Leader account). */
  isAEAccess?: boolean;
  /** True when an AE Access account manages more than one AE (a TL). */
  isTL?: boolean;
}

export function ChecksSidebar({
  userName,
  userRole,
  isAdmin,
  branchLabel = "All branches",
  isAE = false,
  isAEAccess = false,
  isTL = false,
}: ChecksSidebarProps) {
  const pathname = usePathname();
  const items = NAV.filter((i) => {
    if (i.adminOnly && !isAdmin) return false;
    // AE Dashboard: Team Leaders only.
    if (i.aeOnly && !isTL) return false;
    // Plain AE role: only the Client Report is visible.
    if (isAE && i.href !== "/checks/reports/clients") return false;
    // AE Access (non-TL): only the Client Report.
    if (isAEAccess && !isTL && i.href !== "/checks/reports/clients") return false;
    // AE Access (TL): AE Dashboard + Client Report only.
    if (isAEAccess && isTL && !i.aeOnly && i.href !== "/checks/reports/clients") return false;
    return true;
  });

  return (
    <div style={{ width: 200, flexShrink: 0, background: "#0f172a", display: "flex", flexDirection: "column", overflowY: "auto", borderRight: "1px solid rgba(255,255,255,.07)" }}>
      <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>ES Print Media</p>
            <p style={{ fontSize: 9.5, color: "#94a3b8" }}>Hold &amp; Return Monitoring</p>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "4px 8px" }}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <div key={item.href}>
              {item.section && (
                <p style={{ padding: "10px 11px 4px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "#475569" }}>
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "7px 11px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: active ? "#fff" : "#94a3b8",
                  textDecoration: "none",
                  marginBottom: 1,
                  borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
                  background: active ? "linear-gradient(90deg,rgba(37,99,235,.25),rgba(37,99,235,.05))" : "transparent",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "8px 10px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</p>
            <p style={{ fontSize: 9.5, color: "#94a3b8" }}>{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

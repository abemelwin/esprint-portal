"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
  adminOnly?: boolean;
  aeOnly?: boolean; // Team Leader only (AE Dashboard)
}

const NAV: NavItem[] = [
  {
    href: "/checks/ae-dashboard",
    label: "AE Dashboard",
    icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
    aeOnly: true,
  },
  {
    href: "/checks",
    label: "Dashboard",
    icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
    section: "OVERVIEW",
  },
  {
    href: "/checks/all",
    label: "All Checks",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    href: "/checks/reports/hold",
    label: "Hold Checks",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    section: "REPORTS",
  },
  {
    href: "/checks/reports/deposits",
    label: "Deposits",
    icon: "M3 7h18M3 12h18M3 17h18",
  },
  {
    href: "/checks/reports/alteration",
    label: "Alteration",
    icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  },
  {
    href: "/checks/reports/clients",
    label: "Client Report",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0",
  },
  {
    href: "/checks/reports/penalty",
    label: "Penalty",
    icon: "M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  },
  {
    href: "/checks/reports/reconstruct",
    label: "Reconstruct",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  },
  {
    href: "/checks/reports/bad-account",
    label: "Bad Account",
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  {
    href: "/checks/clients",
    label: "Clients",
    icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z",
    section: "DATA",
  },
  {
    href: "/checks/admin/import",
    label: "Bulk Import",
    icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    section: "SETTINGS",
    adminOnly: true,
  },
  {
    href: "/checks/admin/deleted",
    label: "Deleted Checks",
    icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
    adminOnly: true,
  },
  {
    href: "/checks/admin",
    label: "Admin & Users",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
    adminOnly: true,
  },
  {
    href: "/checks/admin/reference",
    label: "Reference Tables",
    icon: "M4 6h16M4 10h16M4 14h16M4 18h16",
    section: "EXCLUSIVE SYSTEM CONTROL",
    adminOnly: true,
  },
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
  const [collapsed, setCollapsed] = useState(false);

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
    <div
      style={{
        width: collapsed ? 64 : 220,
        minWidth: collapsed ? 64 : 220,
        flexShrink: 0,
        background: "#0b1329",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,.07)",
        transition: "width 180ms ease, min-width 180ms ease",
      }}
    >
      {/* Header — Title: Hold & Return Monitoring */}
      <div
        style={{
          padding: collapsed ? "14px 8px" : "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 6,
        }}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            ▶
          </button>
        ) : (
          <>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: "#f8fafc",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                Hold &amp; Return Monitoring
              </p>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 6,
                color: "#94a3b8",
                cursor: "pointer",
                padding: "3px 6px",
                fontSize: 10.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ◀
            </button>
          </>
        )}
      </div>

      <nav style={{ flex: 1, padding: collapsed ? "8px 6px" : "8px 10px" }}>
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <div key={item.href}>
              {item.section && !collapsed && (
                <p
                  style={{
                    padding: "12px 10px 4px",
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    color: "#475569",
                  }}
                >
                  {item.section}
                </p>
              )}
              {item.section && collapsed && (
                <div style={{ margin: "6px 4px", borderTop: "1px solid rgba(255,255,255,0.07)" }} />
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: collapsed ? 0 : 10,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "9px 0" : "7.5px 11px",
                  borderRadius: 9,
                  fontSize: 12,
                  color: active ? "#ffffff" : "#94a3b8",
                  textDecoration: "none",
                  marginBottom: 2,
                  background: active ? "rgba(37,99,235,.35)" : "transparent",
                  border: active ? "1px solid rgba(59,130,246,.3)" : "1px solid transparent",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke={active ? "#60a5fa" : "#64748b"}
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  style={{ flexShrink: 0 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {!collapsed && (
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.label}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div style={{ padding: collapsed ? "8px 6px" : 10, borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div
          title={collapsed ? `${userName} (${userRole})` : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 9,
            justifyContent: collapsed ? "center" : "flex-start",
            background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.07)",
            borderRadius: 10,
            padding: collapsed ? "6px 0" : "8px 10px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#f1f5f9",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.2,
                }}
              >
                {userName}
              </p>
              <p style={{ fontSize: 9.5, color: "#94a3b8" }}>{userRole}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

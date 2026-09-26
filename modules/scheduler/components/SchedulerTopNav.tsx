"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

function getDropdownItemStyle(theme: "light" | "dark"): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    border: "none",
    background: "transparent",
    color: theme === "dark" ? "#e2e8f0" : "#334155",
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: "background .15s",
  };
}

interface Props {
  view: string;
  setView: (v: string) => void;
  userName: string;
  userRole: string;
  isAdmin: boolean;
  canViewOverview: boolean;
  pendingCount?: number;
  onApprovals?: () => void;
  onStaff?: () => void;
  onBranch?: () => void;
  onUsers?: () => void;
  onExport?: () => void;
  onImport?: () => void;
}

export function SchedulerTopNav({
  view, setView, userName, userRole, isAdmin, canViewOverview,
  pendingCount = 0, onApprovals, onStaff, onBranch, onUsers,
  onExport, onImport,
}: Props) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(current);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    setTheme(next);
  }

  const tabs = [
    { key: "calendar", icon: "📅", label: "Schedule" },
    { key: "reports",  icon: "📊", label: "Reports"  },
    ...(canViewOverview ? [{ key: "overview", icon: "🗺", label: "Overview" }] : []),
  ];

  const isDark = theme === "dark";

  return (
    <div style={{ flexShrink: 0, zIndex: 40 }}>
      {/* ── Main header row ──────────────────────────────────────── */}
      <header
        className="sch-header"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 18px",
          background: isDark ? "#0f172a" : "#fff",
          color: isDark ? "#f8fafc" : "#0f172a",
          borderBottom: isDark ? "1px solid rgba(255,255,255,.1)" : "1px solid rgba(15,23,42,.08)",
          boxShadow: "0 1px 2px rgba(15,23,42,.05)",
          flexWrap: "nowrap", overflowX: "auto",
          transition: "background .2s, border-color .2s",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <Link href="/dashboard" title="Back to Portal Home" style={{ flexShrink: 0 }}>
            <Image
              src="/logo.jpg"
              alt="ES Print Logo"
              width={40}
              height={40}
              className="rounded-full object-cover"
              style={{ border: "1.5px solid rgba(15,23,42,.1)", boxShadow: "0 2px 8px rgba(0,0,0,.18)" }}
            />
          </Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isDark ? "#f8fafc" : "#0f172a", letterSpacing: "-0.01em" }}>
                Support Team Scheduler
              </h1>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 10.5, fontWeight: 600, color: isDark ? "#94a3b8" : "#64748b",
                  background: isDark ? "#1e293b" : "#f1f5f9",
                  border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
                  borderRadius: 4, padding: "2px 7px", textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}
              >← Portal Home</Link>
            </div>
            <div style={{ fontSize: 11.5, color: isDark ? "#94a3b8" : "#64748b", marginTop: 1, fontWeight: 500 }}>
              ES Print Group of Companies · Field Service
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* User chip + signout */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div className="sch-user-chip" style={{
            background: isDark ? "#1e293b" : undefined,
            borderColor: isDark ? "#334155" : undefined,
            color: isDark ? "#f8fafc" : undefined,
          }}>
            <span className="urole">{userRole}</span>
            <span className="uname" style={{ color: isDark ? "#f8fafc" : undefined }}>{userName}</span>
          </div>
          <button type="button" className="sch-btn-signout" onClick={handleLogout}>⏻ Sign out</button>
        </div>
      </header>

      {/* ── Tab sub-nav row (directly below header) ──────────────── */}
      <div
        className="sch-subnav"
        style={{
          display: "flex", alignItems: "center",
          padding: "0 18px",
          background: isDark ? "#0f172a" : "#fff",
          borderBottom: isDark ? "1px solid rgba(255,255,255,.1)" : "1px solid rgba(15,23,42,.08)",
          transition: "background .2s, border-color .2s",
        }}
      >
        {tabs.map(t => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setView(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px",
                border: "none",
                borderBottom: active ? "2px solid #2563eb" : "2px solid transparent",
                background: "transparent",
                color: active ? "#2563eb" : isDark ? "#94a3b8" : "#64748b",
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}

        {/* ⚙️ Settings Tab (Katabi ng Overview, walang arrow) */}
        {isAdmin && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setSettingsOpen(o => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px",
                border: "none",
                borderBottom: settingsOpen ? "2px solid #2563eb" : "2px solid transparent",
                background: "transparent",
                color: settingsOpen ? "#2563eb" : isDark ? "#94a3b8" : "#64748b",
                fontWeight: settingsOpen ? 700 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "inherit",
                marginBottom: -1,
              }}
            >
              <span>⚙️</span>
              <span>Settings</span>
              {pendingCount > 0 && (
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block", marginLeft: 2
                }} />
              )}
            </button>

            {settingsOpen && (
              <div
                className="sch-dropdown-popover"
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  width: 220,
                  background: isDark ? "#1e293b" : "#ffffff",
                  border: isDark ? "1px solid rgba(255,255,255,.15)" : "1px solid rgba(15,23,42,.12)",
                  borderRadius: 10,
                  boxShadow: isDark
                    ? "0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.3)"
                    : "0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)",
                  zIndex: 100,
                  padding: "6px 0",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{
                  padding: "6px 14px", fontSize: 11, fontWeight: 700,
                  color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  Scheduler Management
                </div>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onUsers?.(); }}
                >
                  <span>🔑</span> Users & Permissions
                </button>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onApprovals?.(); }}
                >
                  <span>📋</span> Registration Approvals
                  {pendingCount > 0 && (
                    <span style={{
                      marginLeft: "auto", background: "#ef4444", color: "#fff",
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10
                    }}>{pendingCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onStaff?.(); }}
                >
                  <span>👥</span> Staff Directory
                </button>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onBranch?.(); }}
                >
                  <span>🏢</span> Branches List
                </button>
                <div style={{ height: 1, background: isDark ? "#334155" : "#f1f5f9", margin: "4px 0" }} />
                <div style={{
                  padding: "6px 14px", fontSize: 11, fontWeight: 700,
                  color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  Data Transfer
                </div>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onImport?.(); }}
                >
                  <span>⤓</span> Import Schedule JSON
                </button>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { setSettingsOpen(false); onExport?.(); }}
                >
                  <span>⤒</span> Export Schedule JSON
                </button>
                <div style={{ height: 1, background: isDark ? "#334155" : "#f1f5f9", margin: "4px 0" }} />
                <div style={{
                  padding: "6px 14px", fontSize: 11, fontWeight: 700,
                  color: isDark ? "#64748b" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  Appearance
                </div>
                <button
                  type="button"
                  style={getDropdownItemStyle(theme)}
                  onClick={() => { toggleTheme(); }}
                >
                  <span>{isDark ? "☀️" : "🌙"}</span> {isDark ? "Light Mode" : "Dark Mode"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


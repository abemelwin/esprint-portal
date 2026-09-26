"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
    setTheme(current);
    const observer = new MutationObserver(() => {
      const updated = (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light";
      setTheme(updated);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Close settings panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
      {/* ── Main header row ── */}
      <header
        className="h-[52px] flex items-center justify-between px-3 sm:px-4 sticky top-0 z-40 select-none shadow-xs transition-colors duration-200"
        style={{
          background: isDark ? "#0f172a" : "#ffffff",
          borderBottom: isDark ? "1px solid rgba(255,255,255,.1)" : "1px solid #e2e8f0",
        }}
      >
        {/* Left: ES Logo + ES Print Media Inc. + Subtitle + Chevron > + Module Title + Portal Home link */}
        <div className="flex items-center gap-2">
          {/* ES Print Logo */}
          <Link href="/dashboard" title="Back to Portal Home" className="shrink-0 hover:opacity-90 transition-opacity">
            <Image
              src="/logo.jpg"
              alt="ES Print Logo"
              width={36}
              height={36}
              className="rounded-full object-cover"
              style={{ border: isDark ? "1px solid #334155" : "1px solid #cbd5e1" }}
            />
          </Link>

          <div>
            <h1
              className="text-[13.5px] font-extrabold leading-tight"
              style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
            >
              ES Print Media Inc.
            </h1>
            <p
              className="text-[10px] font-medium leading-none mt-0.5 hidden sm:block"
              style={{ color: isDark ? "#94a3b8" : "#94a3b8" }}
            >
              Business Operations Portal
            </p>
          </div>

          {/* Chevron Divider > */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? "#475569" : "#cbd5e1"} strokeWidth="2" className="mx-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>

          {/* Module Title */}
          <Link
            href="/scheduler"
            className="text-[13.5px] font-bold transition-colors hover:text-blue-500"
            style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}
          >
            Support Team Scheduler
          </Link>

          {/* Compact Portal Home Button */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-semibold rounded px-2 py-0.5 transition-colors ml-1"
            style={{
              background: isDark ? "#1e293b" : "#f1f5f9",
              border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
              color: isDark ? "#cbd5e1" : "#475569",
            }}
            title="Return to Business Operations Portal Home"
          >
            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Portal Home</span>
          </Link>
        </div>

        {/* Right: User + Action Buttons */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* User badge */}
          <span
            className="hidden md:block text-[11.5px] font-semibold mr-1"
            style={{ color: isDark ? "#e2e8f0" : "#334155" }}
          >
            {userName} <span style={{ color: isDark ? "#64748b" : "#94a3b8", fontWeight: 400 }}>· {userRole}</span>
          </span>

          {/* Bell / Notifications */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded shadow-2xs transition-colors cursor-pointer"
            style={{
              background: isDark ? "#1e293b" : "#ffffff",
              border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
              color: isDark ? "#cbd5e1" : "#475569",
            }}
            title="Notifications"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1 rounded font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
            style={{
              background: isDark ? "#1e293b" : "#ffffff",
              border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
              color: isDark ? "#cbd5e1" : "#334155",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Tab sub-nav row (directly below header) ──────────────── */}
      <div
        className="sch-subnav flex items-center px-4 border-b transition-colors duration-200"
        style={{
          background: isDark ? "#0f172a" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,.1)" : "#e2e8f0",
        }}
      >
        {tabs.map(t => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setView(t.key);
                setSettingsOpen(false);
              }}
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

        {/* ⚙️ Settings Tab */}
        {isAdmin && (
          <div ref={settingsRef} style={{ position: "relative" }}>
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
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
                  onClick={() => { setSettingsOpen(false); onUsers?.(); }}
                >
                  <span>🔑</span> Users &amp; Permissions
                </button>
                <button
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
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
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
                  onClick={() => { setSettingsOpen(false); onStaff?.(); }}
                >
                  <span>👥</span> Staff Directory
                </button>
                <button
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
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
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
                  onClick={() => { setSettingsOpen(false); onImport?.(); }}
                >
                  <span>⤓</span> Import Schedule JSON
                </button>
                <button
                  type="button"
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
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
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                    border: "none", background: "transparent", color: isDark ? "#e2e8f0" : "#334155",
                    fontSize: 12.5, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%"
                  }}
                  onClick={() => { toggleTheme(); setSettingsOpen(false); }}
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



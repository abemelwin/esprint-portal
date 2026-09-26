"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  view: string;
  setView: (v: string) => void;
  userName: string;
  userRole: string;
  canViewOverview: boolean;
  isAdmin: boolean;
}

export function SchedulerTopNav({
  view, setView, userName, userRole, canViewOverview, isAdmin,
}: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function toggleTheme() {
    const html = document.documentElement;
    html.setAttribute("data-theme", html.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  return (
    <header
      className="sticky top-0 z-40 select-none"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: "#fff",
        borderBottom: "1px solid rgba(15,23,42,.08)",
        boxShadow: "0 1px 2px rgba(15,23,42,.05)",
        overflowX: "auto",
        flexWrap: "nowrap",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <Link href="/dashboard" title="Back to Portal Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpg"
            alt="ES Print Logo"
            width={40}
            height={40}
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1.5px solid rgba(15,23,42,.1)",
              boxShadow: "0 2px 8px rgba(0,0,0,.18)",
              display: "block",
            }}
          />
        </Link>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>
              Support Team Scheduler
            </h1>
            <Link
              href="/dashboard"
              style={{
                fontSize: 10.5, fontWeight: 600, color: "#64748b",
                background: "#f1f5f9", border: "1px solid #e2e8f0",
                borderRadius: 4, padding: "2px 7px", textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 3,
              }}
            >
              ← Portal Home
            </Link>
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1, fontWeight: 500 }}>
            ES Print Group of Companies · Field Service
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sch-tabs" style={{ flexShrink: 0 }}>
        <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>
          📅 Schedule
        </button>
        <button className={view === "reports" ? "active" : ""} onClick={() => setView("reports")}>
          📊 Reports
        </button>
        {canViewOverview && (
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
            🗺 Overview
          </button>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          style={{
            background: "transparent", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontSize: 15,
          }}
          title="Toggle light/dark"
          onClick={toggleTheme}
        >🌓</button>

        <div className="sch-user-chip">
          <span className="urole">{userRole}</span>
          <span className="uname">{userName}</span>
        </div>

        <button
          type="button"
          className="sch-btn-signout"
          onClick={handleLogout}
        >
          ⏻ Sign out
        </button>
      </div>
    </header>
  );
}

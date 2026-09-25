"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
    const current = html.getAttribute("data-theme");
    html.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  }

  return (
    <header
      className="sticky top-0 z-40 select-none"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: "color-mix(in srgb, var(--sch-s1) 85%, transparent)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--sch-border)",
        boxShadow: "0 1px 2px rgba(15,23,42,.05)",
        overflowX: "auto",
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
            style={{ borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--sch-border)", boxShadow: "0 2px 8px rgba(0,0,0,.18)" }}
          />
        </Link>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--sch-ink1)" }}>
              Support Team Scheduler
            </h1>
            <Link
              href="/dashboard"
              style={{ fontSize: 10.5, fontWeight: 600, color: "var(--sch-muted)", background: "var(--sch-s2)", border: "1px solid var(--sch-border)", borderRadius: 4, padding: "2px 7px", textDecoration: "none" }}
            >
              ← Portal Home
            </Link>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--sch-muted)", marginTop: 1, fontWeight: 500 }}>
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

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {/* Theme toggle */}
        <button
          type="button"
          className="sch-btn ghost"
          style={{ padding: "6px 8px" }}
          title="Toggle light/dark"
          onClick={toggleTheme}
        >🌓</button>

        {/* User chip */}
        <div className="sch-user-chip">
          <span className="urole">{userRole}</span>
          <span className="uname">{userName}</span>
        </div>

        {/* Sign out */}
        <button
          type="button"
          className="sch-btn-signout"
          onClick={handleLogout}
          title="Sign out"
        >
          ⏻ <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}

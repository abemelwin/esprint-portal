"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

interface PortalNavProps {
  userName: string;
  userRole: string;
  userInitials: string;
  /** Current module name shown in breadcrumb (empty on dashboard). */
  currentModule?: string;
}

export function PortalNav({ userName, userRole, userInitials, currentModule }: PortalNavProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      style={{
        flexShrink: 0,
        height: 52,
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        gap: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        zIndex: 20,
      }}
    >
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
          <img src="/logo.jpg" alt="ES Print Media Inc." style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>ES Print Media Inc.</p>
          <p style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 500 }}>Business Operations Portal</p>
        </div>
      </Link>

      {currentModule && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <svg width="12" height="12" fill="none" stroke="#cbd5e1" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{currentModule}</span>
          </div>
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 12px", textDecoration: "none", marginLeft: 4 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Portal Home
          </Link>
        </>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 10px", borderRadius: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800 }}>{userInitials}</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", lineHeight: 1.2 }}>{userName}</p>
          <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500 }}>{userRole}</p>
        </div>
      </div>

      <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#ef4444", border: "1.5px solid #fecaca", borderRadius: 9, padding: "6px 14px", background: "#fff", cursor: "pointer", marginLeft: 4 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        Logout
      </button>
    </header>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const DEMO_ROLES = [
  {
    email: "admin@esprint.com",
    label: "System Admin",
    desc: "All modules unlocked",
    badge: "All modules",
    badgeBg: "#dbeafe",
    badgeColor: "#1d4ed8",
    avatar: "AD",
    avatarBg: "linear-gradient(135deg,#2563eb,#4f46e5)",
  },
  {
    email: "checkadmin@esprint.com",
    label: "Check Admin",
    desc: "Check Monitoring — manage users",
    badge: "Checks (Admin)",
    badgeBg: "#dcfce7",
    badgeColor: "#166534",
    avatar: "CA",
    avatarBg: "linear-gradient(135deg,#16a34a,#15803d)",
  },
  {
    email: "arstaff@esprint.com",
    label: "AR Staff",
    desc: "Check Monitoring — Makati branch",
    badge: "Checks (AR Staff)",
    badgeBg: "#fef9c3",
    badgeColor: "#854d0e",
    avatar: "AR",
    avatarBg: "linear-gradient(135deg,#c0392b,#e74c3c)",
  },
];

// In production (Cognito) mode we hide the dev demo-role shortcuts.
const IS_DEV_MODE = process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill email from last login
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lastLoginEmail") || localStorage.getItem("last_login_email");
      if (saved) setEmail(saved);
    } catch { /* ignore */ }
  }, []);

  // ── New-password challenge state (first login with temp password) ──
  const [needNewPassword, setNeedNewPassword] = useState(false);
  const [challengeSession, setChallengeSession] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleLogin() {
    setError("");
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));

      // First login: Cognito requires the user to set a new password.
      if (res.status === 403 && data.newPasswordRequired) {
        setChallengeSession(data.session ?? "");
        setNeedNewPassword(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Incorrect email or password.");
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem("lastLoginEmail", trimmedEmail);
        localStorage.setItem("last_login_email", trimmedEmail);
      } catch { /* ignore */ }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSetNewPassword() {
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword, session: challengeSession }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.restart) {
        // Session expired — send the user back to the normal login.
        setNeedNewPassword(false);
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setError(data.error ?? "Session expired. Please sign in again.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Could not set the new password.");
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem("lastLoginEmail", email.trim());
        localStorage.setItem("last_login_email", email.trim());
      } catch { /* ignore */ }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", overflow: "hidden" }}>
      {/* LEFT PANEL */}
      <div className="hidden lg:flex" style={{ width: "52%", position: "relative", overflow: "hidden", background: "linear-gradient(160deg,#03081A 0%,#061530 35%,#0A2A5C 70%,#0D3575 100%)", flexDirection: "column" }}>
        <div style={{ position: "absolute", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,.2) 0%,transparent 65%)", top: -160, right: -160 }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, overflow: "hidden", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.22)" }}>
              <img src="/logo.jpg" alt="ES Print Media Inc." style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div>
              <p style={{ color: "#fff", fontWeight: 900, fontSize: 16.5, letterSpacing: "-.3px", lineHeight: 1.2 }}>ES Print Media Inc.</p>
              <p style={{ color: "rgba(147,197,253,.6)", fontSize: 11, marginTop: 2, fontWeight: 500 }}>Business Operations Portal</p>
            </div>
          </div>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(37,99,235,.18)", border: "1px solid rgba(59,130,246,.35)", borderRadius: 999, padding: "5px 14px", marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 8px rgba(96,165,250,.8)" }} />
              <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 600, letterSpacing: ".04em" }}>Unified Business Platform</span>
            </div>
            <h2 style={{ color: "#fff", fontSize: 40, fontWeight: 900, lineHeight: 1.12, letterSpacing: "-.8px", marginBottom: 14 }}>One login.<br /><span style={{ background: "linear-gradient(90deg,#93c5fd,#c4b5fd,#6ee7b7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>All your systems.</span></h2>
            <p style={{ color: "rgba(148,163,184,.75)", fontSize: 13.5, lineHeight: 1.7 }}>A secure, unified gateway for ES Print Media Inc. — giving every team member access to exactly the tools they need.</p>
          </div>
          <p style={{ color: "rgba(148,163,184,.35)", fontSize: 10.5 }}>© 2026 ES Print Media Inc. All rights reserved.</p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: 40, overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 999, padding: "4px 12px", marginBottom: 16 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0ea5e9" }} />
              <span style={{ color: "#0369a1", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em" }}>PORTAL ACCESS</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", letterSpacing: "-.5px", marginBottom: 6 }}>
              {needNewPassword ? "Set a new password" : "Welcome back"}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
              {needNewPassword
                ? "This is your first sign-in. Please choose a new password to continue."
                : <>Sign in to access the ES Print Media Inc.<br />Business Operations Portal.</>}
            </p>
          </div>

          {needNewPassword ? (
            /* ── NEW PASSWORD FORM (first login) ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".03em" }}>New password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSetNewPassword()} placeholder="••••••••" autoFocus style={{ width: "100%", border: "2px solid #f1f5f9", borderRadius: 11, padding: "12px 16px", fontSize: 13.5, outline: "none", background: "#fafafa" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".03em" }}>Confirm new password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSetNewPassword()} placeholder="••••••••" style={{ width: "100%", border: "2px solid #f1f5f9", borderRadius: 11, padding: "12px 16px", fontSize: 13.5, outline: "none", background: "#fafafa" }} />
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>At least 8 characters, with uppercase, lowercase, a number, and a symbol.</p>
              {error && (
                <div style={{ fontSize: 12.5, color: "#dc2626", background: "#fef2f2", border: "1.5px solid #fecaca", padding: "10px 14px", borderRadius: 10 }}>{error}</div>
              )}
              <button onClick={handleSetNewPassword} disabled={loading} style={{ width: "100%", padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, color: "#fff", border: "none", cursor: loading ? "wait" : "pointer", background: "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)", boxShadow: "0 4px 16px rgba(37,99,235,.4)", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Saving..." : "Save & Sign In  →"}
              </button>
            </div>
          ) : (
            /* ── NORMAL LOGIN FORM ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".03em" }}>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="yourname@esprintmedia.com" style={{ width: "100%", border: "2px solid #f1f5f9", borderRadius: 11, padding: "12px 16px", fontSize: 13.5, outline: "none", color: "#1e293b", background: "#fafafa" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: ".03em" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} placeholder="••••••••" style={{ width: "100%", border: "2px solid #f1f5f9", borderRadius: 11, padding: "12px 16px", fontSize: 13.5, outline: "none", background: "#fafafa" }} />
              </div>
              {error && (
                <div style={{ fontSize: 12.5, color: "#dc2626", background: "#fef2f2", border: "1.5px solid #fecaca", padding: "10px 14px", borderRadius: 10 }}>{error}</div>
              )}
              <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 800, color: "#fff", border: "none", cursor: loading ? "wait" : "pointer", background: "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)", boxShadow: "0 4px 16px rgba(37,99,235,.4)", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Signing in..." : "Sign In  →"}
              </button>
            </div>
          )}

          {IS_DEV_MODE && !needNewPassword && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
                <span style={{ fontSize: 10.5, color: "#cbd5e1", fontWeight: 700, letterSpacing: ".04em" }}>DEMO ROLES (DEV MODE)</span>
                <div style={{ flex: 1, height: 1, background: "#f1f5f9" }} />
              </div>

              <div style={{ border: "1.5px solid #f1f5f9", borderRadius: 14, overflow: "hidden" }}>
                {DEMO_ROLES.map((r, i) => (
                  <div key={r.email} onClick={() => { setEmail(r.email); setPassword("demo"); }} style={{ padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: i < DEMO_ROLES.length - 1 ? "1px solid #f9fafb" : "none", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: r.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800 }}>{r.avatar}</div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{r.label}</p>
                        <p style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>{r.desc}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, background: r.badgeBg, color: r.badgeColor, padding: "3px 10px", borderRadius: 999 }}>{r.badge}</span>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: "center", fontSize: 11, color: "#cbd5e1", marginTop: 20 }}>Click a demo role, then Sign In. (Any password works in dev mode.)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

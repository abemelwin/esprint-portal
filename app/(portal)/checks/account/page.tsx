"use client";
/**
 * /account — My Account & Change Password page.
 * Ported from esprint-check-monitoring/app/account/page.tsx.
 * Uses Cognito /api/auth/change-password instead of Supabase.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const router = useRouter();

  // User info — fetched from /api/auth/me
  const [user, setUser] = useState<{
    fullName: string; email: string; role: string; branches: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.user) {
          const u = d.user;
          const checks = (u.access ?? []).find((a: any) => a.module === "checks");
          setUser({
            fullName: u.fullName ?? u.email ?? "—",
            email:    u.email ?? "—",
            role:     u.portalRole === "super_admin" ? "Super Admin" : (checks?.role ?? "User"),
            branches: checks?.branches ?? [],
          });
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  // Password form state
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [showPw,     setShowPw]     = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(false);
    if (newPw.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (newPw !== confirmPw) { setError("New passwords do not match."); return; }
    setSaving(true);
    try {
      const res  = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        setSuccess(true);
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setError(data.error ?? "Failed to change password.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400";
  const lbl = "block text-xs font-semibold text-gray-600 mb-1.5";

  if (!user) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading account…
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-6 max-w-lg space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500">View your account details and change your password.</p>
      </div>

      {/* Account info card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-800">Account Details</h2>
        <div className="grid grid-cols-1 gap-3">
          {/* Avatar + name + email */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center text-white font-bold text-base shrink-0">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{user.fullName}</div>
              <div className="text-xs text-gray-500 truncate">{user.email}</div>
            </div>
          </div>
          {/* Role + Branch tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Role</div>
              <div className="text-sm font-semibold text-gray-800">{user.role}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Branch Access</div>
              <div className="text-sm font-semibold text-gray-800 truncate">
                {user.branches.length === 0 || user.branches.includes("ALL")
                  ? "All branches"
                  : user.branches.join(", ")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change password card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-800 mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} noValidate className="space-y-4">
          <div>
            <label className={lbl}>Current password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className={inp + " pr-16"}
                placeholder="Enter current password"
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 hover:text-blue-800">
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className={lbl}>New password <span className="text-red-500">*</span></label>
            <input
              type={showPw ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className={inp}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label className={lbl}>Confirm new password <span className="text-red-500">*</span></label>
            <input
              type={showPw ? "text" : "password"}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className={inp}
              placeholder="Repeat new password"
              autoComplete="new-password"
              required
            />
            {confirmPw && newPw && confirmPw !== newPw && (
              <p className="text-[11px] text-red-500 mt-1">Passwords do not match.</p>
            )}
            {confirmPw && newPw && confirmPw === newPw && (
              <p className="text-[11px] text-green-600 mt-1">✓ Passwords match.</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 font-semibold">
              ✓ Password changed successfully!
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving || !currentPw || !newPw || !confirmPw || newPw !== confirmPw}
              className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

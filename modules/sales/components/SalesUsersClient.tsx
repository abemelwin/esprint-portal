"use client";

import { useState, useEffect, useMemo, Fragment } from "react";

// Mirrors orig UserManagementView.vue roles
const SALES_ROLES = [
  { value: "Admin",                 label: "Super Admin / Admin" },
  { value: "sales_admin_manager",   label: "Sales Admin Manager" },
  { value: "sales_admin_supervisor", label: "Sales Admin Supervisor" },
  { value: "sales_admin_assistant", label: "Sales Admin Assistant" },
  { value: "area_sales_manager",    label: "Area Sales Manager" },
  { value: "account_executive",     label: "Account Executive" },
  { value: "sales_assistant",       label: "Sales Assistant" },
  { value: "product_manager",       label: "Product Manager / Tech" },
  { value: "service_manager",       label: "Service Manager" },
];

// 7 permission flags from orig
const PERM_FLAGS = [
  { key: "canCreateQuotes",     label: "Create Quotes" },
  { key: "useCalculator",       label: "Financial Calculator" },
  { key: "canManageProductFiles", label: "Manage Product Files" },
  { key: "canManageCatalog",    label: "Edit Machine Catalog" },
  { key: "canUploadCatalog",    label: "Upload Machine Catalog" },
  { key: "canViewAllQuotes",    label: "View All Quotes" },
  { key: "canManageUsers",      label: "Manage Users" },
];

interface SalesUser {
  username: string;
  email: string;
  fullName: string;
  salesRole: string;
  enabled: boolean;
  access: any[];
}

function getSalesRole(access: any[]): string {
  const s = access?.find((a: any) => a.module === "sales");
  return s?.role ?? "account_executive";
}

export function SalesUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users,        setUsers]        = useState<SalesUser[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("");
  const [editingUser,  setEditingUser]  = useState<SalesUser | null>(null);
  const [editPerms,    setEditPerms]    = useState<Record<string, boolean>>({});
  const [editRole,     setEditRole]     = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saveMsg,      setSaveMsg]      = useState("");
  const [loadError,    setLoadError]    = useState("");
  // Reset password modal
  const [resetTarget,  setResetTarget]  = useState<SalesUser | null>(null);
  const [resetPw,      setResetPw]      = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetMsg,     setResetMsg]     = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const res  = await fetch("/api/sales/users");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(`API error ${res.status}: ${data.error ?? "Unknown error"}`);
        setUsers([]);
        return;
      }
      if (data.users) {
        setUsers(data.users.map((u: any) => {
          // u.access is already a parsed ModuleAccess[] from the API — do not JSON.parse it again
          const access = Array.isArray(u.access) ? u.access : [];
          return {
            username: u.username,
            email: u.email,
            fullName: u.fullName || u.email?.split("@")[0] || "",
            salesRole: getSalesRole(access),
            enabled: u.enabled !== false,
            access,
          };
        }));
      }
    } catch (err: any) {
      setLoadError(`Network error: ${err.message}`);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter && u.salesRole !== roleFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  function openEditAccess(u: SalesUser) {
    setEditingUser(u);
    setEditRole(u.salesRole);
    // Default perms by role-group (mirrors orig openEditAccess)
    const isSales = ["Admin","sales_admin_manager","sales_admin_supervisor","sales_admin_assistant","area_sales_manager","account_executive","sales_assistant"].includes(u.salesRole);
    const isProductTech = ["product_manager","service_manager"].includes(u.salesRole);
    const isSalesAdminMgr = ["Admin","sales_admin_manager","sales_admin_supervisor","area_sales_manager"].includes(u.salesRole);
    const savedEntry = (Array.isArray(u.access) ? u.access : []).find((a: any) => a.module === "sales") as any;
    const saved = savedEntry?.perms ?? {};
    setEditPerms({
      canCreateQuotes:     saved.canCreateQuotes     ?? isSales,
      useCalculator:       saved.useCalculator       ?? true,
      canManageProductFiles: saved.canManageProductFiles ?? (isSales || isProductTech),
      canManageCatalog:    saved.canManageCatalog    ?? (isSales || isProductTech),
      canUploadCatalog:    saved.canUploadCatalog    ?? (isProductTech || isSalesAdminMgr),
      canViewAllQuotes:    saved.canViewAllQuotes    ?? isSalesAdminMgr,
      canManageUsers:      saved.canManageUsers      ?? isSalesAdminMgr,
    });
    setSaveMsg("");
  }

  async function saveAccess() {
    if (!editingUser) return;
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: editingUser.username,
          salesRole: editRole,
          salesPerms: editPerms,
          name: editingUser.fullName,
        }),
      });
      if (res.ok) {
        setSaveMsg("Access saved!");
        await load();
        setTimeout(() => { setEditingUser(null); setSaveMsg(""); }, 1200);
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveMsg("Error: " + (d.error || "Save failed"));
      }
    } catch { setSaveMsg("Network error."); }
    finally { setSaving(false); }
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetPw.length < 8) { setResetMsg("Min 8 characters."); return; }
    if (resetPw !== resetConfirm) { setResetMsg("Passwords do not match."); return; }
    setSaving(true); setResetMsg("");
    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: resetTarget.username, action: "reset_password", newPassword: resetPw }),
      });
      if (res.ok) {
        setResetMsg("Password reset successfully.");
        setResetPw(""); setResetConfirm("");
        setTimeout(() => { setResetTarget(null); setResetMsg(""); }, 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setResetMsg("Error: " + (d.error || "Failed"));
      }
    } catch { setResetMsg("Network error."); }
    finally { setSaving(false); }
  }

  const inp = "w-full px-2 py-1.5 border border-slate-300 rounded text-[12px] focus:outline-none focus:border-[#c0392b]";
  const btn = "px-3 py-1.5 rounded text-[11px] font-bold cursor-pointer border";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h2 className="text-[17px] font-bold text-slate-800">User & Access Management</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">Manage Sales Portal users. Click <strong>Edit Access</strong> to customize permissions per user.</p>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text" placeholder="Search by name or email…" value={search}
          onChange={e => setSearch(e.target.value)}
          className={inp + " flex-1 min-w-[180px]"}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className={inp + " min-w-[180px]"}>
          <option value="">All Roles</option>
          {SALES_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <span className="text-[11px] text-slate-500 self-center whitespace-nowrap">
          {filtered.length} of {users.length} users
        </span>
      </div>

      {/* Table */}
      {loadError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">{loadError}</div>
      )}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-[13px]">Loading users…</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
          <table className="w-full text-[12px] border-collapse bg-white">
            <thead>
              <tr className="bg-[#c0392b] text-white text-[11px] font-semibold">
                {["Name / Email", "Sales Role", "Actions"].map(h => (
                  <th key={h} className="p-[8px_12px] text-left font-semibold tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-slate-400">No users found.</td></tr>
              )}
              {filtered.map((u, idx) => (
                <Fragment key={u.username}>
                  <tr className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="p-[8px_12px]">
                      <div className="font-semibold text-slate-800">{u.email}</div>
                      {u.fullName && u.fullName !== u.email && (
                        <div className="text-[11px] text-slate-500">👤 {u.fullName}</div>
                      )}
                    </td>
                    <td className="p-[8px_12px]">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {SALES_ROLES.find(r => r.value === u.salesRole)?.label ?? u.salesRole}
                      </span>
                    </td>
                    <td className="p-[8px_12px]">
                      <div className="flex gap-1.5 flex-wrap">
                        <button className={btn + " border-[#c0392b] text-[#c0392b] bg-white hover:bg-[#fff2f0]"}
                          onClick={() => editingUser?.username === u.username ? setEditingUser(null) : openEditAccess(u)}>
                          {editingUser?.username === u.username ? "Close" : "Edit Access"}
                        </button>
                        <button className={btn + " border-slate-300 text-slate-600 bg-white hover:bg-slate-50"}
                          onClick={() => { setResetTarget(u); setResetPw(""); setResetConfirm(""); setResetMsg(""); }}>
                          Reset Pwd
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable access editor */}
                  {editingUser?.username === u.username && (
                    <tr key={u.username + "-edit"} className="bg-[#fff8f5]">
                      <td colSpan={3} className="p-3 border-t border-[#f5e0dc]">
                        <div className="font-bold text-[11px] text-[#c0392b] uppercase mb-2">
                          Customize Access — {u.fullName || u.email}
                          {saveMsg && <span className="ml-3 text-emerald-600 normal-case font-normal">{saveMsg}</span>}
                        </div>
                        <div className="mb-2">
                          <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Role</label>
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="px-2 py-1.5 border border-slate-300 rounded text-[12px] bg-white min-w-[220px]">
                            {SALES_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3">
                          {PERM_FLAGS.map(f => (
                            <label key={f.key} className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                              <input type="checkbox"
                                checked={!!editPerms[f.key]}
                                onChange={e => setEditPerms(prev => ({ ...prev, [f.key]: e.target.checked }))}
                                className="accent-[#c0392b] w-[13px] h-[13px]"
                              />
                              {f.label}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveAccess} disabled={saving}
                            className="px-4 py-1.5 bg-[#2e7d32] text-white text-[12px] font-bold rounded cursor-pointer hover:bg-[#1b5e20] disabled:opacity-60">
                            {saving ? "Saving…" : "Save Access"}
                          </button>
                          <button onClick={() => setEditingUser(null)}
                            className="px-4 py-1.5 border border-slate-300 text-slate-600 text-[12px] rounded cursor-pointer hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setResetTarget(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[14px]">Reset Password</h3>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-700 text-[18px]">&times;</button>
            </div>
            <p className="text-[12px] text-slate-500 mb-3">{resetTarget.email}</p>
            <div className="space-y-2">
              <input type="password" placeholder="New password (min 8 chars)" value={resetPw}
                onChange={e => setResetPw(e.target.value)}
                className={inp} />
              <input type="password" placeholder="Confirm password" value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                className={inp}
                onKeyDown={e => { if (e.key === "Enter") submitReset(); }} />
              {resetMsg && <p className={`text-[11px] ${resetMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{resetMsg}</p>}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={submitReset} disabled={saving}
                className="flex-1 py-2 bg-[#c0392b] text-white text-[12px] font-bold rounded cursor-pointer hover:bg-[#a93226] disabled:opacity-60">
                {saving ? "Resetting…" : "Reset Password"}
              </button>
              <button onClick={() => setResetTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded text-[12px] cursor-pointer hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

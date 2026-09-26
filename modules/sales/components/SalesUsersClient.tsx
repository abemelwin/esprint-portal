"use client";

import { useState, useEffect, useMemo, Fragment } from "react";

const ROLES = [
  { value: "Admin",                        label: "Admin" },
  { value: "product_technical_head",       label: "Product Technical Head" },
  { value: "product_development_manager",  label: "Product Development Manager" },
  { value: "service_manager",              label: "Service Manager" },
  { value: "sales_admin_manager",          label: "Sales Admin Manager" },
  { value: "sales_admin_supervisor",       label: "Sales Admin Supervisor" },
  { value: "sales_admin_assistant",        label: "Sales Admin Assistant" },
  { value: "area_sales_manager",           label: "Area Sales Manager" },
  { value: "account_executive",            label: "Account Executive" },
  { value: "sales_assistant",              label: "Sales Assistant" },
  { value: "user",                         label: "User" },
];

function normalizeSalesRole(roleVal?: string, email?: string): string {
  const em = (email || "").toLowerCase().trim();
  if (em === "vin@esprintmedia.com") return "product_technical_head";
  if ([
    "ron@esprintmedia.com", "janmark@esprintmedia.com", "jonjon@esprintmedia.com",
    "albert@esprintmedia.com", "armando@esprintmedia.com", "arnulfo@esprintmedia.com",
    "francis@esprintmedia.com", "kimpee@esprintmedia.com", "mark@esprintmedia.com",
    "rj@esprintmedia.com", "marilyn@acssolutions.ph"
  ].includes(em)) {
    return "product_development_manager";
  }
  if (["arnold@esprintmedia.com", "dan@esprintmedia.com", "esprintrickyeina@gmail.com"].includes(em)) {
    return "service_manager";
  }

  if (!roleVal) return "account_executive";
  const r = roleVal.toLowerCase().trim().replace(/[\s\-\/]+/g, "_");
  if (r === "superadmin" || r === "super_admin" || r === "admin") return "Admin";
  if (r === "product_technical_head" || r === "product_tech_head" || r === "technical_head") return "product_technical_head";
  // "product_manager" was stored by the original migration ROLE_MAP for both product_development_manager
  // and product_technical_head — default to product_development_manager (the more common of the two)
  if (r === "product_development_manager" || r === "product_dev_manager" || r === "product_manager" || r === "pm") return "product_development_manager";
  if (r === "service_manager") return "service_manager";
  if (r === "sales_admin_manager") return "sales_admin_manager";
  if (r === "sales_admin_supervisor") return "sales_admin_supervisor";
  if (r === "sales_admin_assistant") return "sales_admin_assistant";
  if (r === "area_sales_manager" || r === "asm") return "area_sales_manager";
  if (r === "account_executive" || r === "ae") return "account_executive";
  if (r === "sales_assistant") return "sales_assistant";
  if (r === "user") return "user";
  return roleVal;
}

function getRoleLabel(roleVal: string, email?: string): string {
  const norm = normalizeSalesRole(roleVal, email);
  const match = ROLES.find((r) => r.value === norm);
  if (match) return match.label;
  return roleVal || "Account Executive";
}

interface SalesUser {
  username: string;
  email: string;
  fullName: string;
  salesRole: string;
  portalRole: string;
  enabled: boolean;
  access: any[];
}

const PAGE_SIZE = 20;

export function SalesUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<SalesUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Search, filter & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Add User Form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("account_executive");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit Name Modal
  const [editNameTarget, setEditNameTarget] = useState<SalesUser | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editNameLoading, setEditNameLoading] = useState(false);
  const [editNameError, setEditNameError] = useState("");
  const [editNameSuccess, setEditNameSuccess] = useState("");

  // Edit Access Panel
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [userPermsForm, setUserPermsForm] = useState({
    create_quotes: false,
    use_calculator: true,
    manage_product_files: false,
    edit_machine_catalog: false,
    upload_machine_catalog: false,
    manage_users: false,
    manage_roles_access: false,
  });
  const [savePermsMsg, setSavePermsMsg] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<SalesUser | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  // Delete User Modal
  const [deleteTarget, setDeleteTarget] = useState<SalesUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/sales/users");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(`API error ${res.status}: ${data.error ?? "Unknown error"}`);
        setUsers([]);
        return;
      }
      if (data.users) {
        setUsers(
          data.users.map((u: any) => {
            const access = Array.isArray(u.access) ? u.access : [];
            const salesEntry = access.find((a: any) => a.module === "sales");
            const rawRole = salesEntry?.role || u.salesRole || "account_executive";
            const salesRole = normalizeSalesRole(rawRole, u.email);

            return {
              username: u.username || u.email,
              email: u.email,
              fullName: u.fullName || u.email?.split("@")[0] || "",
              salesRole: salesRole,
              portalRole: u.portalRole || "user",
              enabled: u.enabled !== false,
              access,
            };
          })
        );
      }
    } catch (err: any) {
      setLoadError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const r = roleFilter;

    return users.filter((u) => {
      // Exclude system dev admins if needed
      if (u.email === "espmi@espmi.local" || u.email === "espmi") return false;

      const userRole = normalizeSalesRole(u.salesRole, u.email);
      if (r && userRole !== r) return false;
      if (!q) return true;
      const email = (u.email || "").toLowerCase();
      const name = (u.fullName || "").toLowerCase();
      return email.includes(q) || name.includes(q);
    });
  }, [users, searchQuery, roleFilter]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage]);

  // Add User
  async function handleAddUser() {
    setAddError("");
    const name = newName.trim();
    const email = newEmail.trim().toLowerCase();
    const pass = newPassword;

    if (!email || !pass) {
      setAddError("Enter an email and password.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAddError("Enter a valid email address.");
      return;
    }
    if (pass.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch("/api/sales/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: name || email, password: pass, salesRole: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("account_executive");
        await loadUsers();
      } else {
        setAddError(data.error || "Failed to create user.");
      }
    } catch {
      setAddError("Network error.");
    } finally {
      setAddLoading(false);
    }
  }

  // Edit Name Modal
  function openEditName(user: SalesUser) {
    setEditNameTarget(user);
    setEditNameValue(user.fullName || user.email);
    setEditNameError("");
    setEditNameSuccess("");
  }

  async function submitEditName() {
    if (!editNameTarget) return;
    setEditNameError("");
    setEditNameSuccess("");
    const name = editNameValue.trim();
    if (!name) {
      setEditNameError("Please enter a name.");
      return;
    }
    setEditNameLoading(true);
    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: editNameTarget.username, name }),
      });
      if (res.ok) {
        setEditNameSuccess("Name updated successfully!");
        await loadUsers();
        setTimeout(() => setEditNameTarget(null), 800);
      } else {
        const d = await res.json().catch(() => ({}));
        setEditNameError(d.error || "Failed to update name.");
      }
    } catch {
      setEditNameError("Network error.");
    } finally {
      setEditNameLoading(false);
    }
  }

  // Role Change (inline select)
  async function handleRoleChange(user: SalesUser, newRoleValue: string) {
    if (user.salesRole === newRoleValue) return;

    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, salesRole: newRoleValue }),
      });
      if (res.ok) {
        await loadUsers();
      } else {
        alert("Failed to update role.");
      }
    } catch {
      alert("Network error.");
    }
  }

  // Edit Access Panel
  function openEditAccess(user: SalesUser) {
    setEditingUserId(user.username);
    setEditRole(user.salesRole);
    setSavePermsMsg("");

    const role = user.salesRole;
    const isSales = ["superadmin", "Admin", "sales_admin_manager", "sales_admin_supervisor", "sales_admin_assistant", "area_sales_manager", "account_executive", "sales_assistant", "user"].includes(role);
    const isProductTech = ["product_technical_head", "product_development_manager", "product_manager", "service_manager"].includes(role);
    const isSalesAdminMgr = ["superadmin", "Admin", "sales_admin_manager", "sales_admin_supervisor", "area_sales_manager"].includes(role);

    const savedEntry = (Array.isArray(user.access) ? user.access : []).find((a: any) => a.module === "sales") as any;
    const saved = savedEntry?.perms ?? {};

    setUserPermsForm({
      create_quotes: saved.create_quotes ?? isSales,
      use_calculator: saved.use_calculator ?? true,
      manage_product_files: saved.manage_product_files ?? (isSales || isProductTech),
      edit_machine_catalog: saved.edit_machine_catalog ?? (isSales || isProductTech),
      upload_machine_catalog: saved.upload_machine_catalog ?? (isProductTech || isSalesAdminMgr),
      manage_users: saved.manage_users ?? isSalesAdminMgr,
      manage_roles_access: saved.manage_roles_access ?? isSalesAdminMgr,
    });
  }

  async function saveUserAccess(user: SalesUser) {
    setSavingAccess(true);
    setSavePermsMsg("");
    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user.username,
          salesRole: editRole,
          salesPerms: userPermsForm,
          name: user.fullName,
        }),
      });
      if (res.ok) {
        setSavePermsMsg("Access saved successfully!");
        await loadUsers();
        setTimeout(() => {
          setEditingUserId(null);
          setSavePermsMsg("");
        }, 1200);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to save access permissions.");
      }
    } catch (err: any) {
      alert("Network error: " + (err?.message || String(err)));
    } finally {
      setSavingAccess(false);
    }
  }

  // Reset Password Modal
  function openReset(user: SalesUser) {
    setResetTarget(user);
    setResetNewPassword("");
    setResetConfirm("");
    setResetError("");
    setResetSuccess("");
  }

  async function submitReset() {
    setResetError("");
    setResetSuccess("");
    if (resetNewPassword.length < 6) {
      setResetError("Password must be at least 6 characters.");
      return;
    }
    if (resetNewPassword !== resetConfirm) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch("/api/sales/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: resetTarget!.username,
          action: "reset_password",
          newPassword: resetNewPassword,
        }),
      });
      if (res.ok) {
        setResetSuccess("Password reset successfully.");
        setResetNewPassword("");
        setResetConfirm("");
        setTimeout(() => setResetTarget(null), 1200);
      } else {
        const d = await res.json().catch(() => ({}));
        setResetError(d.error || "Failed to reset password.");
      }
    } catch {
      setResetError("Network error.");
    } finally {
      setResetLoading(false);
    }
  }

  // Delete User
  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/sales/users?username=${encodeURIComponent(deleteTarget.username)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        await loadUsers();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Failed to delete user.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto font-sans">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-[20px] font-bold text-slate-800">User & Access Management</h2>
        <div className="text-[12px] text-slate-600 mt-1 bg-slate-50 p-2.5 rounded border border-slate-200">
          Manage system users and configure custom access permissions per individual user. Click <strong>Edit Access</strong> on any user row to customize capabilities.
        </div>
      </div>

      {/* Add User Row */}
      <div className="bg-white p-3 border border-slate-200 rounded-lg mb-4 flex flex-wrap gap-2 items-center shadow-xs">
        <input
          type="text"
          placeholder="Full Name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-1.5 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
        />
        <input
          type="email"
          placeholder="Email address"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="flex-1 min-w-[180px] px-3 py-1.5 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="flex-1 min-w-[160px] px-3 py-1.5 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
          className="min-w-[180px] px-3 py-1.5 border border-slate-300 rounded text-[13px] bg-white focus:outline-none focus:border-[#c0392b]"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddUser}
          disabled={addLoading}
          className="px-4 py-1.5 bg-[#c0392b] text-white text-[13px] font-bold rounded hover:bg-[#a93226] transition-colors cursor-pointer disabled:opacity-60"
        >
          {addLoading ? "Adding..." : "+ Add User"}
        </button>
      </div>
      {addError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">{addError}</div>}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]">🔍</span>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 border border-slate-300 rounded text-[13px] bg-white focus:outline-none focus:border-[#c0392b]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold text-[14px]"
            >
              ×
            </button>
          )}
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="min-w-[180px] px-3 py-1.5 border border-slate-300 rounded text-[13px] bg-white focus:outline-none focus:border-[#c0392b]"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        <div className="text-[12px] text-slate-600 ml-auto font-medium">
          <strong>{filteredUsers.length}</strong> of {users.length} users
        </div>
      </div>

      {loadError && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">{loadError}</div>}

      {/* User Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-[14px]">Loading users...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-xs bg-white">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-[#c0392b] text-white text-[12px] font-bold">
                <th className="p-3 text-left w-[40%]">Username / Name</th>
                <th className="p-3 text-left w-[25%]">Role</th>
                <th className="p-3 text-left w-[35%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-400 italic">
                    No users found matching your search.
                  </td>
                </tr>
              )}
              {pagedUsers.map((user, idx) => (
                <Fragment key={user.username}>
                  <tr className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <span>{user.email || user.username}</span>
                        {(user.email === currentUserId || user.username === currentUserId) && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-normal">(you)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {user.fullName && user.fullName !== user.email ? (
                          <span>👤 {user.fullName}</span>
                        ) : (
                          <span className="italic text-slate-400">(No name set)</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <select
                        value={user.salesRole}
                        onChange={(e) => handleRoleChange(user, e.target.value)}
                        className="w-full max-w-[200px] px-2 py-1 border border-slate-300 rounded text-[12px] bg-white focus:outline-none focus:border-[#c0392b]"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => openEditName(user)}
                          className="px-2.5 py-1 text-[11px] font-medium border border-slate-300 bg-white rounded text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Edit Name
                        </button>
                        <button
                          onClick={() => (editingUserId === user.username ? setEditingUserId(null) : openEditAccess(user))}
                          className="px-2.5 py-1 text-[11px] font-medium border border-[#c0392b] bg-white rounded text-[#c0392b] hover:bg-red-50 transition-colors"
                        >
                          Edit Access
                        </button>
                        <button
                          onClick={() => openReset(user)}
                          className="px-2.5 py-1 text-[11px] font-medium border border-slate-300 bg-white rounded text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          Reset Pwd
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="px-2.5 py-1 text-[11px] font-medium border border-red-300 bg-white rounded text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Edit Access Panel */}
                  {editingUserId === user.username && (
                    <tr className="bg-[#fff8f5] border-b border-[#f5e0dc]">
                      <td colSpan={3} className="p-4">
                        <div className="border border-[#f0c2bb] bg-white p-4 rounded-lg shadow-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                            <span className="font-bold text-[12px] text-slate-800">
                              Customize Individual Access Permissions &mdash; {user.fullName || user.email} (Role: {getRoleLabel(user.salesRole)})
                            </span>
                            {savePermsMsg && <span className="text-emerald-600 font-semibold text-[12px]">{savePermsMsg}</span>}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.create_quotes}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, create_quotes: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Create Quotes
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.use_calculator}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, use_calculator: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Financial Calculator
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.manage_product_files}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, manage_product_files: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Manage Product Files
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.edit_machine_catalog}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, edit_machine_catalog: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Edit Machine Catalog
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.upload_machine_catalog}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, upload_machine_catalog: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Upload Machine Catalog
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.manage_users}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, manage_users: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Manage Users
                            </label>
                            <label className="flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={userPermsForm.manage_roles_access}
                                onChange={(e) => setUserPermsForm((p) => ({ ...p, manage_roles_access: e.target.checked }))}
                                className="accent-[#c0392b] w-4 h-4 rounded"
                              />
                              Manage Access
                            </label>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => saveUserAccess(user)}
                              disabled={savingAccess}
                              className="px-4 py-1.5 bg-[#2e7d32] text-white text-[12px] font-bold rounded hover:bg-[#1b5e20] transition-colors disabled:opacity-60 cursor-pointer"
                            >
                              {savingAccess ? "Saving..." : "Save Access"}
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-4 py-1.5 border border-slate-300 text-slate-700 text-[12px] rounded hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1.5 border border-slate-300 bg-white rounded text-[12px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ← Prev
          </button>
          <span className="text-[12px] font-medium text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1.5 border border-slate-300 bg-white rounded text-[12px] font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Next →
          </button>
        </div>
      )}

      {/* ─── Edit Name Modal ─── */}
      {editNameTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[15px] text-slate-800">Edit Full Name</h3>
              <button onClick={() => setEditNameTarget(null)} className="text-slate-400 hover:text-slate-700 text-[20px] font-bold">
                ×
              </button>
            </div>
            <div className="mb-4">
              <p className="text-[12px] text-slate-500 mb-3">
                {editNameTarget.email} <span className="font-medium text-slate-700">({getRoleLabel(editNameTarget.salesRole)})</span>
              </p>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Full Name / Display Name</label>
              <input
                type="text"
                placeholder="e.g. Marilyn Dela Cruz"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitEditName();
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
                disabled={editNameLoading}
                autoFocus
              />
              {editNameError && <div className="mt-2 text-[12px] text-red-600">{editNameError}</div>}
              {editNameSuccess && <div className="mt-2 text-[12px] text-emerald-600">{editNameSuccess}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditNameTarget(null)}
                disabled={editNameLoading}
                className="px-4 py-2 border border-slate-300 rounded text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitEditName}
                disabled={editNameLoading || !editNameValue.trim()}
                className="px-4 py-2 bg-[#c0392b] text-white rounded text-[12px] font-bold hover:bg-[#a93226] transition-colors disabled:opacity-60"
              >
                {editNameLoading ? "Saving..." : "Save Name"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Reset Password Modal ─── */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[15px] text-slate-800">Reset Password</h3>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-700 text-[20px] font-bold">
                ×
              </button>
            </div>
            <p className="text-[12px] text-slate-500 mb-3">{resetTarget.email}</p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">New Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={resetConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitReset();
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-[13px] focus:outline-none focus:border-[#c0392b]"
                />
              </div>
              {resetError && <div className="text-[12px] text-red-600">{resetError}</div>}
              {resetSuccess && <div className="text-[12px] text-emerald-600">{resetSuccess}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setResetTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReset}
                disabled={resetLoading}
                className="px-4 py-2 bg-[#c0392b] text-white rounded text-[12px] font-bold hover:bg-[#a93226] transition-colors disabled:opacity-60"
              >
                {resetLoading ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-[15px] text-red-600">Delete User</h3>
              <button onClick={() => setDeleteTarget(null)} className="text-slate-400 hover:text-slate-700 text-[20px] font-bold">
                ×
              </button>
            </div>
            <p className="text-[13px] text-slate-700 mb-4">
              Are you sure you want to delete user <strong className="text-slate-900">{deleteTarget.fullName || deleteTarget.email}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="px-4 py-2 border border-slate-300 rounded text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="px-4 py-2 bg-red-600 text-white rounded text-[12px] font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

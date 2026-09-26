"use client";

import { useState, useEffect } from "react";
import type { LookupData } from "../types";

export interface MachineRoleDef {
  id: string;
  key: string;
  label: string;
  perms: {
    edit?: boolean;
    reserve?: boolean;
    deliver?: boolean;
    unreserve?: boolean;
    manageUsers?: boolean;
    viewClient?: boolean;
  };
}

export interface MachineUserDef {
  id: string;
  email: string;
  displayName: string;
  roleKey: string;
  roleLabel: string;
  aeCode: string | null;
  approvedAes: string[];
}

export function AdminClient() {
  const [activeTab, setActiveTab] = useState<"roles" | "users" | "lookups">("roles");
  const [lookups, setLookups] = useState<LookupData>({
    branches: [],
    aes: [],
    brands: [],
    models: [],
    reorder_points: [],
  });
  const [loading, setLoading] = useState(true);

  // Demo / Initial Roles
  const [roles, setRoles] = useState<MachineRoleDef[]>([
    {
      id: "r1",
      key: "inventory_accounting",
      label: "Inventory / Accounting Admin",
      perms: { edit: true, reserve: true, deliver: true, unreserve: true, manageUsers: true, viewClient: true },
    },
    {
      id: "r2",
      key: "sales_admin",
      label: "Sales Admin / ASM / AE",
      perms: { edit: false, reserve: true, deliver: false, unreserve: false, manageUsers: false, viewClient: false },
    },
    {
      id: "r3",
      key: "super_admin",
      label: "Super Admin",
      perms: { edit: true, reserve: true, deliver: true, unreserve: true, manageUsers: true, viewClient: true },
    },
  ]);

  // Demo / Initial Users Roster
  const [users, setUsers] = useState<MachineUserDef[]>([
    {
      id: "u1",
      email: "florendojohnlloyd@gmail.com",
      displayName: "John Lloyd Florendo",
      roleKey: "super_admin",
      roleLabel: "Super Admin",
      aeCode: "JLF",
      approvedAes: ["JLF", "JLS", "MELWIN"],
    },
    {
      id: "u2",
      email: "abemelwin01@gmail.com",
      displayName: "Melwin Dave Abe",
      roleKey: "inventory_accounting",
      roleLabel: "Inventory / Accounting Admin",
      aeCode: null,
      approvedAes: [],
    },
  ]);

  // State for adding/editing roles
  const [editingRole, setEditingRole] = useState<MachineRoleDef | null | "new">(null);
  const [roleLabelInput, setRoleLabelInput] = useState("");
  const [rolePermsInput, setRolePermsInput] = useState<MachineRoleDef["perms"]>({});

  // State for adding/editing users
  const [editingUser, setEditingUser] = useState<MachineUserDef | null | "new">(null);
  const [userEmailInput, setUserEmailInput] = useState("");
  const [userNameInput, setUserNameInput] = useState("");
  const [userRoleInput, setUserRoleInput] = useState("sales_admin");
  const [userAeInput, setUserAeInput] = useState("");
  const [userApprovedAesInput, setUserApprovedAesInput] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // New inputs for lookups
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [newAe, setNewAe] = useState("");

  // Reorder point form
  const [reorderBrand, setReorderBrand] = useState("");
  const [reorderModel, setReorderModel] = useState("");
  const [reorderQty, setReorderQty] = useState(1);

  async function loadLookups() {
    setLoading(true);
    try {
      const res = await fetch("/api/machines/lookups");
      const data = await res.json();
      if (data.branches) setLookups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLookups();
  }, []);

  // Handle Role Save
  function handleSaveRole() {
    if (!roleLabelInput.trim()) return;
    if (editingRole === "new") {
      const slugKey = roleLabelInput.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
      const newR: MachineRoleDef = {
        id: "r_" + Date.now(),
        key: slugKey,
        label: roleLabelInput.trim(),
        perms: { ...rolePermsInput },
      };
      setRoles([...roles, newR]);
    } else if (editingRole) {
      setRoles(
        roles.map((r) =>
          r.id === editingRole.id ? { ...r, label: roleLabelLabel(roleLabelInput), perms: { ...rolePermsInput } } : r
        )
      );
    }
    setEditingRole(null);
  }

  function roleLabelLabel(val: string) {
    return val.trim();
  }

  function handleStartEditRole(r: MachineRoleDef | "new") {
    if (r === "new") {
      setRoleLabelInput("");
      setRolePermsInput({ edit: false, reserve: true, deliver: false, unreserve: false, manageUsers: false, viewClient: false });
    } else {
      setRoleLabelInput(r.label);
      setRolePermsInput({ ...r.perms });
    }
    setEditingRole(r);
  }

  // Handle User Save
  function handleSaveUser() {
    if (!userEmailInput.trim() || !userNameInput.trim()) return;
    const selectedRole = roles.find((r) => r.key === userRoleInput) || roles[0];
    const approvedList = userApprovedAesInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (editingUser === "new") {
      const newU: MachineUserDef = {
        id: "u_" + Date.now(),
        email: userEmailInput.trim().toLowerCase(),
        displayName: userNameInput.trim(),
        roleKey: selectedRole.key,
        roleLabel: selectedRole.label,
        aeCode: userAeInput ? userAeInput.trim().toUpperCase() : null,
        approvedAes: approvedList,
      };
      setUsers([...users, newU]);
    } else if (editingUser) {
      setUsers(
        users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                email: userEmailInput.trim().toLowerCase(),
                displayName: userNameInput.trim(),
                roleKey: selectedRole.key,
                roleLabel: selectedRole.label,
                aeCode: userAeInput ? userAeInput.trim().toUpperCase() : null,
                approvedAes: approvedList,
              }
            : u
        )
      );
    }
    setEditingUser(null);
  }

  function handleStartEditUser(u: MachineUserDef | "new") {
    if (u === "new") {
      setUserEmailInput("");
      setUserNameInput("");
      setUserRoleInput(roles[0]?.key || "sales_admin");
      setUserAeInput("");
      setUserApprovedAesInput("");
    } else {
      setUserEmailInput(u.email);
      setUserNameInput(u.displayName);
      setUserRoleInput(u.roleKey);
      setUserAeInput(u.aeCode || "");
      setUserApprovedAesInput((u.approvedAes || []).join(", "));
    }
    setEditingUser(u);
  }

  // Lookups handlers
  async function handleAdd(type: "brand" | "model" | "branch" | "ae", value: string, clearFn: () => void) {
    if (!value.trim()) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", type, value }),
      });
      if (res.ok) {
        clearFn();
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAddReorderPoint(e: React.FormEvent) {
    e.preventDefault();
    if (!reorderBrand || !reorderModel) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          type: "reorder_point",
          brand: reorderBrand,
          model: reorderModel,
          quantity: reorderQty,
        }),
      });
      if (res.ok) {
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(type: string, id: number) {
    if (!confirm(`Are you sure you want to remove this ${type}?`)) return;
    try {
      const res = await fetch("/api/machines/lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", type, id }),
      });
      if (res.ok) {
        loadLookups();
      }
    } catch (err) {
      console.error(err);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.aeCode && u.aeCode.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse" />
              Machine Monitoring Access &amp; Administration
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure inventory roles, user permissions, AE client visibility, brand catalogs, and stock thresholds.
            </p>
          </div>
        </div>

        {/* Access Tabs */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "roles"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🛡️ Roles ({roles.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("users")}
            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👤 Users ({users.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("lookups")}
            className={`px-5 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              activeTab === "lookups"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            ⚙️ Catalog &amp; Lookups
          </button>
        </div>
      </div>

      {/* TAB 1: ROLES MANAGEMENT */}
      {activeTab === "roles" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Inventory Roles &amp; Permission Rules</h2>
              <p className="text-xs text-slate-500">
                Define what each role can perform across Inventory, Incoming, Reserved, and TBA machines.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleStartEditRole("new")}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              ＋ Add Role
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Role Name</th>
                  <th className="py-3 px-4">Permissions</th>
                  <th className="py-3 px-4 text-center">Assigned Users</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((r) => {
                  const count = users.filter((u) => u.roleKey === r.key).length;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.label}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {r.perms.edit && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10.5px]">
                              ✓ Edit Specs
                            </span>
                          )}
                          {r.perms.reserve && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10.5px]">
                              ✓ Reserve
                            </span>
                          )}
                          {r.perms.deliver && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10.5px]">
                              ✓ Deliver
                            </span>
                          )}
                          {r.perms.unreserve && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10.5px]">
                              ✓ Unreserve
                            </span>
                          )}
                          {r.perms.manageUsers && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold text-[10.5px]">
                              ✓ Manage Users
                            </span>
                          )}
                          {r.perms.viewClient && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold text-[10.5px]">
                              ✓ View Client Info
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-700">{count} user(s)</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleStartEditRole(r)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 mr-2 cursor-pointer"
                        >
                          ✎ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Inline Role Form */}
          {editingRole !== null && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-blue-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingRole === "new" ? "Add New Role" : `Edit Role: ${editingRole.label}`}
              </h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role Display Name</label>
                <input
                  type="text"
                  value={roleLabelInput}
                  onChange={(e) => setRoleLabelInput(e.target.value)}
                  placeholder="e.g. Regional Sales Admin"
                  className="w-full max-w-md px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Granted Capabilities</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { k: "edit", label: "Edit Machine Details", desc: "Allow adding, updating specifications, status, serials." },
                    { k: "reserve", label: "Reserve Machines", desc: "Allow creating client reservations on available stock." },
                    { k: "deliver", label: "Mark Delivered", desc: "Allow fulfilling reservations to delivered status." },
                    { k: "unreserve", label: "Cancel Reservation", desc: "Allow releasing reserved machines back to stock." },
                    { k: "manageUsers", label: "Manage Roles & Users", desc: "Allow opening Access panel to add/edit users." },
                    { k: "viewClient", label: "View All Client Names", desc: "Allow seeing client names across all AE codes." },
                  ].map((d) => (
                    <label
                      key={d.k}
                      className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="checkbox"
                        checked={!!rolePermsInput[d.k as keyof MachineRoleDef["perms"]]}
                        onChange={(e) =>
                          setRolePermsInput({ ...rolePermsInput, [d.k]: e.target.checked })
                        }
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <span className="block text-xs font-bold text-slate-900">{d.label}</span>
                        <span className="block text-[11px] text-slate-500 leading-tight mt-0.5">{d.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Save Role Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USERS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">User Accounts &amp; AE Visibility</h2>
              <p className="text-xs text-slate-500">
                Assign user roles and define which Account Executive (AE) codes a user is authorized to view.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleStartEditUser("new")}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              ＋ Add User
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="🔍 Search user by email, name, or AE code..."
              className="flex-1 max-w-md px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4">Primary AE</th>
                  <th className="py-3 px-4">Approved AEs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{u.displayName}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 font-semibold text-blue-600">{u.roleLabel}</td>
                    <td className="py-3 px-4">
                      {u.aeCode ? (
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800 text-[11px]">
                          {u.aeCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(u.approvedAes || []).map((code) => (
                          <span
                            key={code}
                            className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10.5px] border border-blue-200"
                          >
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleStartEditUser(u)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md border border-slate-200 cursor-pointer"
                      >
                        ✎ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Inline User Form */}
          {editingUser !== null && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-blue-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUser === "new" ? "Add User Account" : `Edit User: ${editingUser.displayName}`}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={userEmailInput}
                    onChange={(e) => setUserEmailInput(e.target.value)}
                    placeholder="user@esprint.ph"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Display Full Name</label>
                  <input
                    type="text"
                    value={userNameInput}
                    onChange={(e) => setUserNameInput(e.target.value)}
                    placeholder="e.g. John Lloyd Florendo"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Machine Monitoring Role</label>
                  <select
                    value={userRoleInput}
                    onChange={(e) => setUserRoleInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary AE Code</label>
                  <input
                    type="text"
                    value={userAeInput}
                    onChange={(e) => setUserAeInput(e.target.value)}
                    placeholder="e.g. JLS"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Approved AE Codes (Comma Separated)</label>
                  <input
                    type="text"
                    value={userApprovedAesInput}
                    onChange={(e) => setUserApprovedAesInput(e.target.value)}
                    placeholder="e.g. JLS, JLF, MELWIN"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveUser}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer"
                >
                  Save User Account
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATALOG & LOOKUPS MANAGEMENT */}
      {activeTab === "lookups" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Reorder Points Matrix */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Stock Reorder Thresholds</h2>
                <p className="text-xs text-slate-500">
                  Trigger &quot;LOW STOCK&quot; alerts when total units in stock fall below this minimum level.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddReorderPoint} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Brand</label>
                <input
                  list="admin-brands"
                  value={reorderBrand}
                  onChange={(e) => setReorderBrand(e.target.value)}
                  placeholder="Select or type Brand"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <datalist id="admin-brands">
                  {lookups.brands.map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Model</label>
                <input
                  list="admin-models"
                  value={reorderModel}
                  onChange={(e) => setReorderModel(e.target.value)}
                  placeholder="Select or type Model"
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <datalist id="admin-models">
                  {lookups.models.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Min Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Set Threshold
                </button>
              </div>
            </form>

            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 sticky top-0 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Brand</th>
                    <th className="py-2.5 px-4">Model</th>
                    <th className="py-2.5 px-4">Min. Threshold Quantity</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lookups.reorder_points.map((rp) => (
                    <tr key={rp.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-blue-600">{rp.brand}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{rp.model}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{rp.quantity} units</td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDelete("reorder_point", rp.id)}
                          className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Brands Lookup */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Manage Brands ({lookups.brands.length})</h2>
            <div className="flex gap-2">
              <input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="e.g. Creons, Docan"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleAdd("brand", newBrand, () => setNewBrand(""))}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Add Brand
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
              {lookups.brands.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
                >
                  {b.name}
                  <button
                    onClick={() => handleDelete("brand", b.id)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Models Lookup */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Manage Models ({lookups.models.length})</h2>
            <div className="flex gap-2">
              <input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder="e.g. CREONS 6090 UV"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleAdd("model", newModel, () => setNewModel(""))}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Add Model
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
              {lookups.models.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
                >
                  {m.name}
                  <button
                    onClick={() => handleDelete("model", m.id)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Branches */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Branch Codes ({lookups.branches.length})</h2>
            <div className="flex gap-2">
              <input
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                placeholder="e.g. DAVAO"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
              />
              <button
                onClick={() => handleAdd("branch", newBranch, () => setNewBranch(""))}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Add Branch
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
              {lookups.branches.map((b) => (
                <span
                  key={b.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
                >
                  {b.code}
                  <button
                    onClick={() => handleDelete("branch", b.id)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* AEs */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900">AE Codes ({lookups.aes.length})</h2>
            <div className="flex gap-2">
              <input
                value={newAe}
                onChange={(e) => setNewAe(e.target.value)}
                placeholder="e.g. JLS"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
              />
              <button
                onClick={() => handleAdd("ae", newAe, () => setNewAe(""))}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Add AE
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100">
              {lookups.aes.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-xs"
                >
                  {a.code}
                  <button
                    onClick={() => handleDelete("ae", a.id)}
                    className="text-slate-400 hover:text-red-600 font-bold ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

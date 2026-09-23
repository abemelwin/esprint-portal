'use client';
/**
 * AdminUsersClient — manage Cognito users for Check Monitoring.
 * Modern UI matching esprint-check-monitoring with role badges, status dots,
 * role filters, search, and bulk operations.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useToast } from '@/modules/checks/components/Toast';
import ConfirmDialog from '@/modules/checks/components/ConfirmDialog';

interface ModuleAccess {
  module: string;
  role: string;
  isModuleAdmin: boolean;
  branches: string[];
  aes: string[];
  subsidiary?: string;
}

interface AdminUser {
  username: string;
  email: string;
  fullName: string;
  portalRole: 'super_admin' | 'user';
  access: ModuleAccess[];
  enabled: boolean;
  status: string;
  createdAt: string | null;
}

type AccessLevel = 'VIEW_ONLY' | 'VIEW_EDIT' | 'FULL_ACCESS' | 'AE_ACCESS';

const ROLE_TO_ACCESS: Record<string, AccessLevel> = {
  'Super Admin':              'FULL_ACCESS',
  'Admin':                    'FULL_ACCESS',
  'AR Manager':               'FULL_ACCESS',
  'AR Supervisor':            'FULL_ACCESS',
  'Treasury Manager':         'FULL_ACCESS',
  'Acctg Head':               'FULL_ACCESS',
  'Operations':               'FULL_ACCESS',
  'AR Staff':                 'VIEW_EDIT',
  'Treasury Staff':           'VIEW_EDIT',
  'AE':                       'VIEW_EDIT',
  'Branch Manager':           'VIEW_EDIT',
  'Branch Staff':             'VIEW_ONLY',
  'Branch AR/Finance Staff':  'VIEW_ONLY',
  'AE Access':                'AE_ACCESS',
};

const ACCESS_BADGE: Record<AccessLevel, { label: string; cls: string }> = {
  FULL_ACCESS: { label: 'FULL ACCESS', cls: 'bg-[#1e3a8a] text-white' },
  VIEW_EDIT:   { label: 'VIEW & EDIT', cls: 'bg-[#0d9488] text-white' },
  VIEW_ONLY:   { label: 'VIEW ONLY',   cls: 'bg-gray-500 text-white' },
  AE_ACCESS:   { label: 'AE ACCESS',   cls: 'bg-amber-600 text-white' },
};

const CHECK_ROLES = [
  'Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'AR Staff',
  'Treasury Manager', 'Treasury Staff', 'Branch Manager', 'Branch AR/Finance Staff',
  'Branch Staff', 'AE', 'AE Access',
];

const ADMIN_ROLES = ['Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'Treasury Manager'];

const EMPTY_FORM = {
  email: '', fullName: '', portalRole: 'user' as 'super_admin' | 'user',
  checkRole: 'AR Staff', branchAll: true, branches: [] as string[],
  aes: [] as string[], subsidiaries: [] as string[],
};

interface Props {
  branches: { id: string; name: string }[];
  aeList: string[];
  subsidiaries: string[];
  deleteRequestCount?: number;
}

export function AdminUsersClient({ branches, aeList, subsidiaries, deleteRequestCount = 0 }: Props) {
  const branchList = branches ?? [];
  const aeOptions = aeList ?? [];
  const subsidiaryOptions = subsidiaries ?? [];
  const { showToast } = useToast();

  const [mounted, setMounted]     = useState(false);
  const [users, setUsers]         = useState<AdminUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [aeSearch, setAeSearch]   = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editUser, setEditUser]   = useState<AdminUser | null>(null);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [confirm, setConfirm]     = useState<{ title: string; message: string; confirmText?: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.ok) setUsers(json.users);
      else showToast(json.error ?? 'Failed to load users', 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const branchMap = useMemo(() => new Map(branchList.map(b => [b.id, b.name])), [branchList]);

  function getAccessLevel(u: AdminUser): AccessLevel {
    if (u.portalRole === 'super_admin') return 'FULL_ACCESS';
    const checks = u.access.find(a => a.module === 'checks');
    const role = checks?.role ?? '';
    return ROLE_TO_ACCESS[role] ?? 'VIEW_ONLY';
  }

  function getUserRoleDisplay(u: AdminUser): string {
    if (u.portalRole === 'super_admin') return 'Super Admin';
    const checks = u.access.find(a => a.module === 'checks');
    return checks?.role ?? 'User';
  }

  // Sorted users
  const sortedUsers = useMemo(() => {
    const accessRanks: Record<AccessLevel, number> = {
      FULL_ACCESS: 1,
      VIEW_EDIT:   2,
      VIEW_ONLY:   3,
      AE_ACCESS:   4,
    };
    return [...users].sort((a, b) => {
      const levelA = getAccessLevel(a);
      const levelB = getAccessLevel(b);
      const rankA = accessRanks[levelA];
      const rankB = accessRanks[levelB];
      if (rankA !== rankB) return rankA - rankB;
      const roleA = getUserRoleDisplay(a);
      const roleB = getUserRoleDisplay(b);
      const roleCmp = roleA.localeCompare(roleB);
      if (roleCmp !== 0) return roleCmp;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [users]);

  // Role filter options
  const availableRoles = useMemo(() => {
    const counts: Record<string, number> = {};
    sortedUsers.forEach(u => {
      const r = getUserRoleDisplay(u);
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedUsers]);

  // Visible / Filtered users
  const visibleUsers = useMemo(() => {
    return sortedUsers.filter(u => {
      const role = getUserRoleDisplay(u);
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const checks = u.access.find(a => a.module === 'checks');
        const matchName = u.fullName.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchRole = role.toLowerCase().includes(q);
        const matchBranch = (checks?.branches ?? []).some(b => {
          const bName = branchMap.get(b) ?? b;
          return bName.toLowerCase().includes(q) || b.toLowerCase().includes(q);
        });
        if (!matchName && !matchEmail && !matchRole && !matchBranch) return false;
      }
      return true;
    });
  }, [sortedUsers, roleFilter, search, branchMap]);

  // Selection
  const allSelected = visibleUsers.length > 0 && visibleUsers.every(u => selected.has(u.username));
  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleUsers.map(u => u.username)));
    }
  }

  function toggleOne(username: string) {
    const next = new Set(selected);
    if (next.has(username)) next.delete(username);
    else next.add(username);
    setSelected(next);
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setAeSearch('');
    setFormError(null);
    setEditUser(null);
    setShowForm(true);
  }

  function openEdit(u: AdminUser) {
    const checks = u.access.find(a => a.module === 'checks');
    setForm({
      email: u.email,
      fullName: u.fullName,
      portalRole: u.portalRole,
      checkRole: checks?.role ?? 'AR Staff',
      branchAll: !checks?.branches?.length,
      branches: checks?.branches ?? [],
      aes: checks?.aes ?? [],
      subsidiaries: typeof checks?.subsidiary === 'string' && checks.subsidiary
        ? checks.subsidiary.split('/').map(s => s.trim()).filter(Boolean)
        : [],
    });
    setAeSearch('');
    setFormError(null);
    setEditUser(u);
    setShowForm(true);
  }

  function buildAccess(): ModuleAccess[] {
    if (form.portalRole === 'super_admin') return [];
    return [{
      module: 'checks',
      role: form.checkRole,
      isModuleAdmin: ADMIN_ROLES.includes(form.checkRole),
      branches: form.branchAll ? [] : form.branches,
      aes: form.aes,
      subsidiary: form.subsidiaries.join('/') || undefined,
    }];
  }

  const isAERole = form.checkRole === 'AE' || form.checkRole === 'AE Access';

  async function saveForm() {
    if (!form.email.trim()) { showToast('Email is required', 'error'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const access = buildAccess();
      if (editUser) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: editUser.username, fullName: form.fullName, portalRole: form.portalRole, access }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('User updated successfully', 'success');
          setShowForm(false);
          fetchUsers();
        } else {
          setFormError(json.error ?? 'Update failed');
          showToast(json.error ?? 'Update failed', 'error');
        }
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email.trim(),
            fullName: form.fullName.trim() || form.email.trim(),
            portalRole: form.portalRole,
            access,
            tempPassword: 'Esprint2026!',
          }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('User created — temp password: Esprint2026!', 'success');
          setShowForm(false);
          fetchUsers();
        } else {
          setFormError(json.error ?? 'Create failed');
          showToast(json.error ?? 'Create failed', 'error');
        }
      }
    } catch (err) {
      setFormError((err as Error)?.message ?? 'Network error');
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(u: AdminUser) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.username, enabled: !u.enabled }),
    });
    const json = await res.json();
    if (json.ok) {
      showToast(u.enabled ? 'User disabled' : 'User enabled', 'success');
      fetchUsers();
    } else {
      showToast(json.error ?? 'Failed', 'error');
    }
  }

  async function disableSelected() {
    const usernames = Array.from(selected);
    if (!usernames.length) return;
    const names = users.filter(u => usernames.includes(u.username)).map(u => u.fullName || u.email).join(', ');
    setConfirm({
      title: 'Disable Selected Users',
      message: `Disable ${usernames.length} user${usernames.length > 1 ? 's' : ''}?\n\n${names}\n\nThey will not be able to sign in until re-enabled.`,
      confirmText: 'Disable',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        let failed = 0;
        for (const username of usernames) {
          const res = await fetch('/api/admin/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, enabled: false }),
          });
          const json = await res.json();
          if (!json.ok) failed++;
        }
        setSelected(new Set());
        if (failed === 0) showToast(`Disabled ${usernames.length} user(s)`, 'success');
        else showToast(`${failed} disable operation(s) failed`, 'error');
        fetchUsers();
      },
    });
  }

  function resetPassword(u: AdminUser) {
    setConfirm({
      title: 'Reset Password',
      message: `Reset ${u.fullName}'s password to the default (Esprint2026!)? They will be asked to set a new password on next login.`,
      confirmText: 'Reset Password',
      danger: false,
      onConfirm: async () => {
        setConfirm(null);
        const res = await fetch('/api/admin/users', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u.username, resetPassword: true, tempPassword: 'Esprint2026!' }),
        });
        const json = await res.json();
        if (json.ok) showToast('Password reset to Esprint2026!', 'success');
        else showToast(json.error ?? 'Reset failed', 'error');
      },
    });
  }

  function deleteUser(u: AdminUser) {
    setConfirm({
      title: 'Delete User',
      message: `Permanently delete ${u.fullName} (${u.email})? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const res = await fetch('/api/admin/users', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u.username }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('User permanently deleted', 'success');
          fetchUsers();
        } else {
          showToast(json.error ?? 'Delete failed', 'error');
        }
      },
    });
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">Manage users, clients, and branches. A user can be assigned to multiple branches.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <button
              onClick={disableSelected}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer"
            >
              🚫 Disable {selected.size} selected
            </button>
          )}

          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#16a34a] hover:bg-[#15803d] transition-colors shadow-sm cursor-pointer"
          >
            + Add User
          </button>

          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            ✉ Invite User
          </button>

          {deleteRequestCount > 0 && (
            <Link
              href="/checks/admin/delete-requests"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#dc2626] hover:bg-[#b91c1c] transition-colors shadow-sm"
            >
              🗑 Delete Requests ({deleteRequestCount})
            </Link>
          )}
        </div>
      </div>

      {/* Users table card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Card Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-white">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900">
              Users ({visibleUsers.length}{roleFilter !== 'ALL' || search ? ` of ${sortedUsers.length}` : ''})
            </h2>
            {(roleFilter !== 'ALL' || search) && (
              <button
                onClick={() => { setRoleFilter('ALL'); setSearch(''); }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Role Filter Dropdown */}
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white text-gray-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 cursor-pointer shadow-xs"
              aria-label="Filter by role"
            >
              <option value="ALL">All Roles ({sortedUsers.length})</option>
              {availableRoles.map(([role, count]) => (
                <option key={role} value={role}>
                  {role} ({count})
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, role…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 w-56 placeholder:text-gray-400 shadow-xs"
            />
          </div>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="report w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">NAME</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">EMAIL</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">ACCESS / ROLE</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">SUBSIDIARY / BRANCHES</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">ASSIGNED AES</th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap">STATUS / LOGIN</th>
                <th className="px-4 py-3.5 text-right text-[11px] font-bold tracking-wider text-gray-600 uppercase whitespace-nowrap pr-5">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 italic">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading users from AWS Cognito…</span>
                    </div>
                  </td>
                </tr>
              ) : visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 italic">No users found</td>
                </tr>
              ) : (
                visibleUsers.map((u) => {
                  const level = getAccessLevel(u);
                  const badge = ACCESS_BADGE[level];
                  const isChk = selected.has(u.username);
                  const checks = u.access.find(a => a.module === 'checks');
                  const branchesList = checks?.branches ?? [];
                  const aesList = checks?.aes ?? [];
                  const subsidiary = checks?.subsidiary ?? '';
                  const roleName = getUserRoleDisplay(u);
                  const isAEUser = roleName === 'AE' || roleName === 'AE Access';

                  // Format created/login date
                  const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', {
                    month: 'numeric', day: 'numeric', year: 'numeric'
                  }) : '';

                  return (
                    <tr
                      key={u.username}
                      className={`transition-colors ${isChk ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'} ${!u.enabled ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3.5 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={isChk}
                          onChange={() => toggleOne(u.username)}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900 whitespace-nowrap align-middle">
                        {u.fullName || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-gray-600 text-xs whitespace-nowrap align-middle">{u.email}</td>
                      <td className="px-4 py-3.5 align-middle">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide uppercase whitespace-nowrap shrink-0 ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 whitespace-nowrap shrink-0">
                            {roleName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs align-middle">
                        <div className="flex flex-col gap-1">
                          {subsidiary && (
                            <div className="flex flex-wrap gap-1">
                              {subsidiary.split('/').map(s => s.trim()).filter(Boolean).map(s => (
                                <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          {u.portalRole === 'super_admin' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1e3a8a] text-white whitespace-nowrap w-fit">
                              All branches
                            </span>
                          ) : !branchesList.length ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1e3a8a] text-white whitespace-nowrap w-fit">
                              All branches
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {branchesList.map(b => {
                                const bName = branchMap.get(b) ?? b;
                                return (
                                  <span key={b} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 whitespace-nowrap">
                                    {bName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {isAEUser && !subsidiary && !branchesList.length && null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs align-middle">
                        {aesList.length ? (
                          <div className="flex flex-wrap gap-1">
                            {aesList.map(ae => (
                              <span key={ae} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">
                                {ae}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">— none —</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap align-middle">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                              !u.enabled
                                ? 'bg-red-500'
                                : u.status === 'CONFIRMED'
                                ? 'bg-green-500'
                                : 'bg-amber-400'
                            }`}
                          />
                          <span className="font-medium">
                            {dateStr || (u.enabled ? 'Active' : 'Disabled')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right pr-5 whitespace-nowrap align-middle">
                        <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                          <button
                            onClick={() => openEdit(u)}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300 font-normal">|</span>
                          <button
                            onClick={() => resetPassword(u)}
                            className="text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
                            title="Reset password"
                          >
                            Reset
                          </button>
                          <span className="text-gray-300 font-normal">|</span>
                          <button
                            onClick={() => toggleEnabled(u)}
                            className="text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
                          >
                            {u.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <span className="text-gray-300 font-normal">|</span>
                          <button
                            onClick={() => deleteUser(u)}
                            className="text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal (rendered via createPortal directly into document.body) */}
      {mounted && showForm && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden relative z-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="font-bold text-gray-900 text-base">{editUser ? 'Edit User' : 'Add New User'}</h2>
                <p className="text-xs text-gray-500">Configure Cognito login credentials and module permissions.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
                  {formError}
                </div>
              )}

              <div>
                <label className={lbl}>Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!editUser}
                  className={inp + (editUser ? ' bg-gray-100 text-gray-500 cursor-not-allowed' : '')}
                  placeholder="user@esprintmedia.com"
                />
              </div>

              <div>
                <label className={lbl}>Full Name</label>
                <input
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  className={inp}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div>
                <label className={lbl}>Portal Role</label>
                <select
                  value={form.portalRole}
                  onChange={e => setForm(f => ({ ...f, portalRole: e.target.value as 'super_admin' | 'user' }))}
                  className={inp}
                >
                  <option value="user">User (Standard module access)</option>
                  <option value="super_admin">Super Admin (Full system access)</option>
                </select>
              </div>

              {form.portalRole === 'user' && (
                <>
                  <div>
                    <label className={lbl}>Check Monitoring Role</label>
                    <select
                      value={form.checkRole}
                      onChange={e => setForm(f => ({ ...f, checkRole: e.target.value }))}
                      className={inp}
                    >
                      {CHECK_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700">Branch Access</label>
                      <label className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.branchAll}
                          onChange={e => setForm(f => ({ ...f, branchAll: e.target.checked }))}
                          className="accent-blue-600"
                        />
                        All branches
                      </label>
                    </div>

                    {!form.branchAll && (
                      <div className="border border-gray-200 rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1 bg-slate-50">
                        {branchList.map(b => (
                          <label
                            key={b.id}
                            className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer px-1.5 py-1 hover:bg-white rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={form.branches.includes(b.id)}
                              onChange={() =>
                                setForm(f => ({
                                  ...f,
                                  branches: f.branches.includes(b.id)
                                    ? f.branches.filter(x => x !== b.id)
                                    : [...f.branches, b.id],
                                }))
                              }
                              className="accent-blue-600"
                            />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subsidiary — multi-select */}
                  {subsidiaryOptions.length > 0 && (
                    <div>
                      <label className={lbl}>Subsidiary</label>
                      <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 bg-slate-50">
                        {subsidiaryOptions.map(s => (
                          <label key={s} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.subsidiaries.includes(s)}
                              onChange={e =>
                                setForm(f => ({
                                  ...f,
                                  subsidiaries: e.target.checked
                                    ? [...f.subsidiaries, s]
                                    : f.subsidiaries.filter(x => x !== s),
                                }))
                              }
                              className="accent-blue-600"
                            />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assigned AEs */}
                  <div>
                    <label className={lbl}>
                      {form.checkRole === 'AE Access' ? 'Assigned AEs (TL supervises these AEs)' : 'Assigned AEs'}
                    </label>
                    <input
                      value={aeSearch}
                      onChange={e => setAeSearch(e.target.value)}
                      placeholder="Search AE name or code…"
                      className={inp + ' mb-2'}
                    />
                    <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50">
                      {aeOptions.filter(ae => !aeSearch || ae.toLowerCase().includes(aeSearch.toLowerCase())).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No AEs found</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          {aeOptions
                            .filter(ae => !aeSearch || ae.toLowerCase().includes(aeSearch.toLowerCase()))
                            .map(ae => (
                              <label key={ae} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.aes.includes(ae)}
                                  onChange={e =>
                                    setForm(f => ({
                                      ...f,
                                      aes: e.target.checked ? [...f.aes, ae] : f.aes.filter(x => x !== ae),
                                    }))
                                  }
                                  className="accent-blue-600"
                                />
                                {ae}
                              </label>
                            ))}
                        </div>
                      )}
                    </div>
                    {isAERole && form.aes.length === 0 && (
                      <p className="text-[11px] text-amber-600 mt-1">⚠ Select at least one AE for this {form.checkRole === 'AE Access' ? 'TL to supervise' : 'AE'}.</p>
                    )}
                  </div>
                </>
              )}

              {!editUser && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  Temporary password will be <strong>Esprint2026!</strong> — the user will be asked to set their own on first sign in.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveForm}
                disabled={saving || !form.email.trim()}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-[#1e3a8a] text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                {saving ? 'Saving…' : editUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText ?? 'Confirm'}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

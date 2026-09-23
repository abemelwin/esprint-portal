'use client';
/**
 * AdminUsersClient — manage users for Check Monitoring.
 * 100% exact replica of esprint-check-monitoring main app UI, Access Level cards,
 * branch selectors, and Edit User modal without portalRole.
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

const ACCESS_TO_ROLE: Record<AccessLevel, string> = {
  VIEW_ONLY:   'Branch AR/Finance Staff',
  VIEW_EDIT:   'AR Staff',
  FULL_ACCESS: 'Admin',
  AE_ACCESS:   'AE Access',
};

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

const ALL_ROLES = [
  'Admin',
  'Operations',
  'Acctg Head',
  'AR Manager',
  'AR Supervisor',
  'AR Staff',
  'Treasury Manager',
  'Treasury Staff',
  'Branch Manager',
  'Branch AR/Finance Staff',
  'Branch Staff',
  'AE',
];

const ACCESS_LEVEL_ROLES: Record<AccessLevel, string[]> = {
  VIEW_ONLY:   ['Branch Staff', 'Branch AR/Finance Staff'],
  VIEW_EDIT:   ['AR Staff', 'Treasury Staff', 'AE', 'Branch Manager'],
  FULL_ACCESS: ['Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'Treasury Manager'],
  AE_ACCESS:   ['AE Access'],
};

const ACCESS_BADGE: Record<AccessLevel, { label: string; cls: string }> = {
  FULL_ACCESS: { label: 'FULL ACCESS', cls: 'bg-[#1e3a8a] text-white' },
  VIEW_EDIT:   { label: 'VIEW & EDIT', cls: 'bg-[#0d9488] text-white' },
  VIEW_ONLY:   { label: 'VIEW ONLY',   cls: 'bg-gray-500 text-white' },
  AE_ACCESS:   { label: 'AE ACCESS',   cls: 'bg-amber-600 text-white' },
};

const ADMIN_ROLES = ['Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'Treasury Manager'];

const EMPTY_FORM = {
  email: '',
  full_name: '',
  password: '',
  confirmPassword: '',
  accessLevel: 'VIEW_EDIT' as AccessLevel,
  role: 'AR Staff',
  branchAll: true,
  branches: [] as string[],
  aes: [] as string[],
  subsidiaries: [] as string[],
  ae_code: '',
};

interface Props {
  branches: { id: string; name: string }[];
  aeList: string[];
  subsidiaries: string[];
  deleteRequestCount?: number;
}

export function AdminUsersClient({ branches, aeList, subsidiaries, deleteRequestCount = 0 }: Props) {
  const branchList = useMemo(() => [...(branches ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [branches]);
  const aeOptions = useMemo(() => aeList ?? [], [aeList]);
  const subsidiaryOptions = useMemo(() => subsidiaries?.length ? subsidiaries : ['ESPMI', 'APSI', 'ESPII', 'ESCGI'], [subsidiaries]);
  const { showToast } = useToast();

  const [mounted, setMounted]         = useState(false);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState('ALL');
  const [aeSearch, setAeSearch]       = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editUser, setEditUser]       = useState<AdminUser | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [confirm, setConfirm]         = useState<{ title: string; message: string; confirmText?: string; danger?: boolean; onConfirm: () => void } | null>(null);
  const [formError, setFormError]     = useState<string | null>(null);

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
    const checks = u.access.find(a => a.module === 'checks');
    const role = checks?.role ?? (u.portalRole === 'super_admin' ? 'Admin' : '');
    return ROLE_TO_ACCESS[role] ?? 'VIEW_ONLY';
  }

  function getUserRoleDisplay(u: AdminUser): string {
    const checks = u.access.find(a => a.module === 'checks');
    return checks?.role ?? (u.portalRole === 'super_admin' ? 'Admin' : 'User');
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
      return (a.fullName || a.email).localeCompare(b.fullName || b.email);
    });
  }, [users]);

  // Role filter counts
  const availableRoles = useMemo(() => {
    const counts: Record<string, number> = {};
    sortedUsers.forEach(u => {
      const r = getUserRoleDisplay(u);
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sortedUsers]);

  // Visible users
  const visibleUsers = useMemo(() => {
    return sortedUsers.filter(u => {
      const role = getUserRoleDisplay(u);
      if (roleFilter !== 'ALL' && role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const checks = u.access.find(a => a.module === 'checks');
        const matchName = (u.fullName || '').toLowerCase().includes(q);
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
    setForm({ ...EMPTY_FORM, accessLevel: 'VIEW_EDIT', role: 'AR Staff' });
    setAeSearch('');
    setFormError(null);
    setEditUser(null);
    setShowModal(true);
  }

  function openEdit(u: AdminUser) {
    const checks = u.access.find(a => a.module === 'checks');
    const role = checks?.role ?? (u.portalRole === 'super_admin' ? 'Admin' : 'AR Staff');
    const accessLevel = ROLE_TO_ACCESS[role] ?? 'VIEW_EDIT';
    const isAll = !checks?.branches?.length || checks.branches.includes('ALL');
    setForm({
      email: u.email,
      full_name: u.fullName,
      password: '',
      confirmPassword: '',
      accessLevel,
      role,
      branchAll: isAll,
      branches: isAll ? [] : checks?.branches ?? [],
      aes: checks?.aes ?? [],
      subsidiaries: typeof checks?.subsidiary === 'string' && checks.subsidiary
        ? checks.subsidiary.split('/').map(s => s.trim()).filter(Boolean)
        : [],
      ae_code: '',
    });
    setAeSearch('');
    setFormError(null);
    setEditUser(u);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditUser(null);
    setForm({ ...EMPTY_FORM });
    setAeSearch('');
    setFormError(null);
  }

  function setAccessLevel(level: AccessLevel) {
    const defaultRole = ACCESS_TO_ROLE[level];
    setForm(f => ({ ...f, accessLevel: level, role: defaultRole }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim()) { showToast('Email is required', 'error'); return; }
    if (!form.full_name.trim()) { showToast('Full name is required', 'error'); return; }
    if (!editUser && !form.password) { showToast('Password is required', 'error'); return; }
    if (form.password && form.password !== form.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setSaving(true);
    setFormError(null);

    const checkRole = form.accessLevel === 'AE_ACCESS' ? 'AE Access' : form.role;
    const access: ModuleAccess[] = [{
      module: 'checks',
      role: checkRole,
      isModuleAdmin: ADMIN_ROLES.includes(checkRole),
      branches: form.branchAll ? [] : form.branches,
      aes: form.aes,
      subsidiary: form.subsidiaries.join('/') || undefined,
    }];

    try {
      if (editUser) {
        const body: Record<string, unknown> = {
          username: editUser.username,
          fullName: form.full_name.trim(),
          access,
        };
        if (form.password) {
          body.resetPassword = true;
          body.tempPassword = form.password;
        }
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('User updated successfully', 'success');
          closeModal();
          fetchUsers();
        } else {
          setFormError(json.error ?? 'Update failed');
          showToast(json.error ?? 'Update failed', 'error');
        }
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email.trim(),
            fullName: form.full_name.trim(),
            portalRole: 'user',
            access,
            tempPassword: form.password || 'Esprint2026!',
          }),
        });
        const json = await res.json();
        if (json.ok) {
          showToast('User created successfully', 'success');
          closeModal();
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

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-gray-400';
  const lbl = 'block text-xs font-semibold text-gray-700 mb-1';
  const isEdit = !!editUser;

  return (
    <div className="p-6 space-y-5 animate-fade-in max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage users, clients, and branches. A user can be assigned to multiple branches.</p>
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
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap bg-white">
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
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white text-gray-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 cursor-pointer shadow-xs"
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
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">NAME</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">EMAIL</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ACCESS / ROLE</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SUBSIDIARY / BRANCHES</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ASSIGNED AES</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">LAST LOGIN</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 w-16 pr-4"></th>
              </tr>
            </thead>
            <tbody>
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
                  const isAllBranches = !branchesList.length || branchesList.includes('ALL');

                  const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', {
                    month: 'numeric', day: 'numeric', year: 'numeric'
                  }) : '';

                  return (
                    <tr
                      key={u.username}
                      className={`border-b border-gray-50 transition-colors ${isChk ? 'bg-blue-50' : 'hover:bg-slate-50'} ${!u.enabled ? 'opacity-60' : ''}`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChk}
                          onChange={() => toggleOne(u.username)}
                          className="rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                        {u.fullName || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{u.email}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide whitespace-nowrap ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200 whitespace-nowrap">
                            {roleName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
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
                          {isAllBranches ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1e3a8a] text-white whitespace-nowrap w-fit">
                              All branches
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {branchesList.map(b => {
                                const bName = branchMap.get(b) ?? b;
                                return (
                                  <span key={b} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 whitespace-nowrap">
                                    {bName}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {isAEUser && !subsidiary && !branchesList.length && null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {aesList.length ? (
                          <div className="flex flex-wrap gap-1">
                            {aesList.map(ae => (
                              <span key={ae} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">
                                {ae}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">— none —</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                              !u.enabled
                                ? 'bg-red-500'
                                : u.status === 'CONFIRMED'
                                ? 'bg-green-500'
                                : 'bg-yellow-400'
                            }`}
                          />
                          <span>
                            {dateStr || (u.enabled ? 'Active' : 'Disabled')}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right pr-4 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit Modal (Exact replicate of original check-monitoring) ── */}
      {mounted && showModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '48px 16px 32px',
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={closeModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
              border: '1px solid rgba(0,0,0,0.06)',
              width: '100%',
              maxWidth: 580,
              marginBottom: 32,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
                  {isEdit ? 'Edit User' : 'Add New User'}
                </h2>
                {isEdit && (
                  <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, marginBottom: 0 }}>
                    {editUser?.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} noValidate className="p-6 space-y-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 break-words">
                  {formError}
                </div>
              )}

              {/* Full name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Full name <span className="text-red-500">*</span></label>
                  <input
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    className={inp}
                    placeholder="Full name"
                    required
                  />
                </div>
                <div>
                  <label className={lbl}>Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={inp}
                    placeholder="user@esprintgroup.com"
                    required
                  />
                  {isEdit && (
                    <p className="text-[11px] text-gray-400 mt-1">Changing email will update the login address.</p>
                  )}
                </div>
              </div>

              {/* Password + Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Password {!isEdit && <span className="text-red-500">*</span>}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className={inp}
                    placeholder={isEdit ? 'Leave blank to keep current' : 'Set a password...'}
                    required={!isEdit}
                  />
                </div>
                <div>
                  <label className={lbl}>Confirm Password {!isEdit && <span className="text-red-500">*</span>}</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className={inp}
                    placeholder={isEdit ? 'Leave blank to keep current' : 'Re-enter password'}
                    required={!isEdit}
                  />
                </div>
              </div>

              {/* Access Level radio cards */}
              <div>
                <label className={lbl}>Access Level</label>
                <div className="grid grid-cols-4 gap-2.5">
                  {(['AE_ACCESS', 'VIEW_ONLY', 'VIEW_EDIT', 'FULL_ACCESS'] as AccessLevel[]).map(level => {
                    const descriptions: Record<AccessLevel, string> = {
                      AE_ACCESS:   'Can only view Client Reports.',
                      VIEW_ONLY:   'Can view checks in assigned branches. Cannot edit or create.',
                      VIEW_EDIT:   'Can view, create, and edit checks across all subsidiaries.',
                      FULL_ACCESS: 'Full access to checks plus admin panel (manage users, clients, branches).',
                    };
                    const labels: Record<AccessLevel, string> = {
                      AE_ACCESS:   'AE ACCESS',
                      VIEW_ONLY:   'VIEW ONLY',
                      VIEW_EDIT:   'VIEW & EDIT',
                      FULL_ACCESS: 'FULL ACCESS',
                    };
                    const active = form.accessLevel === level;
                    return (
                      <label
                        key={level}
                        className={`cursor-pointer border-2 rounded-xl p-2.5 text-center transition-all ${
                          active ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="accessLevel"
                          value={level}
                          checked={active}
                          onChange={() => setAccessLevel(level)}
                          className="sr-only"
                        />
                        <div className={`text-xs font-bold mb-1 ${active ? 'text-blue-700' : 'text-gray-700'}`}>
                          {labels[level]}
                        </div>
                        <div className="text-[10px] text-gray-500 leading-tight">
                          {descriptions[level]}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Role dropdown — hidden for AE Access */}
              {form.accessLevel !== 'AE_ACCESS' && (
                <div>
                  <label className={lbl}>Role</label>
                  <select
                    value={form.role}
                    onChange={e => {
                      const newRole = e.target.value;
                      const access = ROLE_TO_ACCESS[newRole] ?? form.accessLevel;
                      setForm(f => ({ ...f, role: newRole, accessLevel: access }));
                    }}
                    className={inp}
                  >
                    {ALL_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subsidiary multi-select */}
              <div>
                <label className={lbl}>Subsidiary</label>
                <div className="grid grid-cols-4 gap-2 border border-gray-200 rounded-xl p-3 bg-slate-50/50">
                  {subsidiaryOptions.map(s => (
                    <label key={s} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.subsidiaries.includes(s)}
                        onChange={e => setForm(f => ({
                          ...f,
                          subsidiaries: e.target.checked
                            ? [...f.subsidiaries, s]
                            : f.subsidiaries.filter(x => x !== s)
                        }))}
                        className="rounded accent-blue-600"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Assigned Branches */}
              <div>
                <label className={lbl}>Assigned Branches</label>
                <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.branchAll}
                      onChange={e => setForm(f => ({ ...f, branchAll: e.target.checked, branches: [] }))}
                      className="rounded accent-blue-600"
                    />
                    All branches
                  </label>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 16px' }}
                    className="pt-1 max-h-48 overflow-y-auto"
                  >
                    {branchList.map(b => {
                      const isChecked = form.branchAll || form.branches.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                          style={{ opacity: form.branchAll ? 0.6 : 1 }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={form.branchAll}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...form.branches, b.id]
                                : form.branches.filter(x => x !== b.id);
                              setForm(f => ({ ...f, branches: next }));
                            }}
                            className="rounded accent-blue-600"
                          />
                          {b.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Assigned AEs */}
              <div>
                <label className={lbl}>
                  {form.accessLevel === 'AE_ACCESS' ? 'Assigned AEs (TL supervises these AEs)' : 'Assigned AEs'}
                </label>
                <div className="border border-gray-200 rounded-xl p-4 bg-slate-50/50">
                  <input
                    value={aeSearch}
                    onChange={e => setAeSearch(e.target.value)}
                    placeholder="Search AE..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs mb-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 placeholder:text-gray-400 bg-white"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 16px', maxHeight: 180, overflowY: 'auto' }}>
                    {aeOptions
                      .filter(ae => !aeSearch || ae.toLowerCase().includes(aeSearch.toLowerCase()))
                      .map(ae => (
                        <label key={ae} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.aes.includes(ae)}
                            onChange={e => {
                              const next = e.target.checked
                                ? [...form.aes, ae]
                                : form.aes.filter(x => x !== ae);
                              setForm(f => ({ ...f, aes: next }));
                            }}
                            className="rounded accent-blue-600"
                          />
                          {ae}
                        </label>
                      ))}
                  </div>
                </div>
                {form.accessLevel === 'AE_ACCESS' && form.aes.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">⚠ Select at least one AE for this TL to supervise.</p>
                )}
              </div>

              {/* Form buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-800 disabled:opacity-60 transition-colors shadow-sm cursor-pointer"
                >
                  {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
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

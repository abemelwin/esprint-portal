'use client';
/**
 * AdminUsersClient — manage Cognito users for Check Monitoring.
 * Lists users from Cognito, add/edit role & branch access, reset password,
 * enable/disable, delete. Calls /api/admin/users.
 */
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/modules/checks/components/Toast';
import ConfirmDialog from '@/modules/checks/components/ConfirmDialog';

interface ModuleAccess {
  module: string;
  role: string;
  isModuleAdmin: boolean;
  branches: string[];
  aes: string[];
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

const CHECK_ROLES = [
  'Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'AR Staff',
  'Treasury Manager', 'Treasury Staff', 'Branch Manager', 'Branch AR/Finance Staff',
  'Branch Staff', 'AE', 'AE Access',
];

const ADMIN_ROLES = ['Admin', 'Operations', 'Acctg Head', 'AR Manager', 'AR Supervisor', 'Treasury Manager'];

const EMPTY_FORM = {
  email: '', fullName: '', portalRole: 'user' as 'super_admin' | 'user',
  checkRole: 'AR Staff', branchAll: true, branches: [] as string[],
};

interface Props { branches: { id: string; name: string }[]; aeList: string[]; }

export function AdminUsersClient({ branches }: Props) {
  const { showToast } = useToast();
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [search, setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [confirm, setConfirm]   = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

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

  const branchMap = new Map(branches.map(b => [b.id, b.name]));

  function openAdd() { setForm({ ...EMPTY_FORM }); setEditUser(null); setShowForm(true); }
  function openEdit(u: AdminUser) {
    const checks = u.access.find(a => a.module === 'checks');
    setForm({
      email: u.email, fullName: u.fullName, portalRole: u.portalRole,
      checkRole: checks?.role ?? 'AR Staff',
      branchAll: !checks?.branches?.length,
      branches: checks?.branches ?? [],
    });
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
      aes: [],
    }];
  }

  async function saveForm() {
    if (!form.email.trim()) { showToast('Email is required', 'error'); return; }
    setSaving(true);
    try {
      const access = buildAccess();
      if (editUser) {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: editUser.username, fullName: form.fullName, portalRole: form.portalRole, access }),
        });
        const json = await res.json();
        if (json.ok) { showToast('User updated', 'success'); setShowForm(false); fetchUsers(); }
        else showToast(json.error ?? 'Update failed', 'error');
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.trim(), fullName: form.fullName.trim() || form.email.trim(), portalRole: form.portalRole, access, tempPassword: 'Esprint2026!' }),
        });
        const json = await res.json();
        if (json.ok) { showToast('User created — temp password: Esprint2026!', 'success'); setShowForm(false); fetchUsers(); }
        else showToast(json.error ?? 'Create failed', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setSaving(false); }
  }

  async function toggleEnabled(u: AdminUser) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.username, enabled: !u.enabled }),
    });
    const json = await res.json();
    if (json.ok) { showToast(u.enabled ? 'User disabled' : 'User enabled', 'success'); fetchUsers(); }
    else showToast(json.error ?? 'Failed', 'error');
  }

  function resetPassword(u: AdminUser) {
    setConfirm({
      title: 'Reset Password',
      message: `Reset ${u.fullName}'s password to the default (Esprint2026!)? They will be asked to set a new one on next login.`,
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
      message: `Permanently delete ${u.fullName} (${u.email})? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        const res = await fetch('/api/admin/users', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u.username }),
        });
        const json = await res.json();
        if (json.ok) { showToast('User deleted', 'success'); fetchUsers(); }
        else showToast(json.error ?? 'Delete failed', 'error');
      },
    });
  }

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) ||
      u.access.some(a => a.role.toLowerCase().includes(q));
  });

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin &amp; Users</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage who can access Check Monitoring and their role. Users live in AWS Cognito.</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#1e3a8a] hover:bg-blue-700">+ Add User</button>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, role…"
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-full max-w-sm focus:outline-none focus:border-blue-600" />

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-800">Users ({filtered.length})</p>
        </div>
        <div className="overflow-x-auto">
          <table className="report w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Name</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Email</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Portal Role</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Check Role</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Branches</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Status</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">Loading users from Cognito…</td></tr>
              ) : filtered.map(u => {
                const checks = u.access.find(a => a.module === 'checks');
                return (
                  <tr key={u.username} className={`border-t border-gray-50 hover:bg-gray-50 ${!u.enabled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{u.fullName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${u.portalRole === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.portalRole === 'super_admin' ? 'Super Admin' : 'User'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{u.portalRole === 'super_admin' ? '(all)' : checks?.role ?? '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{u.portalRole === 'super_admin' ? 'All' : (checks?.branches?.length ? checks.branches.map(b => branchMap.get(b) ?? b).join(', ') : 'All')}</td>
                    <td className="px-4 py-2.5">
                      {u.enabled
                        ? <span className="text-green-600 font-semibold">Active</span>
                        : <span className="text-gray-400 font-semibold">Disabled</span>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline mr-2">Edit</button>
                      <button onClick={() => resetPassword(u)} className="text-xs text-amber-600 hover:underline mr-2">Reset PW</button>
                      <button onClick={() => toggleEnabled(u)} className="text-xs text-gray-500 hover:underline mr-2">{u.enabled ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => deleteUser(u)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400 italic">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">{editUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className={lbl}>Email <span className="text-red-500">*</span></label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editUser}
                  className={inp + (editUser ? ' bg-gray-100' : '')} placeholder="user@esprintmedia.com" />
              </div>
              <div>
                <label className={lbl}>Full Name</label>
                <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} className={inp} placeholder="Juan Dela Cruz" />
              </div>
              <div>
                <label className={lbl}>Portal Role</label>
                <select value={form.portalRole} onChange={e => setForm(f => ({ ...f, portalRole: e.target.value as 'super_admin' | 'user' }))} className={inp}>
                  <option value="user">User (module access only)</option>
                  <option value="super_admin">Super Admin (all modules)</option>
                </select>
              </div>
              {form.portalRole === 'user' && (
                <>
                  <div>
                    <label className={lbl}>Check Monitoring Role</label>
                    <select value={form.checkRole} onChange={e => setForm(f => ({ ...f, checkRole: e.target.value }))} className={inp}>
                      {CHECK_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
                      <input type="checkbox" checked={form.branchAll} onChange={e => setForm(f => ({ ...f, branchAll: e.target.checked }))} className="accent-blue-600" />
                      All branches
                    </label>
                    {!form.branchAll && (
                      <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                        {branches.map(b => (
                          <label key={b.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer px-1 py-0.5 hover:bg-gray-50 rounded">
                            <input type="checkbox" checked={form.branches.includes(b.id)}
                              onChange={() => setForm(f => ({ ...f, branches: f.branches.includes(b.id) ? f.branches.filter(x => x !== b.id) : [...f.branches, b.id] }))}
                              className="accent-blue-600" />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {!editUser && (
                <p className="text-xs text-gray-400">Temporary password will be <strong>Esprint2026!</strong> — the user sets their own on first login.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={saveForm} disabled={saving || !form.email.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e3a8a] text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : editUser ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm !== null} title={confirm?.title ?? ''} message={confirm?.message ?? ''}
        confirmText="Confirm" danger onConfirm={() => confirm?.onConfirm()} onCancel={() => setConfirm(null)} />
    </div>
  );
}

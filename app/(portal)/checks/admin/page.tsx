import { redirect } from "next/navigation";
import { getCheckContext } from "../lib/access";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

interface AccessRow {
  email: string;
  full_name: string;
  module_role: string;
  is_module_admin: boolean;
  branches: string[];
}

export default async function CheckAdminPage() {
  const ctx = await getCheckContext();
  if (!ctx || !ctx.isAdmin) redirect("/checks");

  // Users who have access to the checks module
  let rows: AccessRow[] = [];
  try {
    rows = await query<AccessRow>(
      `SELECT u.email, u.full_name, ma.module_role, ma.is_module_admin, ma.branches
       FROM public.module_access ma
       JOIN public.portal_users u ON u.id = ma.user_id
       WHERE ma.module = 'checks'
       ORDER BY u.full_name`
    );
  } catch {
    rows = [];
  }

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin &amp; Users</h1>
        <p className="text-xs text-gray-400 mt-0.5">Manage who can access Check Monitoring and their role.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        As a Check Monitoring admin, you can assign roles to users within this module.
        User invites &amp; role editing are wired to AWS Cognito (coming next).
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-800">Users with Check Monitoring access</p>
          <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium opacity-60 cursor-not-allowed" disabled>
            + Add User
          </button>
        </div>
        <table className="report w-full text-xs">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Name</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Email</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Role</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Branches</th>
              <th className="px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Module Admin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-t border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-800">{r.full_name}</td>
                <td className="px-4 py-2.5 text-gray-600">{r.email}</td>
                <td className="px-4 py-2.5"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">{r.module_role}</span></td>
                <td className="px-4 py-2.5 text-gray-500">{r.branches?.length ? r.branches.join(", ") : "All"}</td>
                <td className="px-4 py-2.5">{r.is_module_admin ? "✓" : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400 italic">No users assigned yet. Once Cognito is wired, assign users here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

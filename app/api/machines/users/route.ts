/**
 * /api/machines/users
 *   GET    — list all users that have machine monitoring module access
 *   POST   — create a new machine monitoring user / grant access
 *   PATCH  — update a user's machine monitoring role / AE assignments / name or reset password
 *   DELETE — remove access / deactivate user
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, isSuperAdmin, isModuleAdmin } from "@/lib/rbac";
import {
  listCognitoUsers,
  updateCognitoUser,
  resetCognitoPassword,
  createCognitoUser,
  deleteCognitoUser,
} from "@/lib/cognito-admin";
import type { ModuleAccess } from "@/lib/rbac";
import { query } from "@/lib/db";

async function requireMachinesAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "machines")) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const isAdmin = isSuperAdmin(user) || isModuleAdmin(user, "machines");
  if (!isAdmin) {
    return { ok: false as const, res: NextResponse.json({ error: "Machines admin only" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

async function getFallbackMachineUsers() {
  try {
    const rows = await query<{
      email: string;
      full_name: string;
      portal_role: string;
      is_active: boolean;
      module_role: string;
      is_module_admin: boolean;
      aes: string[];
    }>(
      `SELECT pu.email, pu.full_name, pu.portal_role, pu.is_active,
              COALESCE(ma.module_role, 'account_exec') AS module_role,
              COALESCE(ma.is_module_admin, false) AS is_module_admin,
              COALESCE(ma.aes, '{}') AS aes
       FROM public.portal_users pu
       LEFT JOIN public.module_access ma ON pu.id = ma.user_id AND ma.module = 'machines'
       WHERE pu.is_active = true
       ORDER BY pu.email ASC`
    );

    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const aeList = Array.isArray(r.aes) ? r.aes : [];
        const aeCode = aeList.length > 0 ? aeList[0] : null;
        const approvedAes = aeList.length > 1 ? aeList.slice(1) : (aeList.length === 1 ? aeList : []);

        return {
          username: r.email,
          email: r.email,
          fullName: r.full_name || r.email.split("@")[0],
          displayName: r.full_name || r.email.split("@")[0],
          portalRole: r.portal_role as "super_admin" | "user",
          machineRole: r.module_role,
          roleKey: r.module_role,
          aeCode,
          approvedAes,
          enabled: r.is_active,
          access: [
            {
              module: "machines",
              role: r.module_role,
              isModuleAdmin: r.is_module_admin,
              branches: [],
              aes: aeList,
            },
          ],
        };
      });
    }
  } catch (err) {
    console.error("RDS fallback machine users load error:", err);
  }
  return [];
}

export async function GET() {
  const guard = await requireMachinesAdmin();
  if (!guard.ok) return guard.res;

  let allUsers: any[] = [];
  try {
    allUsers = await listCognitoUsers();
  } catch (err) {
    console.warn("AWS Cognito fetch failed (using AWS RDS fallback):", (err as Error).message);
  }

  if (!allUsers || allUsers.length === 0) {
    allUsers = await getFallbackMachineUsers();
  } else {
    // Format Cognito users for machine monitoring admin
    allUsers = allUsers.map((u) => {
      const access: ModuleAccess[] = Array.isArray(u.access) ? u.access : [];
      const machEntry = access.find((a) => a.module === "machines");
      const roleKey = machEntry?.role || "account_exec";
      const aeList = machEntry?.aes || [];
      const aeCode = aeList.length > 0 ? aeList[0] : null;
      const approvedAes = aeList.length > 1 ? aeList.slice(1) : (aeList.length === 1 ? aeList : []);

      return {
        username: u.username || u.email,
        email: u.email,
        fullName: u.fullName || u.email?.split("@")[0] || "",
        displayName: u.fullName || u.email?.split("@")[0] || "",
        portalRole: u.portalRole || "user",
        machineRole: roleKey,
        roleKey,
        aeCode,
        approvedAes,
        enabled: u.enabled !== false,
        access,
      };
    });
  }

  return NextResponse.json({ ok: true, users: allUsers });
}

export async function POST(req: NextRequest) {
  const guard = await requireMachinesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const fullName = (body.fullName || body.displayName || email.split("@")[0]).trim();
    const password = body.password || "Esprint2026!";
    const roleKey = body.roleKey || body.machineRole || "account_exec";
    const aeCode = body.aeCode ? body.aeCode.trim().toUpperCase() : null;
    const approvedAes: string[] = Array.isArray(body.approvedAes)
      ? body.approvedAes.map((s: string) => s.trim().toUpperCase()).filter(Boolean)
      : [];

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const isModuleAdmin = ["Admin", "super_admin", "inventory_accounting"].includes(roleKey);
    const combinedAes = aeCode ? Array.from(new Set([aeCode, ...approvedAes])) : approvedAes;

    // Save to AWS RDS PostgreSQL
    try {
      const resUser = await query<{ id: string }>(
        `INSERT INTO public.portal_users (email, full_name, portal_role, is_active)
         VALUES ($1, $2, 'user', true)
         ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name, is_active = true, updated_at = NOW()
         RETURNING id`,
        [email, fullName]
      );
      if (resUser.length > 0) {
        await query(
          `INSERT INTO public.module_access (user_id, module, module_role, is_module_admin, aes)
           VALUES ($1, 'machines', $2, $3, $4)
           ON CONFLICT (user_id, module) DO UPDATE
           SET module_role = EXCLUDED.module_role, is_module_admin = EXCLUDED.is_module_admin, aes = EXCLUDED.aes, updated_at = NOW()`,
          [resUser[0].id, roleKey, isModuleAdmin, combinedAes]
        );
      }
    } catch (dbErr) {
      console.error("AWS RDS insert machine user error:", dbErr);
    }

    // Try creating in Cognito
    try {
      await createCognitoUser({
        email,
        fullName,
        portalRole: "user",
        access: [{ module: "machines", role: roleKey, isModuleAdmin, branches: [], aes: combinedAes }],
        tempPassword: password,
        permanent: true,
      });
    } catch (cogErr) {
      console.warn("Cognito create user warning:", cogErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/machines/users error:", err);
    return NextResponse.json({ error: "Failed to create user: " + (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireMachinesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const body = await req.json();
    const { username, action } = body;
    if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

    if (action === "reset_password") {
      const { newPassword } = body;
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      try {
        await resetCognitoPassword(username, newPassword);
      } catch (err) {
        console.warn("Cognito password reset warning:", err);
      }
      return NextResponse.json({ ok: true });
    }

    const email = username.toLowerCase();
    const roleKey = body.roleKey ?? body.machineRole;
    const aeCode = body.aeCode !== undefined ? (body.aeCode ? body.aeCode.trim().toUpperCase() : null) : undefined;
    const approvedAes = Array.isArray(body.approvedAes)
      ? body.approvedAes.map((s: string) => s.trim().toUpperCase()).filter(Boolean)
      : undefined;

    // Update AWS RDS PostgreSQL
    if (body.displayName || body.fullName) {
      await query(`UPDATE public.portal_users SET full_name = $1, updated_at = NOW() WHERE LOWER(email) = $2`, [
        body.displayName || body.fullName,
        email,
      ]);
    }

    if (roleKey !== undefined || aeCode !== undefined || approvedAes !== undefined) {
      const u = await query<{ id: string }>(`SELECT id FROM public.portal_users WHERE LOWER(email) = $1`, [email]);
      if (u.length > 0) {
        const isModuleAdmin = ["Admin", "super_admin", "inventory_accounting"].includes(roleKey || "");
        const combinedAes = aeCode ? Array.from(new Set([aeCode, ...(approvedAes || [])])) : (approvedAes || []);

        await query(
          `INSERT INTO public.module_access (user_id, module, module_role, is_module_admin, aes)
           VALUES ($1, 'machines', $2, $3, $4)
           ON CONFLICT (user_id, module) DO UPDATE
           SET module_role = COALESCE($2, module_access.module_role),
               is_module_admin = $3,
               aes = $4,
               updated_at = NOW()`,
          [u[0].id, roleKey || "account_exec", isModuleAdmin, combinedAes]
        );
      }
    }

    // Update AWS Cognito
    try {
      let allUsers: any[] = [];
      try { allUsers = await listCognitoUsers(); } catch {}
      const userObj = allUsers.find((x) => x.username === username || x.email?.toLowerCase() === email);

      if (userObj) {
        let access: ModuleAccess[] = Array.isArray(userObj.access) ? [...userObj.access] : [];
        const machIdx = access.findIndex((a) => a.module === "machines");
        const isModuleAdmin = ["Admin", "super_admin", "inventory_accounting"].includes(roleKey || "");
        const combinedAes = aeCode ? Array.from(new Set([aeCode, ...(approvedAes || [])])) : (approvedAes || []);

        if (machIdx >= 0) {
          if (roleKey !== undefined) access[machIdx].role = roleKey;
          access[machIdx].isModuleAdmin = isModuleAdmin;
          if (aeCode !== undefined || approvedAes !== undefined) access[machIdx].aes = combinedAes;
        } else if (roleKey !== undefined) {
          access.push({
            module: "machines",
            role: roleKey,
            isModuleAdmin,
            branches: [],
            aes: combinedAes,
          });
        }

        await updateCognitoUser({
          username: userObj.username,
          fullName: body.displayName || body.fullName || userObj.fullName,
          access,
        });
      }
    } catch (err) {
      console.warn("Cognito user update warning:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/machines/users error:", err);
    return NextResponse.json({ error: "Update failed: " + (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireMachinesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "username parameter required" }, { status: 400 });

    const email = username.toLowerCase();

    // Soft delete / remove machine module access in RDS
    const u = await query<{ id: string }>(`SELECT id FROM public.portal_users WHERE LOWER(email) = $1`, [email]);
    if (u.length > 0) {
      await query(`DELETE FROM public.module_access WHERE user_id = $1 AND module = 'machines'`, [u[0].id]);
    }

    // Update Cognito access
    try {
      const allUsers = await listCognitoUsers();
      const userObj = allUsers.find((x) => x.username === username || x.email?.toLowerCase() === email);
      if (userObj) {
        const newAccess = (userObj.access || []).filter((a: any) => a.module !== "machines");
        await updateCognitoUser({ username: userObj.username, access: newAccess });
      }
    } catch (err) {
      console.warn("Cognito access removal warning:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/machines/users error:", err);
    return NextResponse.json({ error: "Delete failed: " + (err as Error).message }, { status: 500 });
  }
}

/**
 * /api/sales/users
 *   GET    — list all users that have sales module access
 *   POST   — create a new sales user
 *   PATCH  — update a user's sales role / permissions / name or reset password
 *   DELETE — delete a user
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import {
  listCognitoUsers,
  updateCognitoUser,
  resetCognitoPassword,
  createCognitoUser,
  deleteCognitoUser,
} from "@/lib/cognito-admin";
import type { ModuleAccess } from "@/lib/rbac";
import { query } from "@/lib/db";

async function requireSalesAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageUsers) {
    return { ok: false as const, res: NextResponse.json({ error: "Sales admin only" }, { status: 403 }) };
  }
  return { ok: true as const, user };
}

function normalizeSalesRole(roleVal?: string, email?: string): string {
  const em = (email || "").toLowerCase().trim();
  if (em === "vin@esprintmedia.com") return "product_technical_head";
  if ([
    "ron@esprintmedia.com", "janmark@esprintmedia.com", "jonjon@esprintmedia.com",
    "albert@esprintmedia.com", "armando@esprintmedia.com", "arnulfo@esprintmedia.com",
    "francis@esprintmedia.com", "kimpee@esprintmedia.com", "mark@esprintmedia.com",
    "rj@esprintmedia.com"
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

async function getFallbackSalesUsers() {
  try {
    const rows = await query<{
      email: string;
      full_name: string;
      portal_role: string;
      is_active: boolean;
      module_role: string;
      is_module_admin: boolean;
    }>(
      `SELECT pu.email, pu.full_name, pu.portal_role, pu.is_active,
              COALESCE(ma.module_role, 'account_executive') AS module_role,
              COALESCE(ma.is_module_admin, false) AS is_module_admin
       FROM public.portal_users pu
       LEFT JOIN public.module_access ma ON pu.id = ma.user_id AND ma.module = 'sales'
       WHERE pu.is_active = true
       ORDER BY pu.email ASC`
    );

    if (rows && rows.length > 0) {
      return rows.map((r) => {
        const normRole = normalizeSalesRole(r.module_role, r.email);
        return {
          username: r.email,
          email: r.email,
          fullName: r.full_name || r.email.split("@")[0],
          portalRole: r.portal_role as "super_admin" | "user",
          salesRole: normRole,
          enabled: r.is_active,
          access: [
            {
              module: "sales",
              role: normRole,
              isModuleAdmin: r.is_module_admin,
              branches: [],
              aes: [],
            },
          ],
        };
      });
    }
  } catch (err) {
    console.error("RDS fallback sales users load error:", err);
  }
  return [];
}

export async function GET() {
  const guard = await requireSalesAdmin();
  if (!guard.ok) return guard.res;

  let allUsers: any[] = [];
  try {
    allUsers = await listCognitoUsers();
  } catch (err) {
    console.warn("AWS Cognito fetch failed (using AWS RDS fallback):", (err as Error).message);
  }

  if (!allUsers || allUsers.length === 0) {
    allUsers = await getFallbackSalesUsers();
  } else {
    allUsers = allUsers.map((u) => {
      const access: ModuleAccess[] = Array.isArray(u.access) ? u.access : [];
      const salesEntry = access.find((a) => a.module === "sales");
      const normRole = normalizeSalesRole(salesEntry?.role || u.salesRole, u.email);

      return {
        ...u,
        salesRole: normRole,
        access: access.map((a) => (a.module === "sales" ? { ...a, role: normRole } : a)),
      };
    });
  }

  return NextResponse.json({ ok: true, users: allUsers });
}

export async function POST(req: NextRequest) {
  const guard = await requireSalesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const fullName = (body.fullName || body.name || email.split("@")[0]).trim();
    const password = body.password;
    const salesRole = body.salesRole || "user";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedSalesRole = salesRole === "superadmin" || salesRole === "Super Admin" ? "Admin" : salesRole;
    const portalRole = "user";
    const isModuleAdmin = ["Admin", "sales_admin_manager"].includes(normalizedSalesRole);

    // Save to AWS RDS PostgreSQL
    try {
      const resUser = await query<{ id: string }>(
        `INSERT INTO public.portal_users (email, full_name, portal_role, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name, is_active = true, updated_at = NOW()
         RETURNING id`,
        [email, fullName, portalRole]
      );
      if (resUser.length > 0) {
        await query(
          `INSERT INTO public.module_access (user_id, module, module_role, is_module_admin)
           VALUES ($1, 'sales', $2, $3)
           ON CONFLICT (user_id, module) DO UPDATE
           SET module_role = EXCLUDED.module_role, is_module_admin = EXCLUDED.is_module_admin, updated_at = NOW()`,
          [resUser[0].id, normalizedSalesRole, isModuleAdmin]
        );
      }
    } catch (dbErr) {
      console.error("AWS RDS insert user error:", dbErr);
    }

    // Try creating in Cognito as well
    try {
      await createCognitoUser({
        email,
        fullName,
        portalRole: portalRole as "super_admin" | "user",
        access: [{ module: "sales", role: salesRole, isModuleAdmin, branches: [], aes: [] }],
        tempPassword: password,
        permanent: true,
      });
    } catch (cogErr) {
      console.warn("Cognito create user warning:", cogErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/sales/users error:", err);
    return NextResponse.json({ error: "Failed to create user: " + (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireSalesAdmin();
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
    const ROLE_ADMIN = ["Admin", "sales_admin_manager"];

    // Update AWS RDS PostgreSQL
    if (body.name !== undefined) {
      await query(`UPDATE public.portal_users SET full_name = $1, updated_at = NOW() WHERE LOWER(email) = $2`, [
        body.name,
        email,
      ]);
    }
    if (body.salesRole !== undefined) {
      const isAdmin = ROLE_ADMIN.includes(body.salesRole);
      const u = await query<{ id: string }>(`SELECT id FROM public.portal_users WHERE LOWER(email) = $1`, [email]);
      if (u.length > 0) {
        await query(
          `INSERT INTO public.module_access (user_id, module, module_role, is_module_admin)
           VALUES ($1, 'sales', $2, $3)
           ON CONFLICT (user_id, module) DO UPDATE
           SET module_role = EXCLUDED.module_role, is_module_admin = EXCLUDED.is_module_admin, updated_at = NOW()`,
          [u[0].id, body.salesRole, isAdmin]
        );
      }
    }

    // Update AWS Cognito
    if (body.salesRole !== undefined || body.salesPerms !== undefined || body.name !== undefined) {
      let allUsers: any[] = [];
      try {
        allUsers = await listCognitoUsers();
      } catch {}

      if (!allUsers || allUsers.length === 0) {
        allUsers = await getFallbackSalesUsers();
      }

      const userObj = allUsers.find(
        (x) => x.username === username || x.email?.toLowerCase() === email
      );

      if (!userObj) {
        return NextResponse.json({ error: `User not found: ${username}` }, { status: 404 });
      }

      let access: ModuleAccess[] = Array.isArray(userObj.access) ? [...userObj.access] : [];
      const salesIdx = access.findIndex((a) => a.module === "sales");

      if (salesIdx >= 0) {
        if (body.salesRole !== undefined) {
          access[salesIdx].role = body.salesRole;
          access[salesIdx].isModuleAdmin = ROLE_ADMIN.includes(body.salesRole);
        }
        if (body.salesPerms !== undefined) {
          (access[salesIdx] as any).perms = body.salesPerms;
        }
      } else if (body.salesRole !== undefined) {
        access.push({
          module: "sales",
          role: body.salesRole,
          isModuleAdmin: ROLE_ADMIN.includes(body.salesRole),
          branches: [],
          aes: [],
        });
      }

      try {
        await updateCognitoUser({
          username: userObj.username,
          fullName: body.name ?? userObj.fullName,
          access,
        });
      } catch (err) {
        // Surface Cognito errors — don't swallow them
        const msg = (err as Error).message ?? String(err);
        console.error("Cognito user update error:", msg);
        return NextResponse.json({ error: `Failed to update user access: ${msg}` }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/sales/users error:", err);
    return NextResponse.json({ error: "Update failed: " + (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireSalesAdmin();
  if (!guard.ok) return guard.res;

  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    if (!username) return NextResponse.json({ error: "username parameter required" }, { status: 400 });

    const email = username.toLowerCase();

    // Soft delete in AWS RDS PostgreSQL
    await query(`UPDATE public.portal_users SET is_active = false, updated_at = NOW() WHERE LOWER(email) = $1`, [email]);

    // Try deleting from Cognito
    try {
      await deleteCognitoUser(username);
    } catch (err) {
      console.warn("Cognito delete user warning:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sales/users error:", err);
    return NextResponse.json({ error: "Delete failed: " + (err as Error).message }, { status: 500 });
  }
}

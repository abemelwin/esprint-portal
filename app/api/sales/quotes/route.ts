/**
 * GET  /api/sales/quotes   — list quotes (own quotes, or all if canViewAllQuotes)
 * POST /api/sales/quotes   — create a new quote + sub-tables
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Quote } from "@/modules/sales/types";

const S = "sales_portal";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms        = getSalesPermissions(user);
  const { searchParams } = new URL(req.url);
  const q            = searchParams.get("q");

  try {
    let sql = `
      SELECT id, user_id, user_email, machine_id,
             client_name, company, quote_date, deal_type, contract_price,
             letterhead, under_promo, vat_inclusive, created_at, updated_at
      FROM ${S}.quotes
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Non-admins see only their own quotes (matches orig RLS by user_id)
    if (!perms.canViewAllQuotes) {
      params.push(user.email);
      sql += ` AND user_email = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (client_name ILIKE $${params.length} OR company ILIKE $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 200`;

    const quotes = await query<Quote>(sql, params);
    return NextResponse.json({ quotes });
  } catch (err) {
    console.error("GET /api/sales/quotes error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      machine_id,
      client_name, company, address, contact, email,
      quote_date, salutation, opening_line,
      deal_type, contract_price,
      vat_inclusive = false,
      under_promo = false, promo_validity,
      unit_condition_override,
      include_delivery = false,
      include_computer_set = false, computer_set_spec,
      inclusion_toggles, exclusion_toggles, addon_toggles,
      warranty_company, warranty_supplier,
      availability, collection_payment, collection_downpayment, collection_amortization,
      ae_name, client_conforme, noted_by_name, noted_by_role,
      letterhead = "ES Print Media Inc.",
      freebies = [],
      term_options = [],
      trade_ins = [],
      consumable_prices = [],
    } = body;

    // Resolve portal_users.id from email (best-effort)
    let userId: string | null = null;
    try {
      const u = await query<{ id: string }>(
        `SELECT id FROM public.portal_users WHERE email = $1 LIMIT 1`,
        [user.email]
      );
      userId = u[0]?.id ?? null;
    } catch { /* ignore */ }

    const rows = await query<{ id: string }>(
      `INSERT INTO ${S}.quotes
         (user_id, user_email, machine_id,
          client_name, company, address, contact, email,
          quote_date, salutation, opening_line,
          deal_type, contract_price, vat_inclusive, under_promo, promo_validity,
          unit_condition_override,
          include_delivery, include_computer_set, computer_set_spec,
          inclusion_toggles, exclusion_toggles, addon_toggles,
          warranty_company, warranty_supplier,
          availability, collection_payment, collection_downpayment, collection_amortization,
          ae_name, client_conforme, noted_by_name, noted_by_role,
          letterhead, freebies)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
       RETURNING id`,
      [
        userId, user.email, machine_id ?? null,
        client_name ?? null, company ?? null, address ?? null, contact ?? null, email ?? null,
        quote_date ?? null, salutation ?? null, opening_line ?? null,
        deal_type ?? null, contract_price ?? null, vat_inclusive, under_promo, promo_validity ?? null,
        unit_condition_override ?? null,
        include_delivery, include_computer_set, computer_set_spec ?? null,
        inclusion_toggles ? JSON.stringify(inclusion_toggles) : null,
        exclusion_toggles ? JSON.stringify(exclusion_toggles) : null,
        addon_toggles     ? JSON.stringify(addon_toggles)     : null,
        warranty_company ?? null, warranty_supplier ?? null,
        availability ?? null, collection_payment ?? null, collection_downpayment ?? null, collection_amortization ?? null,
        ae_name ?? null, client_conforme ?? null, noted_by_name ?? null, noted_by_role ?? null,
        letterhead, JSON.stringify(freebies),
      ]
    );

    const quoteId = rows[0].id;

    // Insert sub-tables
    for (let i = 0; i < term_options.length; i++) {
      const t = term_options[i];
      await query(
        `INSERT INTO ${S}.quote_term_options (quote_id, down_payment, months, monthly_amortization, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [quoteId, t.down_payment ?? 0, t.months, t.monthly_amortization ?? null, i]
      );
    }
    for (let i = 0; i < Math.min(trade_ins.length, 3); i++) {
      const t = trade_ins[i];
      await query(
        `INSERT INTO ${S}.quote_trade_ins (quote_id, description, value, sort_order) VALUES ($1,$2,$3,$4)`,
        [quoteId, t.description || "", t.value ?? 0, i]
      );
    }
    for (const cp of consumable_prices) {
      if (!cp.consumable_id) continue;
      await query(
        `INSERT INTO ${S}.quote_consumable_prices (quote_id, consumable_id, custom_price) VALUES ($1,$2,$3)`,
        [quoteId, cp.consumable_id, cp.custom_price ?? 0]
      );
    }

    return NextResponse.json({ success: true, id: quoteId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sales/quotes error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

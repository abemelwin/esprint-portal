/**
 * GET    /api/sales/quotes/[id]  — load one quote + sub-tables
 * PUT    /api/sales/quotes/[id]  — update quote + replace sub-tables
 * DELETE /api/sales/quotes/[id]  — delete quote (cascades to sub-tables)
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Quote } from "@/modules/sales/types";

const S = "sales_portal";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quotes = await query<Quote>(`SELECT * FROM ${S}.quotes WHERE id = $1`, [params.id]);
    if (!quotes.length) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    const q = quotes[0];
    // Scope check — non-admins can only see own quotes
    const perms = getSalesPermissions(user);
    if (!perms.canViewAllQuotes && q.user_email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [term_options, trade_ins, consumable_prices] = await Promise.all([
      query(`SELECT * FROM ${S}.quote_term_options WHERE quote_id = $1 ORDER BY sort_order`, [params.id]),
      query(`SELECT * FROM ${S}.quote_trade_ins    WHERE quote_id = $1 ORDER BY sort_order`, [params.id]),
      query(`SELECT * FROM ${S}.quote_consumable_prices WHERE quote_id = $1`,                 [params.id]),
    ]);

    return NextResponse.json({ quote: { ...q, term_options, trade_ins, consumable_prices } });
  } catch (err) {
    console.error("GET /api/sales/quotes/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ownership check
    const existing = await query<{ user_email: string }>(
      `SELECT user_email FROM ${S}.quotes WHERE id = $1`, [params.id]
    );
    if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const perms = getSalesPermissions(user);
    if (!perms.canViewAllQuotes && existing[0].user_email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      machine_id,
      client_name, company, address, contact, email,
      quote_date, salutation, opening_line,
      deal_type, contract_price,
      vat_inclusive, under_promo, promo_validity,
      unit_condition_override,
      include_delivery, include_computer_set, computer_set_spec,
      inclusion_toggles, exclusion_toggles, addon_toggles,
      warranty_company, warranty_supplier,
      availability, collection_payment, collection_downpayment, collection_amortization,
      ae_name, client_conforme, noted_by_name, noted_by_role,
      letterhead, freebies,
      term_options, trade_ins, consumable_prices,
    } = body;

    await query(
      `UPDATE ${S}.quotes SET
        machine_id=$1, client_name=$2, company=$3, address=$4, contact=$5, email=$6,
        quote_date=$7, salutation=$8, opening_line=$9,
        deal_type=$10, contract_price=$11, vat_inclusive=$12, under_promo=$13, promo_validity=$14,
        unit_condition_override=$15, include_delivery=$16, include_computer_set=$17, computer_set_spec=$18,
        inclusion_toggles=$19, exclusion_toggles=$20, addon_toggles=$21,
        warranty_company=$22, warranty_supplier=$23,
        availability=$24, collection_payment=$25, collection_downpayment=$26, collection_amortization=$27,
        ae_name=$28, client_conforme=$29, noted_by_name=$30, noted_by_role=$31,
        letterhead=$32, freebies=$33, updated_at=now()
      WHERE id=$34`,
      [
        machine_id ?? null, client_name ?? null, company ?? null, address ?? null, contact ?? null, email ?? null,
        quote_date ?? null, salutation ?? null, opening_line ?? null,
        deal_type ?? null, contract_price ?? null,
        vat_inclusive ?? false, under_promo ?? false, promo_validity ?? null,
        unit_condition_override ?? null, include_delivery ?? false, include_computer_set ?? false, computer_set_spec ?? null,
        inclusion_toggles ? JSON.stringify(inclusion_toggles) : null,
        exclusion_toggles ? JSON.stringify(exclusion_toggles) : null,
        addon_toggles     ? JSON.stringify(addon_toggles)     : null,
        warranty_company ?? null, warranty_supplier ?? null,
        availability ?? null, collection_payment ?? null, collection_downpayment ?? null, collection_amortization ?? null,
        ae_name ?? null, client_conforme ?? null, noted_by_name ?? null, noted_by_role ?? null,
        letterhead ?? "ES Print Media Inc.", JSON.stringify(freebies ?? []),
        params.id,
      ]
    );

    // Replace sub-tables
    await query(`DELETE FROM ${S}.quote_term_options       WHERE quote_id = $1`, [params.id]);
    await query(`DELETE FROM ${S}.quote_trade_ins          WHERE quote_id = $1`, [params.id]);
    await query(`DELETE FROM ${S}.quote_consumable_prices  WHERE quote_id = $1`, [params.id]);

    if (Array.isArray(term_options)) {
      for (let i = 0; i < term_options.length; i++) {
        const t = term_options[i];
        await query(
          `INSERT INTO ${S}.quote_term_options (quote_id, down_payment, months, monthly_amortization, sort_order) VALUES ($1,$2,$3,$4,$5)`,
          [params.id, t.down_payment ?? 0, t.months, t.monthly_amortization ?? null, i]
        );
      }
    }
    if (Array.isArray(trade_ins)) {
      for (let i = 0; i < Math.min(trade_ins.length, 3); i++) {
        const t = trade_ins[i];
        await query(
          `INSERT INTO ${S}.quote_trade_ins (quote_id, description, value, sort_order) VALUES ($1,$2,$3,$4)`,
          [params.id, t.description || "", t.value ?? 0, i]
        );
      }
    }
    if (Array.isArray(consumable_prices)) {
      for (const cp of consumable_prices) {
        if (!cp.consumable_id) continue;
        await query(
          `INSERT INTO ${S}.quote_consumable_prices (quote_id, consumable_id, custom_price) VALUES ($1,$2,$3)`,
          [params.id, cp.consumable_id, cp.custom_price ?? 0]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PUT /api/sales/quotes/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Ownership check
    const existing = await query<{ user_email: string }>(
      `SELECT user_email FROM ${S}.quotes WHERE id = $1`, [params.id]
    );
    if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const perms = getSalesPermissions(user);
    if (!perms.canViewAllQuotes && existing[0].user_email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sub-tables cascade on delete via FK ON DELETE CASCADE
    await query(`DELETE FROM ${S}.quotes WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/sales/quotes/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

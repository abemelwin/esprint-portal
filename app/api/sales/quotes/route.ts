import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Quote, QuoteItem } from "@/modules/sales/types";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const perms = getSalesPermissions(user);
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  try {
    let sql = `
      SELECT 
        id, quote_number, user_id, user_email, client_name, company_name,
        contact_number, email, address, deal_type, letterhead,
        term_months, down_payment_pct, interest_rate_pct, total_amount,
        monthly_payment, signatory_name, signatory_title, notes, status,
        created_at, updated_at
      FROM sales_portal.quotes
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Salespeople only see their own quotes unless admin
    if (!perms.canViewAllQuotes) {
      params.push(user.email);
      sql += ` AND user_email = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (quote_number ILIKE $${params.length} OR client_name ILIKE $${params.length} OR company_name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const quotes = await query<Quote>(sql, params);
    return NextResponse.json({ quotes });
  } catch (err) {
    console.error("Error fetching quotes:", err);
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
      client_name,
      company_name,
      contact_number,
      email,
      address,
      deal_type = "Cash",
      letterhead = "ES Print Media Inc.",
      term_months = 0,
      down_payment_pct = 0,
      interest_rate_pct = 0,
      total_amount = 0,
      monthly_payment = 0,
      signatory_name,
      signatory_title,
      notes,
      items = [],
    } = body;

    if (!client_name) {
      return NextResponse.json({ error: "Client Name is required" }, { status: 400 });
    }

    // Generate unique quote number: e.g. Q-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const quoteNumber = `QT-${dateStr}-${randomHex}`;

    const rows = await query<{ id: string }>(
      `
      INSERT INTO sales_portal.quotes (
        quote_number, user_id, user_email, client_name, company_name,
        contact_number, email, address, deal_type, letterhead,
        term_months, down_payment_pct, interest_rate_pct, total_amount,
        monthly_payment, signatory_name, signatory_title, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'Active')
      RETURNING id
      `,
      [
        quoteNumber,
        user.id || null,
        user.email,
        client_name,
        company_name || null,
        contact_number || null,
        email || null,
        address || null,
        deal_type,
        letterhead,
        term_months,
        down_payment_pct,
        interest_rate_pct,
        total_amount,
        monthly_payment,
        signatory_name || user.fullName,
        signatory_title || "Sales Executive",
        notes || null,
      ]
    );

    const quoteId = rows[0].id;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await query(
          `
          INSERT INTO sales_portal.quote_items (
            quote_id, machine_id, machine_name, unit_price, quantity, total_price, details
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            quoteId,
            item.machine_id || null,
            item.machine_name || "Machine Unit",
            item.unit_price || 0,
            item.quantity || 1,
            item.total_price || 0,
            JSON.stringify(item.details || {}),
          ]
        );
      }
    }

    return NextResponse.json({ success: true, quoteNumber, quoteId }, { status: 201 });
  } catch (err) {
    console.error("Error creating quote:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

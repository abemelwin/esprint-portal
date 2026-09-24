import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import { query } from "@/lib/db";
import type { Quote, QuoteItem } from "@/modules/sales/types";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const quotes = await query<Quote>(
      `SELECT * FROM sales_portal.quotes WHERE id = $1`,
      [params.id]
    );

    if (!quotes.length) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const items = await query<QuoteItem>(
      `SELECT * FROM sales_portal.quote_items WHERE quote_id = $1`,
      [params.id]
    );

    return NextResponse.json({ quote: { ...quotes[0], items } });
  } catch (err) {
    console.error("Error fetching quote:", err);
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
    await query(`DELETE FROM sales_portal.quotes WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting quote:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

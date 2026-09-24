/**
 * ONE-TIME endpoint — migrates existing files from Supabase Storage → AWS S3.
 * DELETE after use.
 * GET /api/admin/migrate-attachments?secret=ESpmi2026!
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadAttachment } from "@/lib/attachments";
import { query } from "@/lib/db";

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = "attachments";
const FOLDER = "Clients";
const SCHEMA = "check_monitoring";

async function sbList(prefix: string) {
  const res = await fetch(`${SB_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: SB_KEY!, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "ESpmi2026!") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!SB_URL || !SB_KEY) {
    return NextResponse.json({ ok: false, error: "Supabase env vars not configured." }, { status: 500 });
  }

  const results: string[] = [];

  try {
    // Client name lookup for folder naming
    const clientRows = await query<{ code: string; name: string }>(
      `SELECT code, name FROM ${SCHEMA}.clients`
    );
    const nameByCode = new Map(clientRows.map((c) => [c.code, c.name]));

    const clientFolders = await sbList(`${FOLDER}/`);
    for (const folder of clientFolders) {
      if (folder.id) continue; // skip files at top level
      const clientCode = folder.name;
      const files = await sbList(`${FOLDER}/${clientCode}/`);
      for (const f of files) {
        if (!f.id || f.name === ".emptyFolderPlaceholder") continue;
        const key = `${FOLDER}/${clientCode}/${f.name}`;
        // Download from Supabase
        const dl = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(key).replace(/%2F/g, "/")}`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        });
        if (!dl.ok) { results.push(`❌ ${clientCode}/${f.name}: download ${dl.status}`); continue; }
        const buf = Buffer.from(await dl.arrayBuffer());
        const contentType = dl.headers.get("content-type") ?? "application/octet-stream";
        // Strip any existing timestamp prefix, keep the original file name
        const cleanName = f.name.replace(/^\d+_/, "");
        await uploadAttachment(clientCode, cleanName, buf, contentType, nameByCode.get(clientCode));
        results.push(`✅ ${clientCode}/${cleanName} (${buf.length} bytes)`);
      }
    }

    return NextResponse.json({ ok: true, migrated: results.length, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message, partial: results }, { status: 500 });
  }
}

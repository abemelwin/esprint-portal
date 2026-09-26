/**
 * POST /api/admin/migrate-storage
 *
 * One-time storage migration. Two independent steps, controlled by ?step=:
 *
 *   ?step=checks   → Move existing S3 objects  Clients/*  →  Checks/Clients/*
 *                    (renames the checks-module folder; copy + delete)
 *
 *   ?step=sales    → Download all Sales product files from Supabase Storage
 *                    and upload to S3 under  Sales/ProductFiles/<machineId>/<file>,
 *                    then rewrite sales_portal.product_info_links URLs to point at S3.
 *
 * Protected by SYNC_SECRET header. Uses the Amplify compute role for S3 (no keys).
 * DELETE this file after use.
 *
 * Usage:
 *   curl -X POST "https://<portal>/api/admin/migrate-storage?step=checks&secret=sync-esprint-2026"
 *   curl -X POST "https://<portal>/api/admin/migrate-storage?step=sales&secret=sync-esprint-2026"
 */
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client, ListObjectsV2Command, CopyObjectCommand,
  DeleteObjectCommand, PutObjectCommand, HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { query } from "@/lib/db";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "sync-esprint-2026";
const REGION      = process.env.S3_REGION ?? "ap-southeast-1";
const BUCKET      = process.env.S3_BUCKET ?? "esprint-portal-attachments";
const SB_URL      = process.env.SALES_PORTAL_SUPABASE_URL ?? "https://zujxmjnuushqnplakryg.supabase.co";
const SB_KEY      = process.env.SALES_PORTAL_SERVICE_KEY;
const S           = "sales_portal";

let _s3: S3Client | null = null;
function s3get(): S3Client {
  if (!_s3) _s3 = new S3Client({ region: REGION });
  return _s3;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const secret = req.headers.get("x-sync-secret") ?? url.searchParams.get("secret");
  if (secret !== SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const step = url.searchParams.get("step");

  if (step === "checks")     return migrateChecksFolder();
  if (step === "sales")      return migrateSalesFiles();
  if (step === "public-sales") return makeSalesFilesPublic();
  return NextResponse.json({ error: "Pass ?step=checks, sales, or public-sales" }, { status: 400 });
}

// ── Step 3: make Sales/ProductFiles/* publicly readable (bucket policy) ───────
// Product catalogs/brochures/images are non-sensitive and must be directly
// viewable in the browser (matches orig Supabase public bucket behaviour).
// This grants public read ONLY to the Sales/ProductFiles/ prefix — the
// Checks/Clients/ folder stays private (served via presigned URLs).
async function makeSalesFilesPublic() {
  const { PutBucketPolicyCommand, GetBucketPolicyCommand } = await import("@aws-sdk/client-s3");

  // Read existing policy (if any) to merge
  let existing: any = { Version: "2012-10-17", Statement: [] };
  try {
    const cur = await s3get().send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
    if (cur.Policy) existing = JSON.parse(cur.Policy);
  } catch { /* no policy yet */ }

  // Remove any prior sales-public statement, then add fresh
  existing.Statement = (existing.Statement ?? []).filter(
    (s: any) => s.Sid !== "PublicReadSalesProductFiles"
  );
  existing.Statement.push({
    Sid: "PublicReadSalesProductFiles",
    Effect: "Allow",
    Principal: "*",
    Action: "s3:GetObject",
    Resource: `arn:aws:s3:::${BUCKET}/Sales/ProductFiles/*`,
  });

  try {
    await s3get().send(new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify(existing),
    }));
    return NextResponse.json({ ok: true, step: "public-sales", message: "Sales/ProductFiles/* is now publicly readable" });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
      hint: "The bucket may have 'Block Public Access' enabled. Disable 'Block public access via bucket policies' in S3 console first, then retry.",
    }, { status: 500 });
  }
}

// ── Step 1: rename Clients/ → Checks/Clients/ ─────────────────────────────────
async function migrateChecksFolder() {
  let copied = 0, skipped = 0;
  const errors: string[] = [];
  let token: string | undefined;
  do {
    const list = await s3get().send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: "Clients/", ContinuationToken: token,
    }));
    for (const obj of (list.Contents ?? [])) {
      const oldKey = obj.Key!;
      if (oldKey.endsWith("/")) { skipped++; continue; }
      const newKey = "Checks/" + oldKey; // Clients/... → Checks/Clients/...
      try {
        // Skip if already migrated
        try { await s3get().send(new HeadObjectCommand({ Bucket: BUCKET, Key: newKey })); skipped++; continue; } catch {}
        await s3get().send(new CopyObjectCommand({
          Bucket: BUCKET, CopySource: `${BUCKET}/${encodeURIComponent(oldKey).replace(/%2F/g, "/")}`, Key: newKey,
        }));
        await s3get().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
        copied++;
      } catch (err: any) {
        errors.push(`${oldKey}: ${err.message}`);
      }
    }
    token = list.NextContinuationToken;
  } while (token);

  return NextResponse.json({
    ok: true, step: "checks",
    message: `Moved ${copied} objects Clients/ → Checks/Clients/, skipped ${skipped}`,
    errors: errors.length ? errors : undefined,
  });
}

// ── Step 2: Supabase product files → S3 Sales/ProductFiles/ ───────────────────
async function migrateSalesFiles() {
  if (!SB_KEY) {
    return NextResponse.json({ error: "SALES_PORTAL_SERVICE_KEY not set" }, { status: 500 });
  }
  const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

  // Get all product_info_links that point at Supabase storage
  const links = await query<{ id: string; machine_id: string; url: string; document_type: string }>(
    `SELECT id, machine_id, url, document_type FROM ${S}.product_info_links
     WHERE url LIKE '%supabase.co/storage%'`
  );

  let migrated = 0, skipped = 0;
  const errors: string[] = [];

  for (const link of links) {
    try {
      // Extract the storage path after /public/product-files/
      const marker = "/storage/v1/object/public/product-files/";
      const idx = link.url.indexOf(marker);
      if (idx === -1) { skipped++; continue; }
      const encodedPath = link.url.slice(idx + marker.length);
      const fileName = decodeURIComponent(encodedPath.split("/").pop() ?? "file");
      const s3Key = `Sales/ProductFiles/${link.machine_id}/${fileName}`;

      // Skip if already in S3
      try {
        await s3get().send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
        // Already there — just update URL
        await query(`UPDATE ${S}.product_info_links SET url=$1 WHERE id=$2`,
          [`https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`, link.id]);
        skipped++;
        continue;
      } catch {}

      // Download from Supabase
      const fileRes = await fetch(link.url, { headers: H });
      if (!fileRes.ok) { errors.push(`fetch ${fileName}: ${fileRes.status}`); continue; }
      const buffer = Buffer.from(await fileRes.arrayBuffer());
      const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";

      // Upload to S3
      await s3get().send(new PutObjectCommand({
        Bucket: BUCKET, Key: s3Key, Body: buffer, ContentType: contentType,
      }));

      // Rewrite URL to S3
      await query(`UPDATE ${S}.product_info_links SET url=$1 WHERE id=$2`,
        [`https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`, link.id]);
      migrated++;
    } catch (err: any) {
      errors.push(`${link.id}: ${err.message}`);
    }
  }

  return NextResponse.json({
    ok: true, step: "sales",
    message: `Migrated ${migrated} files to S3, skipped ${skipped} (already there)`,
    totalSupabaseLinks: links.length,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  });
}

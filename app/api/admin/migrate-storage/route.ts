/**
 * POST /api/admin/migrate-storage
 *
 * Migration & storage management endpoint:
 *
 *   ?step=reorganize-sales  → Reorganize S3 folders from Sales/ProductFiles/<machineId>/
 *                             to Sales/ProductFiles/<Brand> - <Model>/ and update
 *                             all sales_portal.product_info_links URLs in RDS.
 *
 *   ?step=public-sales      → Grant public-read bucket policy to Sales/ProductFiles/*
 *
 * Protected by SYNC_SECRET header or ?secret= parameter.
 * Uses the AWS Amplify compute role for S3 operations.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { query } from "@/lib/db";
import { sanitizeMachineFolderName } from "@/lib/sales-storage";

const SYNC_SECRET = process.env.SYNC_SECRET ?? "sync-esprint-2026";
const REGION      = process.env.S3_REGION ?? "ap-southeast-1";
const BUCKET      = process.env.S3_BUCKET ?? "esprint-portal-attachments";
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
  const step = url.searchParams.get("step") || "reorganize-sales";

  if (step === "reorganize-sales" || step === "organize") {
    return reorganizeSalesFiles();
  }
  if (step === "public-sales") {
    return makeSalesFilesPublic();
  }
  return NextResponse.json({ error: "Invalid step. Supported: reorganize-sales, public-sales" }, { status: 400 });
}

// ── Make Sales/ProductFiles/* publicly readable (bucket policy) ───────────────
async function makeSalesFilesPublic() {
  let existing: any = { Version: "2012-10-17", Statement: [] };
  try {
    const cur = await s3get().send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
    if (cur.Policy) existing = JSON.parse(cur.Policy);
  } catch { /* no policy yet */ }

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
      hint: "Disable 'Block public access via bucket policies' in S3 console first, then retry.",
    }, { status: 500 });
  }
}

// ── Reorganize S3 folders from UUIDs to Machine Names & rewrite RDS URLs ───────
async function reorganizeSalesFiles() {
  const machines = await query<{ id: string; brand: string; model: string; sub_model: string | null }>(
    `SELECT id, brand, model, sub_model FROM ${S}.machines`
  );
  const machineMap = new Map<string, { folder: string; brand: string; model: string }>();
  for (const m of machines) {
    machineMap.set(m.id, {
      folder: sanitizeMachineFolderName(m.brand, m.model, m.sub_model),
      brand: m.brand,
      model: m.model,
    });
  }

  // Fetch all product_info_links
  const links = await query<{ id: string; machine_id: string; display_name: string; url: string }>(
    `SELECT id, machine_id, display_name, url FROM ${S}.product_info_links`
  );

  let objectsMoved = 0;
  let objectsSkipped = 0;
  let linksUpdated = 0;
  const errors: string[] = [];

  // List all objects under Sales/ProductFiles/
  let isTruncated = true;
  let nextToken: string | undefined = undefined;
  const allS3Objects: { key: string; size?: number }[] = [];

  while (isTruncated) {
    const listParams: { Bucket: string; Prefix: string; ContinuationToken?: string } = {
      Bucket: BUCKET,
      Prefix: "Sales/ProductFiles/",
    };
    if (nextToken) listParams.ContinuationToken = nextToken;

    const res = await s3get().send(new ListObjectsV2Command(listParams));
    if (res.Contents) {
      for (const obj of res.Contents) {
        if (obj.Key && !obj.Key.endsWith("/")) {
          allS3Objects.push({ key: obj.Key, size: obj.Size });
        }
      }
    }
    isTruncated = res.IsTruncated ?? false;
    nextToken = res.NextContinuationToken;
  }

  // Group objects and move UUID-based folders concurrently in batches
  const moveTasks: { oldKey: string; newKey: string; linkId?: string; targetFolder: string; fileName: string }[] = [];

  for (const obj of allS3Objects) {
    const oldKey = obj.key;
    const parts = oldKey.split("/");
    if (parts.length < 4) continue;

    const currentFolder = parts[2];
    const fileName = parts.slice(3).join("/");

    const machineInfo = machineMap.get(currentFolder);
    if (!machineInfo) {
      objectsSkipped++;
      continue;
    }

    const targetFolder = machineInfo.folder;
    if (currentFolder === targetFolder) {
      objectsSkipped++;
      continue;
    }

    const newKey = `Sales/ProductFiles/${targetFolder}/${fileName}`;
    moveTasks.push({ oldKey, newKey, targetFolder, fileName });
  }

  // Process in batches of 20 concurrent operations
  const BATCH_SIZE = 20;
  for (let i = 0; i < moveTasks.length; i += BATCH_SIZE) {
    const batch = moveTasks.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (task) => {
        try {
          const copySource = `${BUCKET}/${encodeURIComponent(task.oldKey).replace(/%2F/g, "/")}`;
          await s3get().send(new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: copySource,
            Key: task.newKey,
          }));
          await s3get().send(new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: task.oldKey,
          }));
          objectsMoved++;
        } catch (err: any) {
          errors.push(`Move error for ${task.oldKey}: ${err.message}`);
        }
      })
    );
  }

  // Rewrite all product_info_links URLs in database to match new machine folder format
  const dbBatch: { id: string; newUrl: string }[] = [];
  for (const link of links) {
    if (!link.url || !link.url.includes("Sales/ProductFiles/")) continue;

    const machineInfo = machineMap.get(link.machine_id);
    if (!machineInfo) continue;

    const targetFolder = machineInfo.folder;
    const oldUuidMarker = `Sales/ProductFiles/${link.machine_id}/`;

    if (link.url.includes(oldUuidMarker)) {
      const fileName = link.url.slice(link.url.indexOf(oldUuidMarker) + oldUuidMarker.length);
      const newUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/Sales/ProductFiles/${encodeURIComponent(targetFolder)}/${fileName}`;
      dbBatch.push({ id: link.id, newUrl });
    }
  }

  for (let i = 0; i < dbBatch.length; i += 50) {
    const chunk = dbBatch.slice(i, i + 50);
    await Promise.all(
      chunk.map(async (item) => {
        try {
          await query(
            `UPDATE ${S}.product_info_links SET url = $1 WHERE id = $2`,
            [item.newUrl, item.id]
          );
          linksUpdated++;
        } catch (err: any) {
          errors.push(`DB update error for link ${item.id}: ${err.message}`);
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    step: "reorganize-sales",
    totalMachines: machines.length,
    totalS3ObjectsFound: allS3Objects.length,
    pendingTasks: moveTasks.length,
    objectsMoved,
    objectsSkipped,
    linksUpdated,
    errors: errors.length ? errors.slice(0, 20) : undefined,
  });
}

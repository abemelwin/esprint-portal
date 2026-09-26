import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "@/lib/session";
import { canAccessModule, getSalesPermissions } from "@/lib/rbac";
import { query } from "@/lib/db";
import { sanitizeMachineFolderName } from "@/lib/sales-storage";

const REGION = process.env.S3_REGION ?? "ap-southeast-1";
const BUCKET = process.env.S3_BUCKET ?? "esprint-portal-attachments";
const S      = "sales_portal";

let _s3: S3Client | null = null;
function s3get(): S3Client {
  if (!_s3) _s3 = new S3Client({ region: REGION });
  return _s3;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { machineId: string } }
) {
  const user = await getCurrentUser();
  if (!user || !canAccessModule(user, "sales")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const perms = getSalesPermissions(user);
  if (!perms.canManageProductFiles) {
    return NextResponse.json({ error: "Forbidden: product file permission required" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = (formData.get("document_type") as string) || "other";
    const displayName = (formData.get("display_name") as string) || file?.name || "Uploaded File";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Lookup machine details for folder naming
    const machines = await query<{ brand: string; model: string; sub_model: string | null }>(
      `SELECT brand, model, sub_model FROM ${S}.machines WHERE id = $1`,
      [params.machineId]
    );
    if (machines.length === 0) {
      return NextResponse.json({ error: "Machine not found" }, { status: 404 });
    }

    const machine = machines[0];
    const machineFolder = sanitizeMachineFolderName(machine.brand, machine.model, machine.sub_model);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `Sales/ProductFiles/${machineFolder}/${Date.now()}_${safeFileName}`;

    // Upload to S3
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await s3get().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || "application/octet-stream",
      })
    );

    const publicUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`;

    // Insert into database
    const linkRows = await query(
      `INSERT INTO ${S}.product_info_links (id, machine_id, display_name, url, document_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [randomUUID(), params.machineId, displayName.trim(), publicUrl, documentType]
    );

    return NextResponse.json({ ok: true, link: linkRows[0] }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/sales/product-info/[machineId]/upload error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}

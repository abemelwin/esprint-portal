/**
 * Client attachments — AWS S3 storage helper (server-side only).
 *
 * Mirrors the original Supabase Storage behaviour: files are stored under
 * Clients/<clientCode>/<timestamp>_<filename> and listed / downloaded via
 * presigned URLs.
 *
 * Credentials resolution: uses the default provider chain (Amplify compute
 * role in production). The bucket + region come from env.
 */
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env.S3_REGION ?? process.env.COGNITO_REGION ?? "ap-southeast-1";
const BUCKET = process.env.S3_BUCKET ?? "esprint-portal-attachments";
const FOLDER = "Clients";

let client: S3Client | null = null;
function getS3(): S3Client {
  if (client) return client;
  client = new S3Client({ region: REGION });
  return client;
}

/**
 * Build the S3 folder name for a client. Uses "CODE - NAME" so folders are
 * human-readable in the S3 console while staying stable (the code never
 * changes). Slashes and other unsafe characters are replaced so they don't
 * create nested folders.
 */
function clientFolder(clientCode: string, clientName?: string): string {
  const safeName = (clientName ?? "").trim().replace(/[/\\]/g, "-").replace(/\s+/g, " ");
  return safeName ? `${clientCode} - ${safeName}` : clientCode;
}

export interface AttachmentFile {
  name:      string;
  size:      number;
  createdAt: string | null;
  url:       string | null;
  path:      string;
}

/**
 * List all files for a client. Matches any folder that starts with the client
 * code (so files are found even if the client was renamed). Each file gets a
 * presigned download URL (1h).
 */
export async function listAttachments(clientCode: string): Promise<AttachmentFile[]> {
  // Match "Clients/<code>" and "Clients/<code> - <name>/"
  const prefix = `${FOLDER}/${clientCode}`;
  const res = await getS3().send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  const objects = res.Contents ?? [];
  const files = await Promise.all(
    objects
      .filter((o) => o.Key && !o.Key.endsWith("/"))
      .map(async (o) => {
        const key = o.Key!;
        // Display name = last path segment
        const name = key.split("/").pop() ?? key;
        const url = await getSignedUrl(
          getS3(),
          new GetObjectCommand({ Bucket: BUCKET, Key: key }),
          { expiresIn: 3600 }
        );
        return {
          name,
          size: o.Size ?? 0,
          createdAt: o.LastModified ? o.LastModified.toISOString() : null,
          url,
          path: key,
        };
      })
  );
  return files.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Upload a file for a client. Stores under "Clients/<code> - <name>/". */
export async function uploadAttachment(
  clientCode: string,
  fileName: string,
  body: Buffer,
  contentType: string,
  clientName?: string
): Promise<string> {
  const folder = clientFolder(clientCode, clientName);
  const safeName = fileName.replace(/[^\w.\- ]/g, "_");
  const key = `${FOLDER}/${folder}/${Date.now()}_${safeName}`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Delete a file for a client. The client `path` (full S3 key) is passed from
 * the list result so we delete the exact object regardless of folder naming.
 */
export async function deleteAttachment(pathOrKey: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: pathOrKey }));
}

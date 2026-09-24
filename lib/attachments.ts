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

export interface AttachmentFile {
  name:      string;
  size:      number;
  createdAt: string | null;
  url:       string | null;
  path:      string;
}

/** List all files for a client, with presigned download URLs (1h). */
export async function listAttachments(clientCode: string): Promise<AttachmentFile[]> {
  const prefix = `${FOLDER}/${clientCode}/`;
  const res = await getS3().send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  const objects = res.Contents ?? [];
  const files = await Promise.all(
    objects
      .filter((o) => o.Key && o.Key !== prefix)
      .map(async (o) => {
        const key = o.Key!;
        const name = key.slice(prefix.length);
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
  // Newest first
  return files.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Upload a file for a client. Returns the stored key. */
export async function uploadAttachment(
  clientCode: string,
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  // Prefix with timestamp to avoid collisions (matches original)
  const safeName = fileName.replace(/[^\w.\- ]/g, "_");
  const key = `${FOLDER}/${clientCode}/${Date.now()}_${safeName}`;
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

/** Delete a file for a client by its stored name. */
export async function deleteAttachment(clientCode: string, fileName: string): Promise<void> {
  const key = `${FOLDER}/${clientCode}/${fileName}`;
  await getS3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * S3 Storage helper for Sales Portal product files and attachments.
 */

export function sanitizeMachineFolderName(brand: string, model: string, subModel?: string | null): string {
  const b = (brand || "").trim();
  const m = (model || "").trim();
  const s = (subModel || "").trim();
  let name = b && m ? `${b} - ${m}` : (b || m || "Unknown");
  if (s) name += ` (${s})`;
  // Sanitize characters invalid in file/S3 paths
  return name.replace(/[\/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
}

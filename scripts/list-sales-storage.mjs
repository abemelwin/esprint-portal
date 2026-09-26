/**
 * list-sales-storage.mjs (READ-ONLY)
 * Lists all files in the Sales Portal Supabase Storage buckets so we know
 * exactly what needs migrating to S3.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spEnv = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../../Sales Portal/.env'), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB  = spEnv.VITE_SUPABASE_URL;
const KEY = spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H   = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// List storage buckets
const bRes = await fetch(`${SB}/storage/v1/bucket`, { headers: H });
const buckets = await bRes.json();
console.log('Storage buckets:', Array.isArray(buckets) ? buckets.map(b => b.name).join(', ') : JSON.stringify(buckets));

// For each bucket, list files (recursive top-level)
for (const b of (Array.isArray(buckets) ? buckets : [])) {
  const listRes = await fetch(`${SB}/storage/v1/object/list/${b.name}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 1000, prefix: '', sortBy: { column: 'name', order: 'asc' } }),
  });
  const files = await listRes.json();
  console.log(`\nBucket "${b.name}": ${Array.isArray(files) ? files.length : 0} objects`);
  if (Array.isArray(files)) {
    files.slice(0, 40).forEach(f => console.log(`  ${f.name} (${f.metadata?.size ?? '?'} bytes)`));
  }
}

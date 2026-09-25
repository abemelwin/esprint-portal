/**
 * apply-sales-schema.mjs
 * Applies a SQL file to the portal's RDS database.
 * Usage: node scripts/apply-sales-schema.mjs db/schema/03b_sales_portal_align.sql
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sqlFile = process.argv[2];
if (!sqlFile) { console.error('Usage: node scripts/apply-sales-schema.mjs <path-to-sql>'); process.exit(1); }
const sql = fs.readFileSync(path.resolve(__dirname, '..', sqlFile), 'utf8');

const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query(sql);
  console.log('✅ Applied:', sqlFile);
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exitCode = 1;
} finally {
  await c.end();
}

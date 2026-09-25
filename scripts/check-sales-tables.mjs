import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const schemas = await c.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('sales_portal','check_monitoring','public')`);
console.log('Schemas:', schemas.rows.map(r => r.schema_name).join(', '));
const t = await c.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('sales_portal','public') AND table_name IN ('machines','quotes','portal_users','quote_items') ORDER BY 1,2`);
console.log('Relevant tables:');
t.rows.forEach(r => console.log('  ', r.table_schema + '.' + r.table_name));
// Does public.portal_users exist? (quotes FK references it)
const pu = await c.query(`SELECT to_regclass('public.portal_users') AS x`);
console.log('public.portal_users:', pu.rows[0].x ?? 'MISSING');
await c.end();

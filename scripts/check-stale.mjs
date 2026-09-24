import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const c = new pg.Client({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
await c.connect();
const STALE_DAYS = 180;
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - STALE_DAYS);
const cutoffStr = cutoff.toISOString().slice(0,10);

const r = await c.query(
  `SELECT final_status, count(*) 
   FROM check_monitoring.checks 
   WHERE check_date < $1 
   AND final_status IS NOT NULL 
   AND final_status NOT IN ('CLEARED','REPLACED','SETTLED (PAID)','CANCELLED') 
   GROUP BY final_status ORDER BY count DESC`,
  [cutoffStr]
);
console.log('Stale checks (>180d) with non-terminal finalStatus (counted as stale in portal, not in orig):');
r.rows.forEach(x=>console.log(' ', (x.final_status||'NULL').padEnd(25), x.count));

// Total stale in portal computation
const r2 = await c.query(
  `SELECT count(*) FROM check_monitoring.checks 
   WHERE check_date < $1 
   AND final_status NOT IN ('CLEARED','REPLACED','SETTLED (PAID)','CANCELLED','DEPOSITED')`,
  [cutoffStr]
);
console.log('\nPortal stale count (from summary.ts logic):', r2.rows[0].count);

// Total stale using orig logic (only 4 exclusions)
const r3 = await c.query(
  `SELECT count(*) FROM check_monitoring.checks 
   WHERE check_date < $1 
   AND (final_status IS NULL OR final_status NOT IN ('CLEARED','REPLACED','SETTLED (PAID)','CANCELLED'))`,
  [cutoffStr]
);
console.log('Orig stale count (only 4 exclusions):', r3.rows[0].count);
await c.end();

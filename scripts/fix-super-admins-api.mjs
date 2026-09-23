/**
 * fix-super-admins-api.mjs
 *
 * Calls the live portal API to fix super admin accounts.
 * Must be run while logged in as Eileen (super_admin) — provide her session
 * cookie or auth token.
 *
 * Usage:
 *   node scripts/fix-super-admins-api.mjs --cookie "next-auth.session-token=xxx"
 *   or set PORTAL_COOKIE env var
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const BASE = env.NEXT_PUBLIC_APP_URL ?? 'https://main.d1gf6z1cm3ouns.amplifyapp.com';
const cookieArg = process.argv.find(a => a.startsWith('--cookie='))?.slice(9) ?? process.env.PORTAL_COOKIE ?? '';

if (!cookieArg) {
  console.error('Provide session cookie: node fix-super-admins-api.mjs --cookie="portal_session=xxx"');
  process.exit(1);
}

async function patch(username, body) {
  const res = await fetch(`${BASE}/api/admin/users`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookieArg },
    body: JSON.stringify({ username, ...body }),
  });
  const json = await res.json();
  if (json.ok) console.log(`✅  ${username} updated`);
  else console.error(`❌  ${username}: ${json.error}`);
}

async function del(username) {
  const res = await fetch(`${BASE}/api/admin/users`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Cookie: cookieArg },
    body: JSON.stringify({ username }),
  });
  const json = await res.json();
  if (json.ok) console.log(`🗑  Deleted ${username}`);
  else console.error(`❌  Delete ${username}: ${json.error}`);
}

console.log(`\nConnecting to ${BASE}...\n`);

// Downgrade Beverly Cruz → user / Admin
await patch('beverly@esprintmedia.com', {
  portalRole: 'user',
  access: [{ module: 'checks', role: 'Admin', isModuleAdmin: true, branches: [], aes: [] }],
});

// Downgrade Cherry Pie Teng → user / Admin
await patch('chepieteng@esprintmedia.com', {
  portalRole: 'user',
  access: [{ module: 'checks', role: 'Admin', isModuleAdmin: true, branches: [], aes: [] }],
});

// Upgrade melwin@esprintmedia.com → super_admin
await patch('melwin@esprintmedia.com', {
  portalRole: 'super_admin',
  access: [],
});

// Delete test account
await del('dev-super@test.local');

console.log('\nDone.');

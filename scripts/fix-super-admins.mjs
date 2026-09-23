/**
 * fix-super-admins.mjs
 *
 * 1. Downgrade Beverly Cruz + Cherry Pie Teng: super_admin → user (Admin role)
 * 2. Upgrade melwin@esprintmedia.com → super_admin
 * 3. Delete dev-super@test.local (test account)
 *
 * Requires AWS credentials — run with:
 *   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy node scripts/fix-super-admins.mjs
 * Or set COGNITO_ACCESS_KEY / COGNITO_SECRET in .env.local
 */
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const POOL_ID = env.COGNITO_USER_POOL_ID;
const REGION  = env.COGNITO_REGION;

const key    = process.env.AWS_ACCESS_KEY_ID    || env.COGNITO_ACCESS_KEY;
const secret = process.env.AWS_SECRET_ACCESS_KEY || env.COGNITO_SECRET;

if (!key || !secret) {
  console.error('No AWS credentials found. Run with:');
  console.error('  AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=yyy node scripts/fix-super-admins.mjs');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({
  region: REGION,
  credentials: { accessKeyId: key, secretAccessKey: secret },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setPortalRole(username, role, checkRole = null) {
  const access = checkRole ? JSON.stringify([{
    module: 'checks',
    role: checkRole,
    isModuleAdmin: ['Admin','AR Manager','AR Supervisor','Treasury Manager','Acctg Head','Operations'].includes(checkRole),
    branches: [],
    aes: [],
  }]) : '[]';

  await client.send(new AdminUpdateUserAttributesCommand({
    UserPoolId: POOL_ID,
    Username: username,
    UserAttributes: [
      { Name: 'custom:portal_role', Value: role },
      { Name: 'custom:access',      Value: access },
    ],
  }));
  console.log(`✅  ${username} → portal_role=${role}${checkRole ? `, checkRole=${checkRole}` : ''}`);
}

async function deleteUser(username) {
  await client.send(new AdminDeleteUserCommand({ UserPoolId: POOL_ID, Username: username }));
  console.log(`🗑   Deleted ${username}`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('\nFixing super admin accounts…\n');

// Downgrade Beverly Cruz → user / Admin
await setPortalRole('beverly@esprintmedia.com', 'user', 'Admin');

// Downgrade Cherry Pie Teng → user / Admin
await setPortalRole('chepieteng@esprintmedia.com', 'user', 'Admin');

// Upgrade melwin@esprintmedia.com → super_admin
await setPortalRole('melwin@esprintmedia.com', 'super_admin');

// Delete test account
await deleteUser('dev-super@test.local');

console.log('\nDone. Verify in the portal Admin & Users page.');

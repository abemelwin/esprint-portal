import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const client = new CognitoIdentityProviderClient({ region: env.COGNITO_REGION });

let token;
const supers = [];
do {
  const res = await client.send(new ListUsersCommand({
    UserPoolId: env.COGNITO_USER_POOL_ID,
    Limit: 60,
    PaginationToken: token,
  }));
  for (const u of res.Users ?? []) {
    const role = (u.Attributes ?? []).find(a => a.Name === 'custom:portal_role')?.Value;
    if (role === 'super_admin') {
      const email = (u.Attributes ?? []).find(a => a.Name === 'email')?.Value ?? '';
      const name  = (u.Attributes ?? []).find(a => a.Name === 'name')?.Value ?? '';
      supers.push({ email, name, status: u.UserStatus });
    }
  }
  token = res.PaginationToken;
} while (token);

console.log(`\nSuper Admin accounts (${supers.length}):`);
supers.forEach(u => console.log(` - ${u.name} <${u.email}> [${u.status}]`));

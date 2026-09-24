/**
 * Lists all Supabase users with their role, branches, and AEs
 * to understand branch assignment patterns.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../esprint-check-monitoring/.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const H = {apikey:cmEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization:'Bearer '+cmEnv.SUPABASE_SERVICE_ROLE_KEY};

const map = new Map();
let page = 1;
for(;;){
  const r = await fetch(`${cmEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1000&page=${page}`,{headers:H});
  const d = await r.json();
  const users = d.users ?? [];
  for(const u of users){
    const m = u.user_metadata ?? {};
    map.set(u.email, { role: m.role, branches: m.branches, aes: m.aes, subsidiary: m.subsidiary });
  }
  if(users.length < 1000) break;
  page++;
}

// Count patterns
let noBranch = 0, allBranch = 0, specificBranch = 0;
const aeAccessUsers = [];
for(const [email, m] of map){
  const branches = m.branches ?? [];
  if(m.role === 'AE Access' || m.role === 'AE'){
    aeAccessUsers.push({ email, role: m.role, branches, aes: (m.aes??[]).length });
  }
  if(branches.length === 0) noBranch++;
  else if(branches.includes('ALL')) allBranch++;
  else specificBranch++;
}
console.log(`Total users: ${map.size}`);
console.log(`  No branch (empty []): ${noBranch}`);
console.log(`  ALL branches: ${allBranch}`);
console.log(`  Specific branches: ${specificBranch}`);
console.log(`\nAE / AE Access users (${aeAccessUsers.length}):`);
aeAccessUsers.slice(0,25).forEach(u=>console.log(`  ${u.email.padEnd(38)} ${u.role.padEnd(12)} branches:[${u.branches.join(',')}] aes:${u.aes}`));

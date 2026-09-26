import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spEnv = Object.fromEntries(fs.readFileSync(path.resolve(__dirname,'../../Sales Portal/.env'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const SB=spEnv.VITE_SUPABASE_URL, KEY=spEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:KEY,Authorization:`Bearer ${KEY}`};

// Recursively count files in the product-files bucket
async function listFolder(prefix) {
  const r = await fetch(`${SB}/storage/v1/object/list/product-files`, {
    method:'POST', headers:{...H,'Content-Type':'application/json'},
    body: JSON.stringify({ limit:1000, prefix, sortBy:{column:'name',order:'asc'} })
  });
  return await r.json();
}

const topFolders = await listFolder('');
let totalFiles = 0, totalBytes = 0, folderCount = 0;
for (const folder of topFolders) {
  // Each top-level entry is a folder (machine). List its contents.
  const files = await listFolder(folder.name + '/');
  if (Array.isArray(files)) {
    const actualFiles = files.filter(f => f.id); // id present = real file, null = subfolder
    totalFiles += actualFiles.length;
    for (const f of actualFiles) totalBytes += (f.metadata?.size || 0);
    folderCount++;
  }
}
console.log(`Folders (machines): ${folderCount}`);
console.log(`Total files: ${totalFiles}`);
console.log(`Total size: ${(totalBytes/1024/1024).toFixed(1)} MB`);

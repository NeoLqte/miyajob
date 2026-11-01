import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else{const rel=path.relative(root,p);if(/(^|[\\/])(profile|internal|samples|SPEC)|\.env|\.html\.raw/i.test(rel))throw Error(`Private file in build: ${rel}`);const text=await readFile(p,'utf8');if(/TEST ONLY|it_professional_years|full_time_history|BEGIN PRIVATE KEY|sk-[A-Za-z0-9]{24}/.test(text))throw Error(`Private content in build: ${rel}`);}}}
await walk(root);
console.log('Public build audit passed: no profile, internal records, fixtures or secrets.');

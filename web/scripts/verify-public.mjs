import {readFile} from 'node:fs/promises';
import {parseData} from '../src/data.ts';
const raw=JSON.parse(await readFile('public/jobs.json','utf8'));
const parsed=parseData(raw);
if(parsed.jobs.length!==raw.jobs.length)throw Error('Publication audit failed: ineligible, unverified, stale or unsafe job in public data.');
console.log(`Publication audit passed: ${parsed.jobs.length} real verified records (no fixtures).`);

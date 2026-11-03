import {readFile} from 'node:fs/promises';
import {parseData,parseReviews} from '../src/data.ts';
import {guidance,skillLabels,audienceLabels} from '../src/guidance.ts';
const raw=JSON.parse(await readFile('public/jobs.json','utf8'));
const parsed=parseData(raw);
if(parsed.jobs.length!==raw.jobs.length)throw Error('Publication audit failed: ineligible, unverified, expired or unsafe job in public data.');
console.log(`Publication audit passed: ${parsed.jobs.length} real verified records (no fixtures).`);
const reviews=JSON.parse(await readFile('public/review-jobs.json','utf8'));
const pending=parseReviews(reviews);
if(pending.candidates.length!==reviews.candidates.length||pending.candidates.some(j=>parsed.jobs.some(v=>v.id===j.id)))throw Error('Review candidates must be current and separate from verified jobs.');
console.log(`Review export audit passed: ${pending.candidates.length} IT candidates, explicitly unverified.`);
const records=new Map([...parsed.jobs,...pending.candidates].map(j=>[j.id,j]));
for(const [id,entry] of Object.entries(guidance)){
 const job=records.get(id);if(!job)throw Error('Guidance refers to an unavailable job: '+id);
 const urls=new Set('sources' in job?job.sources.map(s=>s.url):[job.url,...(job.facts??[]).map(f=>f.url),...(job.screening??[]).map(c=>c.url)]);
 for(const [field,fact] of Object.entries(entry)){
  if(!(field==='skill'?fact.value in skillLabels:field==='audience'&&fact.value in audienceLabels)||!fact.detail||!urls.has(fact.url)||!/^\d{4}-\d{2}-\d{2}$/.test(fact.checked_at)||fact.checked_at>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'})||fact.checked_at>('last_checked_at' in job?job.last_checked_at:job.checked_at))throw Error('Invalid entry guidance provenance: '+id);
 }
}
console.log(`Entry guidance audit passed: ${Object.keys(guidance).length} source-backed records; others unknown.`);

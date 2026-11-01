import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './public-data.schema.json' with {type:'json'};
import type {Job, PublicData, ReviewData, ReviewCandidate, ReviewFact} from './types';
import {dimensions,supportedRequirements,dayNow,itCategories} from './constants.ts';
import reviewSchema from './review-data.schema.json' with {type:'json'};
export {dimensions,dayNow} from './constants.ts';
const ajv = new Ajv({allErrors:true, strict:false});
addFormats(ajv);
const validate = ajv.compile<PublicData>(schema);
const validateReviews = ajv.compile<ReviewData>(reviewSchema);
const requiredEvidence = ['existence','employment','requirements_complete','location','commute','recruitment','reuse'];
const dayDiff = (a:string,b:string) => (Date.parse(a)-Date.parse(b))/86400000;
export function needsRecheck(j:Job,today=dayNow()):boolean {
 return [j.last_checked_at,...j.sources.map(s=>s.checked_at),...j.evidence.map(e=>e.checked_at),j.commute.checked_at].some(d=>!!d&&dayDiff(today,d)>30);
}
export function reviewNeedsRecheck(j:Pick<ReviewCandidate,'checked_at'|'facts'>,today=dayNow()):boolean {
 return [j.checked_at,...(j.facts??[]).map(f=>f.checked_at)].some(d=>dayDiff(today,d)>30);
}
function safeURL(url:string) {try {const u=new URL(url);return u.protocol==='https:' && !u.username && !u.password && !/(^localhost$|^127\.|^\[::1\]$|\.(invalid|test|localhost)$)/.test(u.hostname);} catch{return false;}}
export const requiredConditions=['salary','location','employment','holidays','hours'] as const;
export function completeConditions(facts:ReviewFact[]=[]):boolean {return requiredConditions.every(field=>facts.some(f=>f.field===field&&f.confirmed===true));}
export function publishable(j:Job,today=dayNow()):boolean {
 const fresh=(d:string|null)=>!!d && dayDiff(today,d)>=0;
 const validEvidence=(id:string,field:string)=>j.evidence.some(e=>e.id===id&&e.field===field&&e.conclusion==='pass'&&fresh(e.checked_at)&&(!e.valid_through||e.valid_through>=today)&&e.checked_at<=j.last_checked_at&&j.sources.some(s=>s.url===e.url&&e.checked_at<=s.checked_at));
 const fields=[...requiredEvidence,...j.eligibility.requirements.map(r=>r.field)];
 const c=j.commute;
 return completeConditions(j.listing_facts)&&new Set(j.listing_facts?.map(f=>f.field)).size===j.listing_facts?.length&&j.listing_facts!.every(f=>safeURL(f.url)&&fresh(f.checked_at)&&f.checked_at<=j.last_checked_at&&j.sources.some(s=>s.url===f.url&&f.checked_at<=s.checked_at))&&itCategories.includes(j.category)&&j.eligibility.status==='eligible'&&j.eligibility.graduate_eligibility==='pass'&&j.eligibility.professional_experience==='pass'
 && j.employment_type==='full_time_regular' && j.recruitment.status==='active' && (!j.recruitment.valid_through||j.recruitment.valid_through>=today)
 && (!j.recruitment.date_posted||j.recruitment.date_posted<=today) && fresh(j.last_checked_at)&&j.first_seen_at<=j.last_checked_at
 && j.sources.length>0&&j.sources.every(s=>safeURL(s.url)&&safeURL(s.original_url)&&fresh(s.checked_at)&&s.checked_at<=j.last_checked_at)
 && j.evidence.every(e=>safeURL(e.url))&&new Set(j.evidence.map(e=>e.id)).size===j.evidence.length
 && fields.every(f=>j.evidence.some(e=>validEvidence(e.id,f))&&!j.evidence.some(e=>e.field===f&&(e.conclusion!=='pass'||!!e.valid_through&&e.valid_through<today)))
 && dimensions.every(f=>j.eligibility.requirements.some(r=>r.field===f))
 && j.eligibility.requirements.every(r=>supportedRequirements.includes(r.field)&&r.evidence_ids.length>0&&r.evidence_ids.every(id=>validEvidence(id,r.field)))
 && !!j.location.address&&j.location.is_fixed&&!!c.provider&&fresh(c.checked_at)&&c.checked_at!<=j.last_checked_at&&!!c.route_assumptions
 && ((c.status==='verified'&&c.minutes!==null&&c.minutes<=45)||(c.status==='local_verified'&&c.minutes===null)||(c.status==='remote_verified'&&j.location.remote_policy==='full'&&j.location.residence_verified));
}
export function parseData(input:unknown):PublicData {
 if(!validate(input)) throw new Error('公開データの形式を検証できませんでした。');
 if(input.updated_at&&input.updated_at>dayNow()) throw new Error('公開データの検証日時が不正です。');
 if(input.jobs.length && (!input.updated_at||input.collection_status!=='verified_export')) throw new Error('公開データの検証日時が不正です。');
 if(new Set(input.jobs.map(j=>j.id)).size!==input.jobs.length) throw new Error('重複する求人が含まれています。');
 // Age alone warns; explicit closure, deadline and evidence expiry still hide.
 return {...input,jobs:input.jobs.filter(j=>publishable(j))};
}
export function parseReviews(input:unknown,today=dayNow()):ReviewData {
 if(!validateReviews(input))throw Error('確認待ちデータの形式を検証できませんでした。');
 if(input.updated_at>today||new Set(input.candidates.map(j=>j.id)).size!==input.candidates.length)throw Error('確認待ちデータの確認日時・IDが不正です。');
 if(input.candidates.some(j=>!safeURL(j.url)||j.checked_at>today||j.checked_at>input.updated_at))throw Error('確認待ちデータの原典・確認日が不正です。');
 if(input.candidates.some(j=>new Set(j.facts?.map(f=>f.field)).size!==(j.facts?.length??0)||j.facts?.some(f=>!safeURL(f.url)||f.checked_at>j.checked_at)))throw Error('候補の条件・根拠の確認日が不正です。');
 return {...input,candidates:input.candidates.filter(j=>(j.status==='review'?completeConditions(j.facts):j.stage==='discovery'&&j.discovery_verified===true&&!!j.regions?.length&&!/非公開|未確認/.test(j.company))&&(!j.valid_through||j.valid_through>=today))};
}

import type {Job,ReviewCandidate} from './types';
export type BrowseCandidate=Omit<ReviewCandidate,'status'> & {status:'eligible'|'review'|'discovery';verifiedMetrics?:{monthly:number|null;holidays:number|null;commute:number|null}};
export type BrowseFilters={query:string;category:string;region:string;status:string;stage:string;reason:string;sort:string};
export function candidateRegions(j:Pick<ReviewCandidate,'regions'|'address'>):string[]{
 if(j.regions?.length)return j.regions;
 const a=j.address,regions:string[]=[];
 for(const [pattern,label] of [[/浜名区|浜北|都田|細江|宮口|染地台/,'浜松市浜名区'],[/中央区|中区|東区|西区|南区|三方原/,'浜松市中央区'],[/天竜区/,'浜松市天竜区'],[/磐田/,'磐田市']] as const)if(pattern.test(a))regions.push(label);
 return regions.length?regions:['浜松市（区未確認）'];
}
export function candidateMetrics(j:BrowseCandidate){
 if(j.verifiedMetrics)return j.verifiedMetrics;
 const fact=(field:string)=>j.facts?.find(f=>f.field===field&&f.confirmed)?.text.normalize('NFKC')??'';
 const salary=fact('salary'),holidays=fact('holidays'),commute=fact('commute');
 // Only explicit monthly pay; annual totals and model examples are never converted for sorting.
 const amount=salary.match(/月(?:給|額)\s*([\d,]+(?:\.\d+)?)\s*(?:[〜～~－-]\s*[\d,]+(?:\.\d+)?\s*)?(万)?円/);
 const monthly=amount&&!/不整合|整合未確認|金額未確認|単位未確認/.test(salary)?Number(amount[1].replaceAll(',',''))*(amount[2]?10000:1):null;
 const holiday=holidays.match(/年間(?:休日)?\s*(\d{2,3})\s*日/);
 const minutes=commute.match(/確認済み通勤(?:（予測上限）)?[：:]\s*(\d+(?:\.\d+)?)分/);
 return {monthly,holidays:holiday&&!/差|未確認|確認待ち/.test(holidays)?Number(holiday[1]):null,commute:minutes?Number(minutes[1]):null};
}
export function verifiedCandidate(j:Job):BrowseCandidate {
 return {id:j.id,company:j.company,title:j.title,category:j.category as ReviewCandidate['category'],address:j.location.address,regions:[j.location.region],url:j.sources[0].url,checked_at:j.last_checked_at,stage:'detail_review',reasons:['応募条件・募集・通勤の根拠を確認済み'],summary:j.description,status:'eligible',valid_through:j.recruitment.valid_through,facts:j.listing_facts,verifiedMetrics:{monthly:j.pay.monthly_total_min_jpy??j.pay.monthly_base_min_jpy,holidays:j.workstyle.annual_holidays,commute:j.commute.status==='verified'?j.commute.minutes:null}};
}
export function selectCandidates(jobs:BrowseCandidate[],f:BrowseFilters):BrowseCandidate[]{
 const terms=f.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return jobs.filter(j=>(!f.category||j.category===f.category)&&(!f.region||candidateRegions(j).includes(f.region))&&(!f.status||j.status===f.status)&&(!f.stage||j.stage===f.stage)&&(!f.reason||j.reasons.includes(f.reason))&&terms.every(t=>`${j.company} ${j.title} ${j.address} ${j.summary} ${j.reasons.join(' ')} ${j.facts?.filter(x=>x.confirmed).map(x=>x.text).join(' ')??''}`.toLocaleLowerCase().includes(t))).sort((a,b)=>{
  if(['monthly','holidays','commute'].includes(f.sort)){
   const key=f.sort as 'monthly'|'holidays'|'commute',x=candidateMetrics(a)[key],y=candidateMetrics(b)[key];
   if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;
   if(x!==null&&y!==null&&x!==y)return f.sort==='commute'?x-y:y-x;
  }
  if(f.sort==='updated'&&a.checked_at!==b.checked_at)return b.checked_at.localeCompare(a.checked_at);
  return a.company.localeCompare(b.company,'ja')||a.id.localeCompare(b.id);
 });
}

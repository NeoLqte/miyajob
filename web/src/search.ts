import type {Category, Job} from './types';
export const categories:Record<Category,string> = {software:'開発',infrastructure:'インフラ',internal_it:'社内SE',it_support:'ITサポート',technical:'技術職',office:'事務',other:'その他'};
export type Filters = {q:string;category:string;region:string;commute:string;monthly:string;annual:string;payBasis:'base'|'total';annualBasis:'guaranteed'|'estimated';holidays:boolean;overtime:boolean;remote:boolean;flex:boolean;transfer:boolean;car:boolean;parking:boolean;client:boolean;includeUnknown:boolean;sort:string;view:'cards'|'table'};
export const defaults:Filters={q:'',category:'',region:'',commute:'',monthly:'',annual:'',payBasis:'base',annualBasis:'guaranteed',holidays:false,overtime:false,remote:false,flex:false,transfer:false,car:false,parking:false,client:false,includeUnknown:false,sort:'recommended',view:'cards'};
const flags=['holidays','overtime','remote','flex','transfer','car','parking','client','includeUnknown'] as const;
export function readFilters(search:string):Filters {
 const p=new URLSearchParams(search),f={...defaults};
 for(const k of ['q','category','region','commute','monthly','annual','sort'] as const) f[k]=p.get(k)||defaults[k];
 for(const k of flags) f[k]=p.get(k)==='1';
 f.payBasis=p.get('payBasis')==='total'?'total':'base';f.annualBasis=p.get('annualBasis')==='estimated'?'estimated':'guaranteed';f.view=p.get('view')==='table'?'table':'cards';
 if(!(f.category in categories))f.category='';
 for(const k of ['monthly','annual'] as const)if(!/^\d{1,9}$/.test(f[k]))f[k]='';
 if(!['','15','30','45'].includes(f.commute))f.commute='';
 if(!['recommended','commute','monthly','annual','holidays','overtime','new','updated'].includes(f.sort))f.sort='recommended';
 return f;
}
export function writeFilters(f:Filters) {const p=new URLSearchParams();for(const k of Object.keys(defaults) as (keyof Filters)[])if(f[k]!==defaults[k])p.set(k,typeof f[k]==='boolean'?'1':String(f[k]));return p.toString();}
export const monthlyValue=(j:Job,f:Filters)=>f.payBasis==='base'?j.pay.monthly_base_min_jpy:j.pay.monthly_total_min_jpy;
export const annualValue=(j:Job,f:Filters)=>j.pay.annual_basis===f.annualBasis?j.pay.annual_min_jpy:null;
export function recommendation(j:Job) {
 const commute=j.commute.minutes===null?null:Math.max(0,1-j.commute.minutes/45);
 const salary=j.pay.monthly_base_min_jpy===null?null:Math.min(1,j.pay.monthly_base_min_jpy/350000);
 const holiday=j.workstyle.annual_holidays===null?null:Math.min(1,j.workstyle.annual_holidays/130);
 const overtime=j.workstyle.overtime_hours_month===null?null:Math.max(0,1-j.workstyle.overtime_hours_month/40);
 const rest=holiday===null||overtime===null?null:(holiday+overtime)/2;
 const fixed=j.workstyle.transfer==='unknown'?null:j.workstyle.transfer==='no'?1:0;
 const remote=j.location.remote_policy==='unknown'?null:j.location.remote_policy==='none'?0:1;
 const parts:[number|null,number][]=[[commute,.45],[salary,.2],[rest,.2],[fixed,.1],[remote,.05]];
 const confidence=parts.reduce((s,[v,w])=>s+(v===null?0:w),0);
 return {score:confidence?parts.reduce((s,[v,w])=>s+(v??0)*w,0)/confidence:0,confidence,reason:`通勤45%・基本給20%・休日/残業20%・転勤10%・在宅5%。確認済み項目のみで算出（充足率${Math.round(confidence*100)}%）。賞与額の定量比較は未対応。`};
}
function numeric(a:number|null,b:number|null,desc=false) {if(a===null)return b===null?0:1;if(b===null)return -1;return desc?b-a:a-b;}
export function selectJobs(jobs:Job[],f:Filters):Job[] {
 const unknown=(v:unknown)=>v===null||v==='unknown';
 const min=(v:number|null,n:string)=>!n||(v===null?f.includeUnknown:v>=Number(n));
 const flag=(on:boolean,value:unknown,pass:boolean)=>!on||(unknown(value)?f.includeUnknown:pass);
 const result=jobs.filter(j=>{
  const text=[j.company,j.title,j.location.address,j.description].join(' ').toLocaleLowerCase();
  return f.q.toLocaleLowerCase().split(/\s+/).every(q=>text.includes(q))&&(!f.category||j.category===f.category)&&(!f.region||j.location.region===f.region)
  &&(!f.commute||(j.commute.status==='verified'&&j.commute.minutes!==null&&j.commute.minutes<=Number(f.commute)))
  &&min(monthlyValue(j,f),f.monthly)&&min(annualValue(j,f),f.annual)
  &&flag(f.holidays,j.workstyle.annual_holidays,(j.workstyle.annual_holidays??0)>=120)
  &&flag(f.overtime,j.workstyle.overtime_hours_month,(j.workstyle.overtime_hours_month??Infinity)<=20)
  &&flag(f.remote,j.location.remote_policy,['full','hybrid'].includes(j.location.remote_policy))
  &&flag(f.flex,j.workstyle.flex,j.workstyle.flex==='yes')&&flag(f.transfer,j.workstyle.transfer,j.workstyle.transfer==='no')
  &&flag(f.car,j.workstyle.car_commute,j.workstyle.car_commute==='yes')&&flag(f.parking,j.workstyle.parking,j.workstyle.parking==='yes')&&flag(f.client,j.workstyle.client_site,j.workstyle.client_site==='no');
 });
 return result.sort((a,b)=>{
  let n=0;
  switch(f.sort){
   case 'commute':n=numeric(a.commute.minutes,b.commute.minutes);break;
   case 'monthly':n=numeric(monthlyValue(a,f),monthlyValue(b,f),true);break;
   case 'annual':n=numeric(annualValue(a,f),annualValue(b,f),true);break;
   case 'holidays':n=numeric(a.workstyle.annual_holidays,b.workstyle.annual_holidays,true);break;
   case 'overtime':n=numeric(a.workstyle.overtime_hours_month,b.workstyle.overtime_hours_month);break;
   case 'new':n=b.first_seen_at.localeCompare(a.first_seen_at);break;
   case 'updated':n=b.last_checked_at.localeCompare(a.last_checked_at);break;
   default:{const sa=recommendation(a),sb=recommendation(b);n=sb.score-sa.score;if(!n)n=numeric(a.location.region_band,b.location.region_band);}
  }return n||a.id.localeCompare(b.id);
 });
}

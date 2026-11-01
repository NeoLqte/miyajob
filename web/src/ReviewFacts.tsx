import {ExternalLink} from 'lucide-react';
import type {ReviewCandidate,ReviewFact} from './types';
import {reviewSalary} from './reviewSalary';

const labels:Record<ReviewFact['field'],string>={salary:'給与',location:'募集上の勤務地',employment:'雇用形態',hours:'勤務時間',holidays:'休日',commute:'車通勤・所要時間'};
export default function ReviewFacts({candidate,includeCommute=true}:{candidate:Pick<ReviewCandidate,'facts'>;includeCommute?:boolean}){
 return <><p className="review-facts-caption">原典で分かる条件（応募可否・配属確定とは別）</p><dl className="review-facts">{Object.entries(labels).filter(([field])=>includeCommute||field!=='commute').map(([field,label])=>{
  const fact=candidate.facts?.find(f=>f.field===field);
  const salary=field==='salary'?reviewSalary(fact?.text):null;
  return <div key={field}><dt>{field==='salary'?'月給':label}{fact&&<a href={fact.url} target="_blank" rel="noopener noreferrer" title={`情報確認：${fact.checked_at}`} aria-label={`${label}の根拠（${fact.checked_at}確認）`}><ExternalLink size={12}/></a>}</dt><dd className={fact?'':'fact-unknown'}>{salary?.primary??fact?.text??'不明・未確認'}{salary?.note&&<small className="salary-note">{salary.note}</small>}</dd></div>;
 })}</dl></>;
}

import {ExternalLink} from 'lucide-react';
import type {ReviewCandidate,ReviewFact} from './types';

const labels:Record<ReviewFact['field'],string>={salary:'給与',location:'募集上の勤務地',employment:'雇用形態',hours:'勤務時間',holidays:'休日',commute:'車通勤・所要時間'};
export default function ReviewFacts({candidate}:{candidate:ReviewCandidate}){
 return <><p className="review-facts-caption">原典で分かる条件（応募可否・配属確定とは別）</p><dl className="review-facts">{Object.entries(labels).map(([field,label])=>{
  const fact=candidate.facts?.find(f=>f.field===field);
  return <div key={field}><dt>{label}{fact&&<a href={fact.url} target="_blank" rel="noopener noreferrer" title={`情報確認：${fact.checked_at}`} aria-label={`${label}の根拠（${fact.checked_at}確認）`}><ExternalLink size={12}/></a>}</dt><dd className={fact?'':'fact-unknown'}>{fact?.text??'不明・未確認'}</dd></div>;
 })}</dl></>;
}

import {expect,it} from 'vitest';
import {rankOpportunity,type RankingInput} from '../recommendation';
import {fixture} from './fixtures';
import {defaults,selectJobs} from '../search';
import {candidateMetrics,candidateRecommendation,selectCandidates,verifiedCandidate} from '../candidateSearch';
const base:RankingInput={commute:null,eligibility:null,monthly:null,holidays:null,overtime:null,transfer:'unknown'};
it('never increases a score by removing known positive information',()=>{
 const full={...base,commute:20,eligibility:1,monthly:240000,holidays:125,overtime:5,transfer:'no' as const};
 for(const field of ['commute','eligibility','monthly','holidays','overtime'] as const){
  expect(rankOpportunity({...full,[field]:null}).score).toBeLessThan(rankOpportunity(full).score);
  expect(rankOpportunity({...full,[field]:null}).confidence).toBeLessThan(rankOpportunity(full).confidence);
 }
 expect(rankOpportunity(base).score).toBe(0);
});
it('prioritizes verified commute bands over pay and leaves unknown routes last in both lists',()=>{
 const near=fixture('near'),far=fixture('far'),unknown=fixture('unknown');
 near.commute.minutes=15;near.pay.monthly_base_min_jpy=180000;
 far.commute.minutes=31;far.pay.monthly_base_min_jpy=500000;
 unknown.commute.status='unverified';unknown.commute.minutes=1;unknown.pay.monthly_base_min_jpy=900000;
 expect(selectJobs([unknown,far,near],defaults).map(j=>j.id)).toEqual(['near','far','unknown']);
 const converted=[unknown,far,near].map(verifiedCandidate);
 expect(selectCandidates(converted,{query:'',category:'',region:'',status:'',stage:'',reason:'',sort:'recommended'}).map(j=>j.id)).toEqual(['near','far','unknown']);
});
it('uses holidays independently of overtime and never treats fixed overtime as actual hours',()=>{
 expect(rankOpportunity({...base,holidays:125}).score).toBeGreaterThan(0);
 const j=verifiedCandidate(fixture());delete j.verifiedMetrics;delete j.verifiedWorkstyle;j.status='discovery';
 j.facts=[{field:'hours',text:'9:00〜18:00。固定残業月20時間分',confirmed:true,url:j.url,checked_at:j.checked_at}];
 expect(candidateRecommendation(j).score).toBe(0);
 j.facts[0].text='9:00〜18:00。残業月平均15時間';expect(candidateRecommendation(j).score).toBeGreaterThan(0);
 j.facts=[{field:'holidays',text:'年間休日120日（2024年）',confirmed:true,url:j.url,checked_at:j.checked_at}];
 expect(candidateMetrics(j).holidays).toBeNull();
});

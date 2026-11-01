import {describe,it,expect} from 'vitest';
import {fixture,dataset} from './fixtures';
import {defaults,readFilters,writeFilters,selectJobs,recommendation} from '../search';
import {parseData} from '../data';
describe('publication defense',()=>{
 it('rejects malformed data and hides unchecked eligibility',()=>{expect(()=>parseData({jobs:[]})).toThrow();const d=dataset();d.jobs[0].eligibility.status='review';expect(parseData(d).jobs).toHaveLength(0);});
 it.each(['sources','evidence'] as const)('hides missing %s',key=>{const d=dataset();d.jobs[0][key]=[];expect(parseData(d).jobs).toHaveLength(0);});
 it('hides stale, closed and unverified route records',()=>{const d=dataset(3);d.jobs[0].last_checked_at='2000-01-01';d.jobs[1].recruitment.status='closed';d.jobs[2].commute.status='unverified';expect(parseData(d).jobs).toHaveLength(0);});
 it('rejects additional profile keys and unsafe URLs',()=>{expect(()=>parseData({...dataset(),profile:{age:23}})).toThrow();const d=dataset();d.jobs[0].sources[0].url='javascript:alert(1)';expect(parseData(d).jobs).toHaveLength(0);});
});
describe('filters and sorting',()=>{
 it('roundtrips all URL filter options',()=>{const f={...defaults,q:'会社 開発',holidays:true,car:true,commute:'30',monthly:'200000',view:'table' as const,payBasis:'total' as const,annualBasis:'estimated' as const};expect(readFilters('?'+writeFilters(f))).toEqual(f);});
 it('combines filters with AND and handles missing information',()=>{const j=fixture();expect(selectJobs([j],{...defaults,holidays:true,car:true,q:'TEST'})).toHaveLength(1);expect(selectJobs([j],{...defaults,holidays:true,overtime:true})).toHaveLength(0);expect(selectJobs([j],{...defaults,overtime:true,includeUnknown:true})).toHaveLength(1);});
 it('never includes unmeasured routes in minute filter',()=>{const j=fixture();j.commute.minutes=null;j.commute.status='local_verified';expect(selectJobs([j],{...defaults,commute:'45',includeUnknown:true})).toHaveLength(0);});
 it('sorts null last and deterministically resolves ties',()=>{const a=fixture('a'),b=fixture('b'),c=fixture('c');a.pay.monthly_base_min_jpy=null;expect(selectJobs([c,a,b],{...defaults,sort:'monthly'}).map(j=>j.id)).toEqual(['b','c','a']);a.workstyle.overtime_hours_month=null;b.workstyle.overtime_hours_month=10;c.workstyle.overtime_hours_month=0;expect(selectJobs([a,b,c],{...defaults,sort:'overtime'}).map(j=>j.id)).toEqual(['c','b','a']);});
 it('separates base, total, and estimated annual salary',()=>{const a=fixture('a'),b=fixture('b');a.pay.monthly_total_min_jpy=300000;b.pay.monthly_base_min_jpy=250000;expect(selectJobs([a,b],{...defaults,sort:'monthly'}).map(j=>j.id)).toEqual(['b','a']);expect(selectJobs([a,b],{...defaults,sort:'monthly',payBasis:'total'}).map(j=>j.id)).toEqual(['a','b']);a.pay.annual_basis='estimated';a.pay.annual_min_jpy=4000000;expect(selectJobs([a],{...defaults,annual:'3000000'})).toHaveLength(0);});
 it('explains missing-data confidence separately',()=>{const j=fixture();const first=recommendation(j);j.pay.monthly_base_min_jpy=null;expect(recommendation(j).confidence).toBeLessThan(first.confidence);});
});

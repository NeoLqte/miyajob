import {expect,it} from 'vitest';
import {candidateMetrics,selectCandidates,type BrowseCandidate,type BrowseFilters} from '../candidateSearch';
import {parseReviews,dayNow} from '../data';
const url='https://www.python.org/jobs/';
const candidate=(id:string,text?:string):BrowseCandidate=>({id,company:`TEST ONLY ${id}`,title:'TEST ONLY IT',category:'software',address:'浜松市浜名区新都田',regions:['浜松市浜名区'],url,checked_at:dayNow(),stage:'discovery',status:'discovery',valid_through:null,discovery_verified:true,summary:'TEST ONLY',reasons:['応募資格未確認'],facts:text?[{field:'salary',text,url,checked_at:dayNow(),confirmed:true}]:[]});
const filters:BrowseFilters={query:'',category:'',region:'',status:'',stage:'',reason:'',sort:'monthly'};
it('shows discovery without five conditions only after minimum discovery curation',()=>{
 const j=candidate('new');const parse=(changes:object)=>parseReviews({schema_version:1,updated_at:dayNow(),candidates:[{...j,...changes}]}).candidates;
 expect(parse({})).toHaveLength(1);
 for(const changes of [{discovery_verified:false},{regions:[]},{company:'社名非公開'},{stage:'detail_review'},{status:'review'},{valid_through:'2020-01-01'}])expect(parse(changes)).toHaveLength(0);
 expect(()=>parse({url:'javascript:alert(1)'})).toThrow();
});
it('sorts explicit monthly salary and leaves annual-only, unknown and unconfirmed last',()=>{
 const unknown=candidate('a'),annual=candidate('b','年収600万円'),low=candidate('low','月給20〜25万円'),high=candidate('high','月給285,000円～');
 expect(selectCandidates([unknown,low,annual,high],filters).slice(0,2).map(j=>j.id)).toEqual(['high','low']);
 high.facts![0].confirmed=false;expect(candidateMetrics(high).monthly).toBeNull();
 expect(candidateMetrics(candidate('conflict','月給30万円・金額未確認')).monthly).toBeNull();
});
it('combines status, region, category and keywords, and puts missing holiday/commute last',()=>{
 const a=candidate('a'),b=candidate('b');b.status='review';b.regions=['磐田市'];
 a.facts=[{field:'holidays',text:'年間休日125日',url,checked_at:dayNow(),confirmed:true},{field:'commute',text:'確認済み通勤：30分',url,checked_at:dayNow(),confirmed:true}];
 expect(selectCandidates([b,a],{...filters,sort:'holidays'}).map(j=>j.id)).toEqual(['a','b']);
 expect(selectCandidates([b,a],{...filters,sort:'commute'}).map(j=>j.id)).toEqual(['a','b']);
 expect(selectCandidates([b,a],{...filters,status:'discovery',region:'浜松市浜名区',category:'software',query:'IT 新都田'})).toEqual([a]);
 expect(selectCandidates([b,a],{...filters,status:'review',region:'浜松市浜名区'})).toEqual([]);
});

import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import ResearchPanel from '../ResearchPanel';
import {parseReviews,dayNow,reviewNeedsRecheck} from '../data';
import type {ReviewData} from '../types';

const data:ReviewData={schema_version:1,updated_at:dayNow(),candidates:[{id:'review',company:'TEST ONLY COMPANY',title:'TEST ONLY IT SUPPORT',category:'it_support',address:'TEST ONLY ADDRESS',url:'https://www.python.org/jobs/',checked_at:dayNow(),stage:'detail_review',reasons:['TEST ONLY 配属先'],summary:'TEST ONLY SUMMARY',status:'review',valid_through:null,facts:(['salary','location','employment','holidays','hours'] as const).map(field=>({field,text:`TEST ONLY ${field}`,url:'https://www.python.org/jobs/',checked_at:dayNow(),confirmed:true}))}]};
it('separates unverified candidates, explains reasons and supports search',async()=>{
 const callback=vi.fn(),user=userEvent.setup();render(<ResearchPanel verifiedCount={4} onModeChange={callback} initialData={data}/>);
 await user.click(await screen.findByRole('button',{name:'保留・確認待ち 1件'}));
 expect(callback).toHaveBeenLastCalledWith(true);
 expect(screen.getAllByText(/応募可能とは未確認/)[0]).toBeVisible();
 expect(within(screen.getByRole('article')).getByText('TEST ONLY 配属先')).toBeVisible();
 await user.type(screen.getByPlaceholderText('候補の会社・職種・保留理由'),'no match');
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'応募可能・確認済み 4件'}));
 expect(callback).toHaveBeenLastCalledWith(false);
});
it('rejects profile fields, non-IT categories and false eligibility flags; filters expiry',()=>{
 expect(()=>parseReviews({...data,profile:{age:23}})).toThrow();
 expect(()=>parseReviews({...data,candidates:[{...data.candidates[0],category:'office'}]})).toThrow();
 expect(()=>parseReviews({...data,candidates:[{...data.candidates[0],status:'eligible'}]})).toThrow();
 expect(parseReviews({...data,candidates:[{...data.candidates[0],valid_through:'2020-01-01'}]}).candidates).toHaveLength(0);
});

it('keeps source-screened possible jobs with unknown pay visible only as pending',async()=>{
 const candidate={...data.candidates[0],facts:[],discovery_verified:true,regions:['浜松市浜名区'],screening:(['it_role','regular_employment','graduate','experience'] as const).map(field=>({field,result:field==='graduate'?'unknown' as const:'confirmed' as const,detail:'TEST ONLY mandatory conditions',url:data.candidates[0].url,checked_at:dayNow()}))};
 const user=userEvent.setup();render(<ResearchPanel verifiedCount={0} onModeChange={()=>{}} initialData={{...data,candidates:[candidate]}}/>);
 await user.click(await screen.findByRole('button',{name:'保留・確認待ち 1件'}));
 expect(within(screen.getByRole('article')).getByText('応募可能とは未確認')).toBeVisible();
 expect(within(screen.getByRole('article')).getAllByText('不明・未確認')).toHaveLength(5);
 expect(within(screen.getByRole('article')).getByText('月給不明・未確認')).toBeVisible();
 expect(parseReviews({...data,candidates:[{...candidate,screening:candidate.screening.map(c=>c.field==='experience'?{...c,result:'unknown'}:c)}]}).candidates).toHaveLength(0);
 expect(parseReviews({...data,candidates:[{...candidate,screening:candidate.screening.map(c=>c.field==='experience'?{...c,result:'fail'}:c)}]}).candidates).toHaveLength(0);
});
it('shows confirmed conditions and hides candidates missing any required field',async()=>{
 const detailed:ReviewData={...data,candidates:[{...data.candidates[0],facts:[...data.candidates[0].facts!.filter(f=>!['salary','location'].includes(f.field)),{confirmed:true,field:'salary',text:'TEST ONLY 月給24万円（手当込み）',url:'https://www.python.org/jobs/',checked_at:dayNow()},{confirmed:true,field:'location',text:'TEST ONLY 本社または客先',url:'https://www.python.org/jobs/',checked_at:dayNow()}]}]};
 const user=userEvent.setup();render(<ResearchPanel verifiedCount={4} onModeChange={()=>{}} initialData={detailed}/>);
 await user.click(await screen.findByRole('button',{name:'保留・確認待ち 1件'}));
 expect(screen.getByText('TEST ONLY 月給24万円（手当込み）')).toBeVisible();
 expect(screen.getByText('TEST ONLY 本社または客先')).toBeVisible();
 expect(screen.getAllByText('不明・未確認')).toHaveLength(1);
 for(const field of ['salary','location','employment','holidays','hours']) {
  const incomplete={...detailed,candidates:[{...detailed.candidates[0],facts:detailed.candidates[0].facts!.filter(f=>f.field!==field)}]};
  expect(parseReviews(incomplete).candidates).toHaveLength(0);
 }
 expect(parseReviews({...detailed,candidates:[{...detailed.candidates[0],facts:detailed.candidates[0].facts!.map(f=>({...f,confirmed:false}))}]}).candidates).toHaveLength(0);
 expect(screen.getByRole('link',{name:/給与の根拠/})).toHaveAttribute('href','https://www.python.org/jobs/');
 await user.type(screen.getByPlaceholderText('候補の会社・職種・保留理由'),'24万円');
 expect(screen.getByRole('article')).toBeVisible();
 expect(()=>parseReviews({...detailed,candidates:[{...detailed.candidates[0],facts:[{...detailed.candidates[0].facts![0],url:'javascript:alert(1)'}]}]})).toThrow();
 const oldFact={...detailed.candidates[0],facts:[{...detailed.candidates[0].facts![0],checked_at:'2020-01-01'}]};
 expect(reviewNeedsRecheck(oldFact)).toBe(true);
});

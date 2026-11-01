import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,vi} from 'vitest';
import ResearchPanel from '../ResearchPanel';
import {parseReviews,dayNow} from '../data';
import type {ReviewData} from '../types';

const data:ReviewData={schema_version:1,updated_at:dayNow(),candidates:[{id:'review',company:'TEST ONLY COMPANY',title:'TEST ONLY IT SUPPORT',category:'it_support',address:'TEST ONLY ADDRESS',url:'https://www.python.org/jobs/',checked_at:dayNow(),stage:'detail_review',reasons:['TEST ONLY 配属先'],summary:'TEST ONLY SUMMARY',status:'review',valid_through:null}]};
it('separates unverified candidates, explains reasons and supports search',async()=>{
 const callback=vi.fn(),user=userEvent.setup();render(<ResearchPanel verifiedCount={4} onModeChange={callback} initialData={data}/>);
 await user.click(await screen.findByRole('button',{name:'保留・確認待ち 1件'}));
 expect(callback).toHaveBeenLastCalledWith(true);
 expect(screen.getByText(/応募可能とは未確認/)).toBeVisible();
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

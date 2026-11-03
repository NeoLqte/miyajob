import {render,screen,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {BookmarksProvider} from '../BookmarksContext';
import BookmarkManager,{BookmarkButton} from '../Bookmarks';
import {bookmarkKey,parseBookmarks,type BookmarkJob} from '../bookmarkStore';
const job:BookmarkJob={id:'TEST ONLY 1',company:'TEST ONLY COMPANY',title:'TEST ONLY ROLE',address:'TEST ONLY ADDRESS',url:'https://www.python.org/jobs/',status:'review',checked_at:'2026-11-03'};
beforeEach(()=>localStorage.clear());
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();});
function renderBookmarks(candidates:BookmarkJob[]=[job]){
 return render(<BookmarksProvider><div aria-label="求人一覧"><BookmarkButton job={job}/></div><BookmarkManager candidates={candidates}/></BookmarksProvider>);
}
it('persists multiple folders, supports rename/filter, and preserves bookmarks on folder deletion',async()=>{
 const user=userEvent.setup();const app=renderBookmarks();
 const listing=within(screen.getByLabelText('求人一覧'));
 await user.click(listing.getByRole('button',{name:/ブックマークに保存/}));
 await user.click(screen.getByRole('button',{name:'ブックマーク 1件'}));
 const manager=within(screen.getByRole('region',{name:'ブックマーク'}));
 for(const name of ['近い会社','未経験向け']){
  await user.type(manager.getByLabelText('新しいフォルダ名'),name);
  await user.click(manager.getByRole('button',{name:'フォルダを作成'}));
 }
 await user.click(listing.getByText('保存先：未分類'));
 for(const name of ['近い会社','未経験向け'])await user.click(listing.getByRole('checkbox',{name}));
 const saved=parseBookmarks(localStorage.getItem(bookmarkKey));
 expect(saved.items).toHaveLength(1);expect(saved.items[0].folder_ids).toHaveLength(2);
 await user.selectOptions(manager.getByLabelText('保存フォルダ'),saved.folders[0].id);
 expect(manager.getByRole('article')).toHaveTextContent('保留・確認待ち');
 await user.click(manager.getByText('フォルダの名前変更・削除'));
 const rename=manager.getByLabelText('近い会社の新しいフォルダ名');
 await user.clear(rename);await user.type(rename,'優先候補');
 await user.click(within(rename.closest('form')!).getByRole('button',{name:'名前を変更'}));
 expect(parseBookmarks(localStorage.getItem(bookmarkKey)).folders[0].name).toBe('優先候補');
 for(const name of ['優先候補','未経験向け']){
  const field=manager.getByLabelText(name+'の新しいフォルダ名');
  await user.click(within(field.closest('form')!).getByRole('button',{name:'フォルダを削除（求人は残す）'}));
 }
 expect(parseBookmarks(localStorage.getItem(bookmarkKey)).items[0].folder_ids).toEqual([]);
 await user.selectOptions(manager.getByLabelText('保存フォルダ'),'unfiled');
 expect(manager.getByRole('article')).toBeVisible();
 app.unmount();renderBookmarks([]);
 await user.click(screen.getByRole('button',{name:'ブックマーク 1件'}));
 expect(screen.getByText(/現在の一覧にない保存求人/)).toBeVisible();
 expect(within(screen.getByRole('region',{name:'ブックマーク'})).queryByText('確認済み',{exact:true})).not.toBeInTheDocument();
});
it('does not pretend a quota failure was saved or overwrite corrupt storage',async()=>{
 const user=userEvent.setup();renderBookmarks();
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('quota','QuotaExceededError');});
 await user.click(screen.getByRole('button',{name:/ブックマークに保存/}));
 expect(screen.getByRole('alert')).toHaveTextContent('保存できませんでした');
 expect(screen.getByRole('button',{name:'ブックマーク 0件'})).toBeVisible();
 expect(localStorage.getItem(bookmarkKey)).toBeNull();
});
it('rejects corrupted records and unsafe source URLs',()=>{
 expect(()=>parseBookmarks('broken')).toThrow();
 const data={version:1,folders:[],items:[{...job,folder_ids:[]}]};
 expect(parseBookmarks(JSON.stringify(data)).items).toHaveLength(1);
 for(const changes of [{url:'javascript:alert(1)'},{folder_ids:['missing']},{status:'verified'},{checked_at:'unknown'}])expect(()=>parseBookmarks(JSON.stringify({...data,items:[{...data.items[0],...changes}]}))).toThrow();
 localStorage.setItem(bookmarkKey,'broken');renderBookmarks();
 expect(screen.getByRole('alert')).toHaveTextContent('既存データは上書きしていません');
});


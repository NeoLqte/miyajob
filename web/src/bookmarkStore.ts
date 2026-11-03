export type BookmarkJob={id:string;company:string;title:string;address:string;url:string;status:'eligible'|'review'|'discovery';checked_at:string};
export type SavedJob=BookmarkJob&{folder_ids:string[]};
export type BookmarkData={version:1;folders:{id:string;name:string}[];items:SavedJob[]};
export const bookmarkKey='miyajob.bookmarks.v1';
export const emptyBookmarks=():BookmarkData=>({version:1,folders:[],items:[]});
export function parseBookmarks(raw:string|null):BookmarkData{
 if(raw===null)return emptyBookmarks();
 const d=JSON.parse(raw);
 if(d?.version!==1||!Array.isArray(d.folders)||d.folders.length>100||!Array.isArray(d.items)||d.items.length>2000)throw Error('invalid bookmarks');
 const text=(x:unknown,n=500):x is string=>typeof x==='string'&&x.length>0&&x.length<=n;
 if(d.folders.some((f:{id:unknown;name:unknown})=>!text(f.id,100)||!text(f.name,60))||new Set(d.folders.map((f:{id:string})=>f.id)).size!==d.folders.length)throw Error('invalid folders');
 const folderIds=new Set(d.folders.map((f:{id:string})=>f.id));
 for(const j of d.items){
  if(!['id','company','title','address','url','checked_at'].every(k=>text(j[k],k==='url'?3000:500))||!['eligible','review','discovery'].includes(j.status)||!/^\d{4}-\d{2}-\d{2}$/.test(j.checked_at)||!Array.isArray(j.folder_ids)||j.folder_ids.some((id:unknown)=>!folderIds.has(id))||new Set(j.folder_ids).size!==j.folder_ids.length)throw Error('invalid saved job');
  const url=new URL(j.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('invalid source');
 }
 if(new Set(d.items.map((j:SavedJob)=>j.id)).size!==d.items.length)throw Error('duplicate bookmarks');
 return d;
}
export function cleanFolderName(name:string){const value=name.trim();if(!value||value.length>60)throw Error('フォルダ名は1〜60文字で入力してください。');return value;}


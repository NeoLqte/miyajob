import {createContext,useCallback,useContext,useEffect,useState,type ReactNode} from 'react';
import {bookmarkKey,emptyBookmarks,parseBookmarks,cleanFolderName,type BookmarkData,type BookmarkJob} from './bookmarkStore';
type Store={data:BookmarkData;error:string;toggle:(j:BookmarkJob)=>void;createFolder:(name:string)=>void;renameFolder:(id:string,name:string)=>void;deleteFolder:(id:string)=>void;assign:(jobId:string,folderId:string,checked:boolean)=>void};
const Context=createContext<Store|null>(null);
function load(){try{return {data:parseBookmarks(localStorage.getItem(bookmarkKey)),error:''};}catch{return {data:emptyBookmarks(),error:'保存データを読み込めません。既存データは上書きしていません。ブラウザーの保存設定をご確認ください。'};}}
export function BookmarksProvider({children}:{children:ReactNode}){
 const [loaded]=useState(load),[data,setData]=useState(loaded.data),[error,setError]=useState(loaded.error);
 const commit=useCallback((mutate:(d:BookmarkData)=>BookmarkData)=>{
  try{
   const latest=parseBookmarks(localStorage.getItem(bookmarkKey));
   const next=mutate(latest);
   parseBookmarks(JSON.stringify(next));
   localStorage.setItem(bookmarkKey,JSON.stringify(next));setData(next);setError('');
  }catch(e){setError(e instanceof Error&&/フォルダ|同じ名前/.test(e.message)?e.message:'保存できませんでした。既存データは上書きせず保持しています。ブラウザーの保存設定・空き容量をご確認ください。');}
 },[]);
 useEffect(()=>{const refresh=(e:StorageEvent)=>{if(e.key===bookmarkKey||e.key===null){const next=load();setData(next.data);setError(next.error);}};window.addEventListener('storage',refresh);return()=>window.removeEventListener('storage',refresh);},[]);
 const validateName=(d:BookmarkData,name:string,except?:string)=>{const value=cleanFolderName(name);if(d.folders.some(f=>f.id!==except&&f.name===value))throw Error('同じ名前のフォルダがあります。');return value;};
 return <Context.Provider value={{data,error,
 toggle:j=>commit(d=>({...d,items:d.items.some(x=>x.id===j.id)?d.items.filter(x=>x.id!==j.id):[...d.items,{id:j.id,company:j.company,title:j.title,address:j.address,url:j.url,status:j.status,checked_at:j.checked_at,folder_ids:[]}]})),
 createFolder:name=>commit(d=>({...d,folders:[...d.folders,{id:crypto.randomUUID(),name:validateName(d,name)}]})),
 renameFolder:(id,name)=>commit(d=>({...d,folders:d.folders.map(f=>f.id===id?{...f,name:validateName(d,name,id)}:f)})),
 deleteFolder:id=>commit(d=>({...d,folders:d.folders.filter(f=>f.id!==id),items:d.items.map(j=>({...j,folder_ids:j.folder_ids.filter(f=>f!==id)}))})),
 assign:(id,folder,checked)=>commit(d=>({...d,items:d.items.map(j=>j.id===id?{...j,folder_ids:checked?[...new Set([...j.folder_ids,folder])]:j.folder_ids.filter(f=>f!==folder)}:j)}))
 }}>{children}</Context.Provider>;
}
export const useBookmarks=()=>useContext(Context);


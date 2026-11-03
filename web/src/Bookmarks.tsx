import AddressText from './AddressText';
import {useState} from 'react';
import {Bookmark,FolderPlus} from 'lucide-react';
import {useBookmarks} from './BookmarksContext';
import type {BookmarkJob} from './bookmarkStore';
const statusLabels={eligible:'確認済み',review:'保留・確認待ち',discovery:'未審査・新規候補'};
export function BookmarkButton({job}:{job:BookmarkJob}){
 const store=useBookmarks();if(!store)return null;
 const saved=store.data.items.find(j=>j.id===job.id);
 return <div className="bookmark-control"><button className="secondary bookmark-button" aria-pressed={!!saved} aria-label={saved?`${job.company} ${job.title}のブックマークを解除`:`${job.company} ${job.title}をブックマークに保存`} onClick={()=>store.toggle(job)}><Bookmark size={15} fill={saved?'currentColor':'none'}/>{saved?'保存済み':'保存'}</button>{saved&&<details className="bookmark-folders"><summary>保存先：{saved.folder_ids.length?store.data.folders.filter(f=>saved.folder_ids.includes(f.id)).map(f=>f.name).join('、'):'未分類'}</summary>{store.data.folders.length?store.data.folders.map(f=><label key={f.id}><input type="checkbox" checked={saved.folder_ids.includes(f.id)} onChange={e=>store.assign(job.id,f.id,e.target.checked)}/>{f.name}</label>):<p>上の「ブックマーク」からフォルダを作成できます。</p>}</details>}</div>;
}
function FolderEditor({id,name}:{id:string;name:string}){
 const store=useBookmarks()!,[value,setValue]=useState(name);
 return <form className="folder-editor" onSubmit={e=>{e.preventDefault();store.renameFolder(id,value);}}><input aria-label={`${name}の新しいフォルダ名`} value={value} maxLength={60} onChange={e=>setValue(e.target.value)}/><button className="secondary" type="submit">名前を変更</button><button className="text-button" type="button" onClick={()=>store.deleteFolder(id)}>フォルダを削除（求人は残す）</button></form>;
}
export default function BookmarkManager({candidates}:{candidates:BookmarkJob[]}){
 const store=useBookmarks(),[open,setOpen]=useState(false),[name,setName]=useState(''),[folder,setFolder]=useState('all'),[query,setQuery]=useState('');
 if(!store)return null;
 const current=new Map(candidates.map(j=>[j.id,j]));
 const selected=folder==='all'||folder==='unfiled'||store.data.folders.some(f=>f.id===folder)?folder:'all';
 const items=store.data.items.filter(j=>(selected==='all'||selected==='unfiled'&&!j.folder_ids.length||j.folder_ids.includes(selected))&&`${current.get(j.id)?.company??j.company} ${current.get(j.id)?.title??j.title} ${current.get(j.id)?.address??j.address}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 return <section className="bookmark-manager" aria-label="ブックマーク"><button className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}><Bookmark size={16}/>ブックマーク {store.data.items.length}件</button>{store.error&&<p role="alert">{store.error}</p>}{open&&<div className="bookmark-content"><h2>保存した求人</h2><p className="muted">このブラウザー内に保存します。別の端末とは同期されず、ブラウザーのサイトデータを削除すると消えます。複数のフォルダに分類できます。</p><form className="folder-create" onSubmit={e=>{e.preventDefault();store.createFolder(name);setName('');}}><label className="field-label">新しいフォルダ名<input aria-label="新しいフォルダ名" placeholder="例：近い会社・未経験向け・応募候補" value={name} maxLength={60} onChange={e=>setName(e.target.value)} required/></label><button className="secondary" type="submit"><FolderPlus size={16}/>フォルダを作成</button></form><div className="bookmark-filters"><label className="field-label">保存フォルダ<select aria-label="保存フォルダ" value={selected} onChange={e=>setFolder(e.target.value)}><option value="all">すべての保存求人</option><option value="unfiled">未分類</option>{store.data.folders.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="field-label">保存求人を検索<input aria-label="保存求人を検索" value={query} onChange={e=>setQuery(e.target.value)} placeholder="会社名・職種・勤務地"/></label></div><details><summary>フォルダの名前変更・削除</summary>{store.data.folders.map(f=><FolderEditor key={f.id+f.name} {...f}/>)}{!store.data.folders.length&&<p>フォルダはまだありません。</p>}</details><p aria-live="polite">保存求人 {items.length}件</p>{!items.length&&<p>該当する保存求人はありません。求人の「保存」から追加できます。</p>}<div className="bookmark-list">{items.map(saved=>{const live=current.get(saved.id),job=live??saved;return <article key={saved.id} className="bookmark-card"><p className="company">{job.company}</p><h3>{job.title}</h3><p><AddressText text={job.address}/></p><p>{live?statusLabels[live.status]:'現在の一覧にない保存求人：募集状況・条件は原典で再確認してください。'}</p><small>{live?'情報確認':'保存時の情報確認'}：{job.checked_at}</small><BookmarkButton job={job}/><a className="text-button" href={job.url} target="_blank" rel="noopener noreferrer">原典を見る</a></article>;})}</div></div>}</section>;
}


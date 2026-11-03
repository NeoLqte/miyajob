import AddressText from './AddressText';
import BookmarkManager,{BookmarkButton} from './Bookmarks';
import EntryGuide,{EntryFilters} from './EntryGuide';
import {useEffect,useState} from 'react';
import {ExternalLink,Search} from 'lucide-react';
import {parseReviews,reviewNeedsRecheck} from './data';
import {categories} from './search';
import {candidateRegions,candidateMetrics,selectCandidates,verifiedCandidate,type BrowseCandidate} from './candidateSearch';
import ReviewFacts from './ReviewFacts';
import Screening from './Screening';
import {rankingExplanation} from './recommendation';
import type {Job,ReviewData} from './types';

const labels={eligible:'確認済み',review:'保留・確認待ち',discovery:'未審査・新規候補'};

type Mode=keyof typeof labels|'all';
export default function ResearchPanel({verifiedCount,verifiedJobs=[],onModeChange,initialData}:{verifiedCount:number;verifiedJobs?:Job[];onModeChange:(pending:boolean)=>void;initialData?:ReviewData}){
 const [data,setData]=useState<ReviewData|null>(null),[error,setError]=useState(''),[mode,setMode]=useState<Mode>('eligible');
 const [skill,setSkill]=useState(''),[audience,setAudience]=useState('');
 const [query,setQuery]=useState(''),[stage,setStage]=useState(''),[category,setCategory]=useState(''),[reason,setReason]=useState(''),[region,setRegion]=useState(''),[status,setStatus]=useState(''),[sort,setSort]=useState('recommended');
 useEffect(()=>{const controller=new AbortController();if(initialData){try{setData(parseReviews(initialData));}catch{setError('候補データを読み込めませんでした。');}return;}
 fetch(`${import.meta.env.BASE_URL}review-jobs.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>setData(parseReviews(d))).catch(e=>{if(e.name!=='AbortError')setError('候補データを読み込めませんでした。');});return()=>controller.abort();},[initialData]);
 const candidates:BrowseCandidate[]=[...verifiedJobs.map(verifiedCandidate),...(data?.candidates??[])];
 const counts={eligible:verifiedCount,review:candidates.filter(j=>j.status==='review').length,discovery:candidates.filter(j=>j.status==='discovery').length,all:verifiedCount+(data?.candidates.length??0)};
 const choose=(value:Mode)=>{setMode(value);setStatus(value==='all'?'':value);setStage('');setReason('');onModeChange(value!=='eligible');};
 const result=selectCandidates(candidates,{query,stage,category,reason,region,status,sort,skill,audience});
 const regions=[...new Set(candidates.flatMap(candidateRegions))].sort();
 return <section className="research-panel" aria-label="IT求人の確認状況"><div className="research-tabs" aria-label="表示する求人">{(['eligible','review','discovery','all'] as const).map(m=><button key={m} className={mode===m?'primary':'secondary'} aria-pressed={mode===m} onClick={()=>choose(m)}>{m==='eligible'?'応募可能・確認済み':m==='all'?'すべての候補':labels[m]} {m==='eligible'||data?`${counts[m]}件`:'…'}</button>)}</div><BookmarkManager candidates={candidates}/>
 {mode!=='eligible'&&<div className="research-content"><h2>{mode==='review'?'保留・確認待ちのIT求人':mode==='discovery'?'未審査・新規候補':'すべてのIT求人・候補'} <span className="count">{result.length}<small>件</small></span></h2><p className="research-notice">{mode==='review'?'簡易確認で応募の可能性がある求人や、詳細の追加確認が必要な求人です。待遇5項目が未確認の求人も含み、応募可能とは未確認です。':'未審査・新規候補は企業・募集ページ・IT職種・対象地域を確認した発見段階です。応募可能とは未確認です。'} 未確認の給与・休日・勤務時間・通勤は推測せず「未確認」と表示します。募集継続・応募資格・車45分以内などの残る確認は、各求人の理由をご覧ください。</p><EntryFilters skill={skill} audience={audience} onSkill={setSkill} onAudience={setAudience}/><div className="research-controls">
 <label className="field-label">候補を検索<div className="input-icon"><Search size={16}/><input placeholder="候補の会社・職種・保留理由" value={query} onChange={e=>setQuery(e.target.value)}/></div></label>
 <label className="field-label">確認状態<select aria-label="確認状態" value={status} onChange={e=>setStatus(e.target.value)}><option value="">すべての確認状態</option>{Object.entries(labels).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 <label className="field-label">勤務地<select aria-label="候補の勤務地" value={region} onChange={e=>setRegion(e.target.value)}><option value="">すべての地域</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
 <label className="field-label">IT職種<select aria-label="IT職種" value={category} onChange={e=>setCategory(e.target.value)}><option value="">すべてのIT職種</option>{(['software','internal_it','infrastructure','it_support'] as const).map(k=><option key={k} value={k}>{categories[k]}</option>)}</select></label>
 <label className="field-label">並び順<select aria-label="候補の並び順" value={sort} onChange={e=>setSort(e.target.value)}><option value="recommended">おすすめ順（通勤優先）</option><option value="updated">確認日が新しい順</option><option value="monthly">月給が高い順</option><option value="holidays">年間休日が多い順</option><option value="commute">通勤時間が短い順</option></select><small>未確認の数値は末尾。年収の月額換算はソート対象外。</small></label>
 <label className="field-label">調査段階<select aria-label="調査段階" value={stage} onChange={e=>setStage(e.target.value)}><option value="">すべての段階</option><option value="detail_review">調査済み・追加確認待ち</option><option value="discovery">発見・詳細未確認</option></select></label>
 <label className="field-label">保留理由<select aria-label="保留理由" value={reason} onChange={e=>setReason(e.target.value)}><option value="">すべての理由</option>{[...new Set(candidates.flatMap(j=>j.reasons))].sort().map(r=><option key={r}>{r}</option>)}</select></label>
 <button className="secondary" onClick={()=>{setQuery('');setSkill('');setAudience('');setCategory('');setRegion('');setReason('');setStage('');setSort('recommended');setStatus(mode==='all'?'':mode);}}>候補の絞り込みをクリア</button></div>
 {sort==='recommended'&&<p className="ranking-explanation">{rankingExplanation}</p>}
 {error?<p role="alert">{error}</p>:!data?<p role="status">候補を読み込んでいます…</p>:!result.length?<p role="status">条件に合う確認待ち候補はありません。</p>:<div className="research-cards">{result.map(j=><article className="research-card" key={j.id}><div className="card-top"><span className="category-tag">{categories[j.category]}</span><span className="review-badge">{labels[j.status]}</span></div><p className="company">{j.company}</p><h3>{j.title}</h3><p className="location">勤務地：<AddressText text={j.address} region={j.regions?.find(r=>r.startsWith('浜松市'))}/></p>{j.status!=='eligible'&&<strong className="candidate-warning">応募可能とは未確認</strong>}<BookmarkButton job={j}/><EntryGuide id={j.id}/><ReviewFacts candidate={j}/><Screening checks={j.screening}/>{candidateMetrics(j).commute!==null&&<p>確認済み通勤：参考 {candidateMetrics(j).commute}分（予測上限）</p>}<p>{j.summary}</p><h4>{j.status==='eligible'?'確認状態':'保留理由・残る確認'}</h4><ul>{j.reasons.map(r=><li key={r}>{r}</li>)}</ul>{reviewNeedsRecheck(j)&&<p className="freshness-warning">確認から30日超。募集継続の再確認が必要です。</p>}<div className="card-bottom"><small>情報確認：{j.checked_at}</small><a className="text-button" href={j.url} target="_blank" rel="noopener noreferrer">原典を見る <ExternalLink size={14}/></a></div></article>)}</div>}</div>}
 </section>;
}

import {guidance,guidanceValues,skillLabels,audienceLabels} from './guidance';
export function EntryFilters({skill,audience,onSkill,onAudience}:{skill:string;audience:string;onSkill:(v:string)=>void;onAudience:(v:string)=>void}){
 return <div className="entry-filters"><label className="field-label">応募時の知識<select aria-label="応募時の知識" value={skill} onChange={e=>onSkill(e.target.value)}><option value="">すべての知識条件</option>{Object.entries(skillLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label className="field-label">採用対象<select aria-label="採用対象" value={audience} onChange={e=>onAudience(e.target.value)}><option value="">すべての採用区分</option>{Object.entries(audienceLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><p className="muted">中途・キャリア採用は掲載対象外です。実務未経験可と知識不要は別です。新卒枠・第二新卒歓迎だけでは、職歴なし既卒の応募可否は確定しません。通年募集だけで中途向けとは判定しません。</p></div>;
}
export default function EntryGuide({id}:{id:string}){
 const g=guidance[id],v=guidanceValues(id);
 return <div className="entry-guide"><div className="entry-tags"><span className="category-tag">{skillLabels[v.skill as keyof typeof skillLabels]}</span><span className="category-tag">{audienceLabels[v.audience as keyof typeof audienceLabels]}</span></div><details><summary>知識条件・採用区分の根拠</summary>{(['skill','audience'] as const).map(field=><p key={field}><b>{field==='skill'?'応募時の知識':'採用対象'}：</b>{g?.[field]?.detail??'根拠の整理が未完了です。条件なし・応募不可のどちらとも判定していません。'}{g?.[field]&&<> <a href={g[field]!.url} target="_blank" rel="noopener noreferrer">原典</a><small>（根拠確認：{g[field]!.checked_at}）</small></>}</p>)}</details></div>;
}


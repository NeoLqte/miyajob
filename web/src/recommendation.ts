export type RankingInput={commute:number|null;eligibility:number|null;monthly:number|null;holidays:number|null;overtime:number|null;transfer:'yes'|'no'|'unknown'};
export const rankingExplanation='通勤15分帯を最優先（15分以内→30分以内→45分以内→未確認）。帯内は通勤60%・応募条件の確認度20%・月給8%・休日6%・残業4%・転勤2%。未確認は加点せず、既知項目だけで割り戻しません。応募確率ではありません。';
export function rankOpportunity(v:RankingInput){
 const cap=(x:number)=>Math.max(0,Math.min(1,x));
 const parts:[number|null,number][]=[
  [v.commute===null?null:cap(1-v.commute/45),.6],
  [v.eligibility,.2],
  [v.monthly===null?null:cap(v.monthly/350000),.08],
  [v.holidays===null?null:cap(v.holidays/130),.06],
  [v.overtime===null?null:cap(1-v.overtime/40),.04],
  [v.transfer==='unknown'?null:v.transfer==='no'?1:0,.02],
 ];
 return {score:parts.reduce((s,[x,w])=>s+(x??0)*w,0),confidence:parts.reduce((s,[x,w])=>s+(x===null?0:w),0),commuteBand:v.commute===null?4:Math.max(0,Math.ceil(v.commute/15)-1),reason:rankingExplanation};
}

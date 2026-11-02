import type {ScreeningCheck} from './types';
const labels={it_role:'IT職種',regular_employment:'正社員',graduate:'既卒応募',experience:'実務経験要件'};
export default function Screening({checks=[]}:{checks?:ScreeningCheck[]}){
 if(!checks.length)return null;
 return <details className="screening"><summary>応募条件の簡易チェック</summary><p>項目単位の確認です。応募可能という総合判定ではありません。</p><ul>{checks.map(c=><li key={c.field}><strong>{labels[c.field]}：{c.result==='confirmed'?'確認済み':c.result==='fail'?'条件不適合':'確認待ち'}</strong><br/>{c.detail} <a href={c.url} target="_blank" rel="noopener noreferrer">根拠（{c.checked_at}）</a></li>)}</ul></details>;
}

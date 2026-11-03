import raw from './job-guidance.json' with {type:'json'};
export const skillLabels={training:'知識要件なし・育成の記載',basics:'基礎知識・学習経験が必要',specific:'具体的な技術・経験条件あり',unknown:'必要知識は未確認'};
export const audienceLabels={graduate:'新卒・既卒対象の記載あり',career:'中途・キャリア向け',second:'第二新卒枠（既卒適用に注意）',unknown:'採用区分は未確認'};
export type GuidanceFact={value:string;detail:string;url:string;checked_at:string};
export const guidance:Record<string,{skill?:GuidanceFact;audience?:GuidanceFact}>=raw;
export function guidanceValues(id:string){return {skill:guidance[id]?.skill?.value??'unknown',audience:guidance[id]?.audience?.value??'unknown'};}
export function matchesGuidance(id:string,skill='',audience=''){const g=guidanceValues(id);return (!skill||g.skill===skill)&&(!audience||g.audience===audience);}


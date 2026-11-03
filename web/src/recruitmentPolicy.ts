import policy from '../../config/recruitment-policy.json' with {type:'json'};
type RecruitmentRecord={id:string;title?:string;recruitment_track?:string;sources?:{url:string}[];url?:string};
export function careerExcluded(job:RecruitmentRecord):boolean{
 if(!policy.exclude_career)return false;
 if(policy.excluded_ids.includes(job.id))return true;
 const track=job.recruitment_track??'';
 if(/中途|キャリア|^career$|^mid[-_]career$/i.test(track)&&!/新卒/.test(track))return true;
 if(/（中途|中途採用|キャリア採用|キャリア・/.test(job.title??''))return true;
 if(/新卒/.test(job.title??''))return false;
 return [...(job.sources??[]).map(s=>s.url),...(job.url?[job.url]:[])].some(u=>policy.career_source_prefixes.some(p=>u.startsWith(p)));
}


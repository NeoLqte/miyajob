export type Tri = 'yes'|'no'|'unknown';
export type Category = 'software'|'infrastructure'|'internal_it'|'it_support'|'technical'|'office'|'other';
export interface Evidence {id:string;field:string;url:string;quote_or_locator:string;checked_at:string;valid_through?:string|null;conclusion:'pass'|'fail'|'unknown';method:'official_page'|'job_board'|'direct_confirmation'|'other';notes:string}
export interface Requirement {field:string;operator:'any'|'eq'|'gte'|'lte'|'in'|'between';value:string|number|boolean|string[]|null;description:string;evidence_ids:string[]}
export interface Job {
 id:string;company:string;employer:string;title:string;category:Category;recruitment_track:string;employment_type:'full_time_regular'|'contract'|'part_time'|'dispatch'|'unknown';description:string;
 location:{address:string;region:string;region_band:number|null;is_fixed:boolean;remote_policy:'full'|'hybrid'|'none'|'unknown';residence_verified:boolean};
 commute:{minutes:number|null;status:'verified'|'local_verified'|'unverified'|'remote_verified';provider:string|null;checked_at:string|null;route_assumptions:string|null};
 pay:{monthly_base_min_jpy:number|null;monthly_total_min_jpy:number|null;annual_min_jpy:number|null;annual_basis:'guaranteed'|'estimated'|'unknown';bonus:string;fixed_overtime:string;allowances:string};
 workstyle:{annual_holidays:number|null;overtime_hours_month:number|null;flex:Tri;transfer:Tri;car_commute:Tri;parking:Tri;client_site:Tri};
 eligibility:{status:'eligible'|'review'|'rejected';graduate_eligibility:'pass'|'fail'|'unknown';professional_experience:'pass'|'fail'|'unknown';requirements:Requirement[]};
 recruitment:{status:'active'|'closed'|'unverified';valid_through:string|null;date_posted:string|null};
 sources:{url:string;original_url:string;kind:'official'|'job_board'|'other';checked_at:string}[];
 evidence:Evidence[];first_seen_at:string;last_checked_at:string;
}
export interface PublicData {schema_version:1;updated_at:string|null;collection_status:'not_collected'|'research_in_progress'|'verified_export';jobs:Job[]}

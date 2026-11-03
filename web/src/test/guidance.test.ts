import {it,expect} from 'vitest';
import {guidanceValues,matchesGuidance} from '../guidance';
import {readFilters,writeFilters,defaults} from '../search';
import {careerExcluded} from '../recruitmentPolicy';
it('distinguishes no prior knowledge requirements from basic knowledge and missing evidence',()=>{
 expect(guidanceValues('7a8f094d6ab6b9b7b91e').skill).toBe('training');
 expect(guidanceValues('707063548a27fea0c9fb').skill).toBe('basics');
 expect(guidanceValues('not-yet-classified')).toEqual({skill:'unknown',audience:'unknown'});
 expect(matchesGuidance('707063548a27fea0c9fb','training')).toBe(false);
 expect(matchesGuidance('707063548a27fea0c9fb','basics','graduate')).toBe(true);
});
it('does not mistake year-round graduate recruitment for career recruitment or second graduate for graduate acceptance',()=>{
 expect(guidanceValues('3ba29440697647a1683a').audience).toBe('graduate');
 expect(careerExcluded({id:'fac7834dafdea4c27e19'})).toBe(true);
 expect(careerExcluded({id:'new',recruitment_track:'中途・未経験者'})).toBe(true);
 expect(careerExcluded({id:'new',recruitment_track:'unknown',title:'通年新卒採用'})).toBe(false);
 expect(careerExcluded({id:'new',title:'新卒枠',url:'https://www.armonicos.co.jp/recruit/career/'})).toBe(false);
 expect(careerExcluded({id:'new',url:'https://www.jmsc.co.jp/career/job_detail/example/'})).toBe(false);
});
it('round-trips both verified filters and drops unsupported values',()=>{
 const filters={...defaults,skill:'basics',audience:'graduate'};
 expect(readFilters('?'+writeFilters(filters))).toEqual(filters);
 expect(readFilters('?skill=made-up&audience=made-up').skill).toBe('');
 expect(readFilters('?skill=made-up&audience=made-up').audience).toBe('');
});


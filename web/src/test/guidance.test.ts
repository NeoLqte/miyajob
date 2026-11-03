import {it,expect} from 'vitest';
import {guidanceValues,matchesGuidance} from '../guidance';
import {readFilters,writeFilters,defaults} from '../search';
it('distinguishes no prior knowledge requirements from basic knowledge and missing evidence',()=>{
 expect(guidanceValues('7a8f094d6ab6b9b7b91e').skill).toBe('training');
 expect(guidanceValues('fac7834dafdea4c27e19').skill).toBe('basics');
 expect(guidanceValues('not-yet-classified')).toEqual({skill:'unknown',audience:'unknown'});
 expect(matchesGuidance('fac7834dafdea4c27e19','training')).toBe(false);
 expect(matchesGuidance('fac7834dafdea4c27e19','basics','second')).toBe(true);
});
it('does not mistake year-round graduate recruitment for career recruitment or second graduate for graduate acceptance',()=>{
 expect(guidanceValues('3ba29440697647a1683a').audience).toBe('graduate');
 expect(guidanceValues('fac7834dafdea4c27e19').audience).toBe('second');
 expect(guidanceValues('40edfed3440bbd03c97f').audience).toBe('career');
});
it('round-trips both verified filters and drops unsupported values',()=>{
 const filters={...defaults,skill:'basics',audience:'graduate'};
 expect(readFilters('?'+writeFilters(filters))).toEqual(filters);
 expect(readFilters('?skill=made-up&audience=made-up').skill).toBe('');
 expect(readFilters('?skill=made-up&audience=made-up').audience).toBe('');
});


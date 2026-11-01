import {it,expect} from 'vitest';
import {reviewSalary} from '../reviewSalary';

it('keeps actual monthly pay and overtime qualifications unchanged',()=>{
 const original='月給23.5〜34万円（固定残業代を含む）';
 expect(reviewSalary(original)).toEqual({primary:original});
 expect(reviewSalary('大卒基本給21万円').primary).toBe('大卒基本給21万円');
});
it('labels annual conversions as reference amounts without pretending they are monthly wages',()=>{
 const result=reviewSalary('想定年収330〜400万円（月給・基本給の内訳不明）');
 expect(result.primary).toBe('月給不明（参考月額 約27.5〜33.3万円）');
 expect(result.note).toContain('実際の月給・手取りではありません');
 expect(reviewSalary('年俸350万円〜（支払回数不明）').primary).toBe('月給不明（参考月額 約29.2万円〜）');
});
it('never converts model salaries, unknown figures, reversed ranges or non-annual numbers',()=>{
 expect(reviewSalary('モデル年収400万円（月収24万円＋賞与）').primary).toBe('月給不明・未確認');
 expect(reviewSalary('年収500〜300万円').primary).toBe('月給不明・未確認');
 expect(reviewSalary('給与20〜45万円').primary).toBe('月給不明・未確認');
 expect(reviewSalary().primary).toBe('月給不明・未確認');
});

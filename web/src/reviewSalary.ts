// Annual totals can include bonuses: never promote a conversion to actual pay.
export function reviewSalary(text?:string):{primary:string;note?:string}{
 if(!text)return {primary:'月給不明・未確認'};
 if(/(?:月給|月額|基本給)\s*[\d０-９]/.test(text))return {primary:text};
 const annual=text.match(/^(?:想定)?(?:年収|年俸)\s*(\d+(?:\.\d+)?)\s*(?:万円)?\s*(?:[〜～~-]\s*(\d+(?:\.\d+)?)\s*)?万円/);
 if(annual){
  const min=Number(annual[1]),max=annual[2]?Number(annual[2]):null;
  if(min>0&&Number.isFinite(min)&&(max===null||Number.isFinite(max)&&max>=min)){
   const range=max===null?`${(min/12).toFixed(1)}万円${/[〜～~]/.test(text.slice(annual[0].length,annual[0].length+1))?'〜':''}`:`${(min/12).toFixed(1)}〜${(max/12).toFixed(1)}万円`;
   return {primary:`月給不明（参考月額 約${range}）`,note:`${text}。年収・年俸÷12の概算。賞与・手当を含む場合があり、実際の月給・手取りではありません。`};
  }
 }
 return {primary:'月給不明・未確認',note:text};
}

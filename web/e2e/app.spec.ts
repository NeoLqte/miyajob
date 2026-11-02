import {test,expect} from '@playwright/test';
import {dataset} from '../src/test/fixtures';

test('discovery and all-candidate views preserve unknowns, source links and combined filters',async({page,isMobile})=>{
 await page.goto('./');
 const data=await (await page.request.get(new URL('review-jobs.json',page.url()).toString())).json();
 const discovery=data.candidates.filter((j:{status:string})=>j.status==='discovery');
 const verified=await (await page.request.get(new URL('jobs.json',page.url()).toString())).json();
 await page.getByRole('button',{name:`未審査・新規候補 ${discovery.length}件`,exact:true}).click();
 await expect(page.locator('.research-card')).toHaveCount(discovery.length);
 await page.locator('.research-card').first().getByText('応募条件の簡易チェック',{exact:true}).click();
 await expect(page.locator('.research-card').first().locator('.screening li')).toHaveCount(4);
 await expect(page.getByText(/通勤15分帯を最優先/)).toBeVisible();
 await expect(page.locator('.workspace')).toBeHidden();
 expect(await page.locator('.research-card').getByRole('link',{name:/原典を見る/}).count()).toBe(discovery.length);
 expect(await page.locator('.fact-unknown').count()).toBeGreaterThan(0);
 await page.getByLabel('候補の勤務地',{exact:true}).selectOption('浜松市浜名区');
 await page.getByLabel('IT職種',{exact:true}).selectOption('software');
 const expected=discovery.filter((j:{regions:string[];category:string})=>j.regions.includes('浜松市浜名区')&&j.category==='software');
 await expect(page.locator('.research-card')).toHaveCount(expected.length);
 await page.getByLabel('候補の並び順',{exact:true}).selectOption('monthly');
 await page.getByRole('button',{name:'候補の絞り込みをクリア'}).click();
 await page.getByRole('button',{name:`すべての候補 ${data.candidates.length+verified.jobs.length}件`,exact:true}).click();
 await expect(page.locator('.research-card')).toHaveCount(data.candidates.length+verified.jobs.length);
 await page.getByLabel('確認状態',{exact:true}).selectOption('eligible');
 await expect(page.locator('.research-card')).toHaveCount(verified.jobs.length);
 await page.getByLabel('確認状態',{exact:true}).selectOption('discovery');
 await expect(page.locator('.research-card')).toHaveCount(discovery.length);
 await page.locator('.research-content').scrollIntoViewIfNeeded();
 await page.screenshot({path:`../artifacts/discovery-${isMobile?'mobile':'desktop'}.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('real IT review queue is separate, searchable and explains pending reasons',async({page,isMobile})=>{
 await page.goto('./');
 const response=await page.request.get(new URL('review-jobs.json',page.url()).toString());
 const data=await response.json();
 data.candidates=data.candidates.filter((j:{status:string})=>j.status==='review');
 await page.getByRole('button',{name:`保留・確認待ち ${data.candidates.length}件`}).click();
 await expect(page.locator('.workspace')).toBeHidden();
 await expect(page.locator('.research-card')).toHaveCount(data.candidates.length);
 await expect(page.locator('.research-card').first().locator('.review-facts dt')).toHaveCount(6);
 await expect(page.locator('.research-card').first().getByRole('link',{name:/給与の根拠/})).toBeVisible();
 await expect(page.locator('.candidate-warning').first()).toBeVisible();
 await expect(page.locator('.research-card').first().getByRole('heading',{name:'保留理由・残る確認'})).toBeVisible();
 for(const candidate of data.candidates){
  for(const field of ['salary','location','employment','holidays','hours']) expect(candidate.facts.some((f:{field:string;confirmed:boolean})=>f.field===field&&f.confirmed)).toBe(true);
 }
 await page.getByPlaceholder('候補の会社・職種・保留理由').fill('ソフィックス');
 await expect(page.locator('.research-card')).toHaveCount(0);
 await page.getByPlaceholder('候補の会社・職種・保留理由').fill('');
 await page.getByLabel('調査段階',{exact:true}).selectOption('detail_review');
 await expect(page.locator('.research-card')).toHaveCount(data.candidates.filter((j:{stage:string})=>j.stage==='detail_review').length);
 await page.getByPlaceholder('候補の会社・職種・保留理由').fill('アルメニ');
 await expect(page.locator('.research-card')).toHaveCount(0);
 await page.getByPlaceholder('候補の会社・職種・保留理由').fill('');
 await page.getByLabel('調査段階',{exact:true}).selectOption('');
 await page.locator('.research-content').scrollIntoViewIfNeeded();
 await page.screenshot({path:`../artifacts/review-${isMobile?'mobile':'desktop'}.png`,fullPage:false});
 await page.locator('.research-card').first().locator('.review-facts').scrollIntoViewIfNeeded();
 await page.screenshot({path:`../artifacts/review-facts-${isMobile?'mobile':'desktop'}.png`,fullPage:false});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:/応募可能・確認済み/}).click();
 await expect(page.locator('.workspace')).toBeVisible();
 await expect(page.locator('.research-card')).toHaveCount(0);
});

test('old verification warns in list and comparison; expired evidence stays hidden',async({page})=>{
 const data=dataset(2);
 for(const job of data.jobs){job.first_seen_at=job.last_checked_at='2026-01-01';job.commute.checked_at='2026-01-01';job.sources.forEach(s=>s.checked_at='2026-01-01');job.evidence.forEach(e=>e.checked_at='2026-01-01');job.listing_facts?.forEach(f=>f.checked_at='2026-01-01');}
 data.jobs[1].evidence[0].valid_through='2026-01-31';
 await page.route('**/jobs.json',route=>route.fulfill({json:data}));
 await page.goto('./');
 await expect(page.locator('.job-card')).toHaveCount(1);
 await expect(page.locator('.job-card .freshness-warning')).toBeVisible();
 await page.locator('.card-top input').check();
 await page.getByRole('button',{name:/条件を比較する/}).click();
 await expect(page.getByRole('dialog').locator('.freshness-warning')).toBeVisible();
});
test('empty export is honest; theme and filters work',async({page,isMobile})=>{
 await page.route('**/jobs.json',route=>route.fulfill({json:{schema_version:1,updated_at:null,collection_status:'not_collected',jobs:[]}}));
 await page.goto('./');await expect(page.getByRole('heading',{name:'条件に合う求人は現在ありません'})).toBeVisible();
 await expect(page.locator('.data-meta')).toContainText(/初回収集前|実求人を検証中/);
 await page.screenshot({path:`../artifacts/${isMobile?'mobile':'desktop'}.png`,fullPage:true});
 if(isMobile)await page.getByRole('button',{name:/絞り込み/}).click();
 await page.getByPlaceholder('会社名・職種・勤務地').fill('開発');await expect(page).toHaveURL(/q=/);
 await page.getByRole('button',{name:'暗いテーマに切替'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('committed public export loads without errors',async({page,isMobile})=>{
 await page.goto('./');
 await expect(page.locator('.data-meta')).toBeVisible();
 const response=await page.request.get(new URL('jobs.json',page.url()).toString());
 expect(response.ok()).toBe(true);
 const data=await response.json();
 if(data.jobs.length){await expect(page.locator('.job-card')).toHaveCount(data.jobs.length);}
 else {await expect(page.getByRole('heading',{name:'条件に合う求人は現在ありません'})).toBeVisible();}
 await expect(page.getByText('求人データを表示できません',{exact:true})).toHaveCount(0);
 await page.screenshot({path:`../artifacts/public-${isMobile?'mobile':'desktop'}.png`,fullPage:true});
});
test('TEST ONLY routed fixture: filters, comparison, evidence and keyboard',async({page,isMobile})=>{
 // The test intercepts the network; no fixture is written to public/ or dist/.
 await page.route('**/jobs.json',route=>route.fulfill({json:dataset(5)}));
 await page.goto('./');await expect(page.getByRole('button',{name:'TEST ONLY ROLE',exact:true})).toHaveCount(5);
 const checks=page.locator('.card-top input');for(let i=0;i<4;i++)await checks.nth(i).check();await expect(checks.nth(4)).toBeDisabled();
 await page.getByRole('button',{name:/条件を比較する/}).click();await expect(page.getByRole('dialog',{name:'求人を比較する'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 const detail=page.getByRole('button',{name:'詳細を見る'}).first();await detail.focus();await page.keyboard.press('Enter');await expect(page.getByText('応募条件の確認根拠')).toBeVisible();await page.keyboard.press('Escape');await expect(detail).toBeFocused();
 if(isMobile)await page.getByRole('button',{name:/絞り込み/}).click();
 await page.getByLabel('年間休日120日以上',{exact:true}).check();await page.getByLabel('月平均残業20時間以内',{exact:true}).check();await expect(page.getByText('条件に合う求人は現在ありません')).toBeVisible();
 await page.getByLabel('待遇の未記載を含める').check();await expect(page.getByRole('button',{name:'TEST ONLY ROLE',exact:true})).toHaveCount(5);
 await page.getByRole('button',{name:'表表示'}).click();await expect(page.locator('table tbody tr')).toHaveCount(5);
 const url=page.url();await page.reload();await expect(page).toHaveURL(url);await expect(page.getByLabel('年間休日120日以上',{exact:true})).toBeChecked();
});

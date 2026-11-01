import {test,expect} from '@playwright/test';
import {dataset} from '../src/test/fixtures';
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

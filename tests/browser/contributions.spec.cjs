const {test,expect} = require('@playwright/test');
const {serveFixture} = require('../helpers/contribution-fixture.cjs');
let f,url;
test.beforeAll(async()=>{f=await serveFixture(7,{projectCount:5});url=f.url;});
test.afterAll(async()=>{if(f)await f.close();});
for(const theme of ['light','dark']) {
  test(`contribution history, controls and layout in ${theme} theme`,async({page})=>{
    await page.addInitScript(value=>localStorage.setItem('theme',value),theme);
    await page.goto(url+'/projects/');
    await expect(page.locator('.contribution-card')).toHaveCount(3);
    await expect(page.locator('.contribution-card').first()).toContainText('fixture/repo-6');
    await page.getByRole('button',{name:'Apps',exact:true}).click();
    await expect(page.locator('.contribution-card:visible')).toHaveCount(3);
    await page.getByRole('link',{name:'View all contributions'}).click();
    await expect(page.locator('.contribution-card:visible')).toHaveCount(7);
    await page.getByLabel('Category').selectOption('Documentation');
    await expect(page.locator('.contribution-card:visible')).toHaveCount(3);
    await expect(page.locator('[data-contribution-status]')).toHaveText('3 repositories');
    await page.getByLabel('Sort repositories').selectOption('oldest');
    await expect(page.locator('.contribution-card:visible').first()).toContainText('fixture/repo-1');
    await page.getByLabel('Category').selectOption('');
    await page.getByLabel('Sort repositories').selectOption('name');
    await expect(page.locator('.contribution-card').first()).toContainText('fixture/repo-0');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.screenshot({path:test.info().outputPath(`contributions-${theme}.png`),fullPage:true});
    await page.locator('.contribution-card').first().click();
    await expect(page.getByRole('link',{name:'Read the project case study'})).toHaveAttribute('href','/projects/portfolio/');
    await expect(page.getByRole('link',{name:'View pull request #10 on GitHub'})).toHaveAttribute('href','https://github.com/fixture/repo-0/pull/10');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('contribution history remains available without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  await page.goto(url+'/contributions/');
  await expect(page.locator('.contribution-card:visible')).toHaveCount(7);
  await expect(page.locator('[data-contribution-controls]')).toBeHidden();
  await page.locator('.contribution-card').first().click();
  await expect(page.getByRole('link',{name:/View pull request/})).toBeVisible();
  await context.close();
});
test('empty production site exposes no contribution routes or section',async({page,request})=>{
  test.skip(require('../../data/contributions.json').repositories.some(repo=>repo.contributions.length), 'Production dataset now has recorded contributions; zero-data scratch builds remain covered.');
  await page.goto('/projects/');
  await expect(page.getByRole('heading',{name:'Open Source Contributions'})).toHaveCount(0);
  expect((await request.get('/contributions/')).status()).toBe(404);
});

const {test,expect}=require('@playwright/test');
const {serveFixture}=require('../helpers/contribution-fixture.cjs');
let f;
test.beforeAll(async()=>{f=await serveFixture(0,{projectCount:5});});
test.afterAll(async()=>{if(f)await f.close();});

test("search, type filters, date sorting and Reset work in a browser", async ({page}) => {
  await page.goto(f.url+"/projects/");
  const cards = page.locator("[data-project-type]:visible");
  await expect(page.getByRole("combobox",{name:"Sort projects",exact:true})).toHaveValue("updated-newest");
  await expect(cards).toHaveCount(5);
  await expect(page.locator("[data-project-placeholder]")).toBeHidden();
  await page.getByLabel("Search projects",{exact:true}).fill("EXPO");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Babsy");
  await page.getByRole("button",{name:"Websites",exact:true}).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"More projects to come...",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Sort projects",exact:true})).toHaveValue("updated-newest");
  await page.getByRole("combobox",{name:"Sort projects",exact:true}).selectOption("started-oldest");
  await expect(cards.first()).toContainText("Babsy");
  await page.getByRole("combobox",{name:"Sort projects",exact:true}).selectOption("updated-newest");
  await expect(cards.first()).toContainText("Building this portfolio");
  await page.getByRole("combobox",{name:"Sort projects",exact:true}).selectOption("finished-newest");
  await expect(cards).toHaveCount(1);
  await expect(page.locator("[data-project-placeholder]")).toBeHidden();
  await expect(cards.first()).toContainText("Building this portfolio");
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await expect(page.getByRole("combobox",{name:"Sort projects",exact:true})).toHaveValue("updated-newest");
  await expect(cards).toHaveCount(5);
  await expect(page.locator("[data-project-placeholder]")).toBeHidden();
  await expect(cards.first()).toContainText("Building this portfolio");
});


test('all five project cards stay available without JavaScript',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();await page.goto(f.url+'/projects/');
    await expect(page.locator('[data-project-type]:visible')).toHaveCount(5);
    await expect(page.locator('[data-project-search-sort]')).toBeHidden();
    await expect(page.locator('[data-project-type]').first()).toContainText('Building this portfolio');
  } finally {await context.close();}
});

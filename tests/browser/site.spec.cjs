const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const pages = ["/", "/about/", "/projects/", "/projects/portfolio/", "/projects/babsy/"];

for (const route of pages) {
  test(`${route} fits the screen in light and dark themes`, async ({page}, testInfo) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ["dark", "light"]) {
      const html = page.locator("html");
      if (await html.getAttribute("data-theme") !== theme) await page.getByRole("button",{name:/Switch to .* mode/}).click();
      await expect(html).toHaveAttribute("data-theme", theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole("heading",{level:1})).toBeVisible();
      await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
      const file = testInfo.outputPath(`${theme}.png`);
      await page.screenshot({path:file,fullPage:true,animations:"disabled"});
      await testInfo.attach(`${theme} layout`,{path:file,contentType:"image/png"});
    }
    expect(errors).toEqual([]);
  });
}

test("About buttons stack on phones and align in a row on wider screens", async ({page}) => {
  await page.goto("/about/");
  const buttons = page.locator(".about-actions .button");
  await expect(buttons).toHaveCount(3);
  const boxes = await Promise.all((await buttons.all()).map(button => button.boundingBox()));
  const width = page.viewportSize().width;
  for (const box of boxes) {expect(box).not.toBeNull();expect(box.height).toBeGreaterThanOrEqual(44);}
  if (width <= 640) {
    for (let i=1;i<boxes.length;i++) {
      expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i-1].y + boxes[i-1].height);
      expect(Math.abs(boxes[i].x-boxes[0].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(boxes[i].width-boxes[0].width)).toBeLessThanOrEqual(1);
    }
  } else {
    for (const box of boxes) expect(Math.abs(box.y-boxes[0].y)).toBeLessThanOrEqual(1);
  }
});

test("CV downloads with the requested filename and exact PDF content", async ({page}) => {
  await page.goto("/about/");
  const event = page.waitForEvent("download");
  await page.getByRole("link",{name:"Download my CV",exact:true}).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("CORREIA, Vanessa_CV.pdf");
  expect(await download.failure()).toBeNull();
  const downloaded = await fs.readFile(await download.path());
  expect(downloaded.subarray(0,5).toString()).toBe("%PDF-");
  expect(downloaded.equals(await fs.readFile(path.resolve(__dirname,"../../static/downloads/vanessa-correia-cv.pdf")))).toBe(true);
  expect(new URL(page.url()).pathname).toBe("/about/");
});

test("About and footer external links open separate tabs", async ({page,context}) => {
  // Verify popup behaviour without contacting external sites or relying on their availability.
  await context.route(/^https:\/\/(?:github\.com|www\.linkedin\.com|gohugo\.io)\//, route => route.fulfill({contentType:"text/html",body:"<title>External link test</title>"}));
  await page.goto("/about/");
  const links = [
    page.getByRole("link",{name:"Connect on LinkedIn",exact:true}),
    page.getByRole("link",{name:"Explore my GitHub",exact:true}),
    ...await page.locator(".site-footer a").all(),
  ];
  expect(links.length).toBe(4);
  for (const link of links) {
    await expect(link).toHaveAttribute("target","_blank");
    await expect(link).toHaveAttribute("rel",/noopener/);
    const url = await link.getAttribute("href");
    const popupEvent = page.waitForEvent("popup");
    await link.click();
    const popup = await popupEvent;
    await expect(popup).toHaveURL(url);
    expect(new URL(page.url()).pathname).toBe("/about/");
    await popup.close();
  }
});

test("search, type filters, finish-date empty state and Reset work in a browser", async ({page}) => {
  await page.goto("/projects/");
  const cards = page.locator("[data-project-type]:visible");
  await expect(cards).toHaveCount(2);
  await page.getByLabel("Search projects",{exact:true}).fill("EXPO");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Babsy");
  await page.getByRole("button",{name:"Websites",exact:true}).click();
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"More projects to come...",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await page.getByRole("combobox",{name:"Sort projects",exact:true}).selectOption("started-oldest");
  await expect(cards.first()).toContainText("Babsy");
  await page.getByRole("combobox",{name:"Sort projects",exact:true}).selectOption("finished-newest");
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"More projects to come...",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Reset",exact:true}).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Building this portfolio");
});

test("keyboard skip link moves focus into the content", async ({page}) => {
  await page.goto("/about/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link",{name:"Skip to main content",exact:true});
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

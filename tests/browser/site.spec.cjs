const { test, expect } = require("@playwright/test");
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


test("first visit defaults to dark and remembers a chosen light theme", async ({page}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", {name:"Switch to light mode"}).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/projects/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("About buttons stack on phones and align in a row on wider screens", async ({page}) => {
  await page.goto("/about/");
  const buttons = page.locator(".about-actions .button");
  await expect(buttons).toHaveCount(2);
  await expect(buttons).toHaveText(["Explore my GitHub", "Connect on LinkedIn"]);
  await expect(buttons.first()).not.toHaveClass(/button-secondary/);
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

test("contact form validates fields, protects contact details and submits to the configured endpoint", async ({page,request}, testInfo) => {
  await page.goto("/about/");
  await expect(page.getByRole("link",{name:"Download my CV",exact:true})).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  expect((await request.get("/downloads/vanessa-correia-cv.pdf")).status()).toBe(404);
  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading",{name:"Get in touch",exact:true})).toBeInViewport();
  const form = page.locator(".contact-form");
  await expect(form).toHaveAttribute("data-contact-mode", "inline");
  const endpoint = await form.getAttribute("action");
  expect(endpoint).toMatch(/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/);
  let sent;
  let release;
  const responseGate = new Promise(resolve => { release = resolve; });
  await page.route(endpoint, async route => {
    sent = new URLSearchParams(route.request().postData());
    await responseGate;
    return route.fulfill({contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  const submit = page.getByRole("button",{name:"Send",exact:true});
  await expect(submit).toBeEnabled();
  await submit.click();
  expect(sent).toBeUndefined();
  await page.getByLabel("Name",{exact:true}).fill("Browser test");
  await page.getByLabel("Email",{exact:true}).fill("invalid");
  await page.getByLabel("Message",{exact:true}).fill("A browser test message with no external delivery.");
  await submit.click();
  expect(sent).toBeUndefined();
  await page.getByLabel("Email",{exact:true}).fill("test@example.com");
  await submit.click();
  await expect(page.getByRole("button",{name:"Sending…",exact:true})).toBeDisabled();
  if (process.env.PORTFOLIO_RECORD_CONTACT) await page.waitForTimeout(700);
  release();
  await expect(page.locator("#contact-feedback")).toContainText("Thanks—your message has been submitted.");
  await expect(page.locator("#contact-feedback")).toContainText("Message submitted");
  await expect(page.locator("#contact-feedback")).toBeFocused();
  await expect(page.locator("#contact-feedback")).toBeInViewport();
  await expect(page.getByLabel("Message",{exact:true})).toHaveValue("");
  expect(new URL(page.url()).pathname).toBe("/about/");
  expect(sent.get("name")).toBe("Browser test");
  expect(sent.get("email")).toBe("test@example.com");
  expect(sent.get("message")).toContain("no external delivery");
  await page.locator("#contact-feedback").evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  if (process.env.PORTFOLIO_RECORD_CONTACT) await page.waitForTimeout(1800);
  const screenshot = testInfo.outputPath("inline-confirmation.png");
  await page.screenshot({path:screenshot,fullPage:true,animations:"disabled"});
  await testInfo.attach("Inline confirmation (intercepted submission)",{path:screenshot,contentType:"image/png"});
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

test("small project collection shows latest updates without lookup controls", async ({page}) => {
  await page.goto("/projects/");
  const cards = page.locator("[data-project-type]:visible");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Building this portfolio");
  await expect(page.locator("#project-search, #project-sort, [data-project-filters], [data-project-filter-status]")).toHaveCount(0);
  await expect(page.locator('script[src*="project-filters.js"]')).toHaveCount(0);
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

test("contact submission failures preserve fields and allow retry without leaving About", async ({page}) => {
  await page.goto("/about/");
  const endpoint = await page.locator(".contact-form").getAttribute("action");
  let attempt = 0;
  await page.route(endpoint, route => {
    attempt += 1;
    if (attempt === 1) return route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({errors:[{message:"Test failure"}]})});
    if (attempt === 2) return route.abort("failed");
    return route.fulfill({contentType:"application/json",body:JSON.stringify({ok:true})});
  });
  await page.getByLabel("Name",{exact:true}).fill("Browser test");
  await page.getByLabel("Email",{exact:true}).fill("test@example.com");
  const message = "Retain this message when delivery cannot be confirmed.";
  await page.getByLabel("Message",{exact:true}).fill(message);
  for (let failure=0;failure<2;failure++) {
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await expect(page.locator("#contact-feedback")).toHaveAttribute("data-state","error");
    await expect(page.getByRole("button",{name:"Send",exact:true})).toBeEnabled();
    await expect(page.getByLabel("Message",{exact:true})).toHaveValue(message);
    await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Browser test");
    await expect(page.getByLabel("Email",{exact:true})).toHaveValue("test@example.com");
    expect(new URL(page.url()).pathname).toBe("/about/");
  }
  await page.getByRole("button",{name:"Send",exact:true}).click();
  await expect(page.locator("#contact-feedback")).toHaveAttribute("data-state","success");
  expect(attempt).toBe(3);
});

test.describe("native contact form fallback", () => {
  test.use({javaScriptEnabled:false});
  test("form still submits without JavaScript", async ({page}) => {
    await page.goto("/about/");
    const endpoint = await page.locator(".contact-form").getAttribute("action");
    await page.route(endpoint, route => route.fulfill({contentType:"text/html",body:"<h1>Native form submitted</h1>"}));
    await page.getByLabel("Name",{exact:true}).fill("Browser test");
    await page.getByLabel("Email",{exact:true}).fill("test@example.com");
    await page.getByLabel("Message",{exact:true}).fill("Native fallback test; no external delivery.");
    await page.getByRole("button",{name:"Send",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Native form submitted",exact:true})).toBeVisible();
  });
});

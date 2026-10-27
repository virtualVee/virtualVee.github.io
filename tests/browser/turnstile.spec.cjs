const {test, expect} = require("@playwright/test");

test("Turnstile gates submission, expires tokens and refreshes after failure and success", async ({page}) => {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", route => route.fulfill({contentType:"text/javascript",body:`
    window.turnstile = {
      render: (element, options) => { window.challenge = options; window.resets = 0; return 'widget'; },
      reset: () => { window.resets++; }
    };
  `}));
  await page.goto("/about/");
  await expect.poll(() => page.evaluate(() => !!window.challenge)).toBe(true);
  let posts = 0;
  let token;
  await page.route(await page.locator(".contact-form").getAttribute("action"), route => {
    posts++;
    token = new URLSearchParams(route.request().postData()).get("cf-turnstile-response");
    return route.fulfill({status:posts === 1 ? 500 : 200,contentType:"application/json",body:JSON.stringify({ok:posts > 1})});
  });
  await page.getByLabel("Name",{exact:true}).fill("Visitor");
  await page.getByLabel("Email",{exact:true}).fill("visitor@gmail.com");
  await page.getByLabel("Message",{exact:true}).fill("A question about your portfolio.");
  const send = page.getByRole("button",{name:"Send",exact:true});
  await send.click();
  await expect(page.locator("#contact-feedback")).toContainText("Security check needed");
  expect(posts).toBe(0);
  await page.evaluate(() => { window.challenge.callback('expired'); window.challenge['expired-callback'](); });
  await send.click();
  expect(posts).toBe(0);
  await page.evaluate(() => window.challenge.callback('first-token'));
  await send.click();
  await expect.poll(() => page.evaluate(() => window.resets)).toBe(1);
  expect(token).toBe('first-token');
  await expect(page.getByLabel("Message",{exact:true})).toHaveValue("A question about your portfolio.");
  await send.click();
  expect(posts).toBe(1);
  await page.evaluate(() => window.challenge.callback('fresh-token'));
  await send.click();
  await expect(page.locator("#contact-feedback")).toHaveAttribute("data-state","success");
  expect(token).toBe('fresh-token');
  expect(posts).toBe(2);
  await expect.poll(() => page.evaluate(() => window.resets)).toBe(2);
});

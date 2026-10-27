const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.cjs",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PORTFOLIO_PREVIEW_URL || "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
    video: process.env.PORTFOLIO_RECORD_CONTACT ? "on" : "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "phone", use: { viewport: {width:390,height:844}, isMobile:true, hasTouch:true } },
    { name: "tablet", use: { viewport: {width:768,height:1024}, hasTouch:true } },
    { name: "desktop", use: { viewport: {width:1440,height:1000} } },
  ],
  webServer: process.env.PORTFOLIO_PREVIEW_URL ? undefined : {
    command: "node scripts/serve-test-site.cjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

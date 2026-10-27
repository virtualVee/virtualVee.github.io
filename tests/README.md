# Portfolio checks

Requirements: Hugo 0.167.0 extended (matching deployment) and Node.js 22 or newer. No Python runtime or additional HTML-parsing package is needed.

## Setup and commands

Run `npm ci` and `npx playwright install chromium` once, then `npm test` from the repository root. On Linux use `npx playwright install --with-deps chromium` to install browser system dependencies too.

- `npm run test:projects`: 12 Node tests cover the project-controls script and Hugo archetype. Synthetic fixtures exercise search normalization, combined filters, start/finish ordering, missing dates, empty states and Reset.
- `npm run test:site`: runs the dedicated Playwright site-checks project once, rather than repeating it at each device size. It builds production HTML in scratch storage, uses the browser’s parser with JavaScript disabled, and uses Node file APIs to check internal targets/assets and draft exclusion. It preserves language, heading, metadata, canonical, duplicate-ID, privacy and project-control checks. A negative fixture verifies broken links/fragments, duplicate IDs and exposed contact details fail. Scratch files are removed automatically; page resource requests are blocked.
- `npm run test:browser`: runs the two generated-site checks plus 12 interaction/layout scenarios at three viewport sizes: phone 390×844, tablet 768×1024, desktop 1440×1000. Uses its own production build and temporary server on 127.0.0.1:4173; it does not reuse the personal preview on port 1313.
- `npm run test:quick`: runs only the Node logic/archetype tests without starting a browser. Generated-page checks now require Chromium.
- `npx playwright show-report`: opens the latest browser report, including light/dark screenshots and failure traces. Reports live in ignored `playwright-report/` and `test-results/` directories.

## Browser scenarios

- Each of Home, About, Projects and both project details loads without JavaScript errors, fits the viewport, and exposes the main heading/navigation in light and dark themes. Full-page screenshots are attached for review, with CSS animations finished for consistent capture.
- GitHub and LinkedIn About buttons stack at phone width and align in a row on wider screens, with at least 44px button heights.
- The CV download, public PDF asset and direct mailto link are absent. Required fields and invalid-email validation prevent submission; a valid submission posts to the configured Formspree endpoint and shows an in-page confirmation without navigation. Sending disables the form; server/network failures preserve values for retry, and the native form remains usable without JavaScript. Automated browser tests intercept the request and never deliver email.
- LinkedIn/GitHub About links and both footer links produce separate tabs and have safe new-tab attributes. External destinations are intercepted inside the tests: these checks verify browser behaviour, not third-party uptime.
- Search, type filters, start-date sorting, finish-date empty view and Reset work together through real browser input.
- Keyboard skip link receives focus and moves it into main content.

## CI and limits

GitHub Actions installs locked npm dependencies and Chromium, then runs `npm test` before building/uploading the deployable artifact. A failing check stops deployment. Browser reports and screenshots are uploaded for seven days, including on test failure. CI execution itself is verified after pushing, not by a local pass.

These are Chromium viewport simulations, not physical-device or Safari/Firefox certification. Layout checks catch overflow and button geometry; screenshots are review artifacts, not pixel-baseline comparisons. They do not certify contrast, complete accessibility or screen-reader behaviour. Keep manual phone and keyboard reviews.

## Updating project dates

Use `development_date` for the recorded start milestone, `finished_date` only when complete, and `updated_date` for the latest substantive project progress (YYYY-MM-DD). “Last updated” sorts by `updated_date` descending, leaving projects with no recorded update last. Start and finish sorts remain independent. Changing a portfolio summary alone need not imply a new development milestone in the underlying project.

Project-content conventions and the new-project command are documented in `docs/project-content.md`. The generated-site audit requires status/start/update metadata on published cards; the archetype test verifies future drafts include optional release fields without inventing a completion date.

To diagnose the actual running preview instead of the scratch build, set `PORTFOLIO_PREVIEW_URL` to its local origin when running browser tests. For example: `PORTFOLIO_PREVIEW_URL=http://192.168.1.204:1313 npm run test:browser -- --grep "contact form validates"`. The contact request is still intercepted; no real messages are sent. This test also asserts that the inline handler started and records a success-state screenshot.

To record the contact interaction for review: `PORTFOLIO_RECORD_CONTACT=1 npm run test:browser -- --grep "contact form validates" --project phone --project desktop`. The recording run holds the mocked response briefly and pauses on the success panel; no live email is sent. Videos are saved in test-results/ and attached to the browser report.

## Why these tools

Node’s built-in runner keeps logic tests lightweight. Playwright covers real browser behaviour and also supplies the HTML parser for generated-page checks. The original Python checker was migrated to reuse this existing tooling and maintain one language without an extra parsing package. The tradeoff is that page checks need a browser. All former audit rules are retained; the old standalone Python command has been removed.

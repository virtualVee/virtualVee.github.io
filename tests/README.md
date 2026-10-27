# Portfolio checks

Requirements: Hugo 0.167.0 extended (matching deployment), Node.js 22 or newer, and Python 3.9 or newer.

## Setup and commands

Run `npm ci` and `npx playwright install chromium` once, then `npm test` from the repository root. On Linux use `npx playwright install --with-deps chromium` to install browser system dependencies too.

- `npm run test:projects`: 12 Node tests run the shipped project-controls script against synthetic projects using a minimal DOM adapter. Covers search normalization, combined filters, start/finish ordering, missing dates, empty states and Reset.
- `npm run test:site`: builds production output in scratch storage and checks links/assets/fragments, key metadata, drafts, contact privacy and accessible controls. Scratch files are removed automatically.
- `npm run test:browser`: Playwright runs 10 scenarios at three viewport sizes: phone 390×844, tablet 768×1024, desktop 1440×1000. Uses its own production build and temporary server on 127.0.0.1:4173; it does not reuse the personal preview on port 1313.
- `npm run test:quick`: runs logic and generated-site checks without starting a browser.
- `python3 scripts/check-site.py --site public`: checks an existing production build.
- `npx playwright show-report`: opens the latest browser report, including light/dark screenshots and failure traces. Reports live in ignored `playwright-report/` and `test-results/` directories.

## Browser scenarios

- Each of Home, About, Projects and both project details loads without JavaScript errors, fits the viewport, and exposes the main heading/navigation in light and dark themes. Full-page screenshots are attached for review, with CSS animations finished for consistent capture.
- GitHub and LinkedIn About buttons stack at phone width and align in a row on wider screens, with at least 44px button heights.
- The CV download, public PDF asset and direct mailto link are absent. Required fields and invalid-email validation prevent submission; a valid submission posts to the configured Formspree endpoint. Automated browser tests intercept the request and never deliver email.
- LinkedIn/GitHub About links and both footer links produce separate tabs and have safe new-tab attributes. External destinations are intercepted inside the tests: these checks verify browser behaviour, not third-party uptime.
- Search, type filters, start-date sorting, finish-date empty view and Reset work together through real browser input.
- Keyboard skip link receives focus and moves it into main content.

## CI and limits

GitHub Actions installs locked npm dependencies and Chromium, then runs `npm test` before building/uploading the deployable artifact. A failing check stops deployment. Browser reports and screenshots are uploaded for seven days, including on test failure. CI execution itself is verified after pushing, not by a local pass.

These are Chromium viewport simulations, not physical-device or Safari/Firefox certification. Layout checks catch overflow and button geometry; screenshots are review artifacts, not pixel-baseline comparisons. They do not certify contrast, complete accessibility or screen-reader behaviour. Keep manual phone and keyboard reviews.

## Updating project dates

Use `development_date` for the recorded start milestone, `finished_date` only when complete, and `updated_date` for the latest substantive project progress (YYYY-MM-DD). “Last updated” sorts by `updated_date` descending, leaving projects with no recorded update last. Start and finish sorts remain independent. Changing a portfolio summary alone need not imply a new development milestone in the underlying project.

Project-content conventions and the new-project command are documented in `docs/project-content.md`. The generated-site audit requires status/start/update metadata on published cards; the archetype test verifies future drafts include optional release fields without inventing a completion date.

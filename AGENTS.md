# Working in this repository

Records Request Helper is a static web app that helps veterans and families request military
personnel records from the National Archives (NARA). It runs entirely in the browser; nothing a
visitor types leaves their device.

## Layout

- `src/rules.js`: the decision logic (who may request, what it costs, 1973 fire risk, cover letter). Pure functions, no DOM.
- `config/facts.json`: every fact the rules depend on, the archives.gov pages they come from, and the exact phrases the drift check expects on those pages.
- `config/flags.json`: feature flags read by the UI at runtime.
- `config/sci.json`: carbon accounting constants for the pipeline (see `skills/carbon-budget`).
- `public/`: HTML, CSS and UI script.
- `scripts/ci/`: one small Node script per pipeline gate.
- `test/`: Node's built-in test runner.

## Rules for every change

1. Run `npm test` and `npm run check` before you commit. Both must pass.
2. Every commit message ends with a `Signed-off-by:` line (Developer Certificate of Origin 1.1).
3. Every merge request description contains `Closes #<issue>` for the issue it resolves.
4. No new runtime dependencies. The site must stay a static, zero-dependency bundle.
5. Never add analytics, cookies, external fonts or any request that sends visitor input off the device.
6. A change to a fact in `config/facts.json` must set `lastChecked` to today's date, bump `version`
   (format `YYYY.MM.DD`) and update the matching `sources[].mustContain` phrase. Use only archives.gov pages as sources.
7. Keep the reading level plain. The audience includes elderly next of kin.
8. Do not touch `.gitlab-ci.yml` or `.gitlab/duo/` unless the issue asks for it.

## Commands

- `npm test`: unit tests.
- `npm run check`: lint, accessibility, config and policy checks.
- `npm run build`: assemble `dist/`.

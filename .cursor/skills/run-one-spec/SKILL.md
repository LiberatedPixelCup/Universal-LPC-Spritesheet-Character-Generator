---
name: run-one-spec
description: >-
  Run a single Node, browser, or Playwright spec instead of the full suite.
  Use when debugging one test, iterating on a failing spec, or the user asks
  to run one file, one test, or a filtered suite. Do not start with npm test.
---

# Run one spec

Pick the suite the file belongs to. Do not start with `npm test`.

Isolation is below. Coverage is a **separate** full-suite run — see
[write-spec](../write-spec/SKILL.md#confirm-the-new-lines-are-hit) after a
gated `sources/` or `scripts/` edit (skip if the path is in
[`codecov.yml`](../../../codecov.yml) `ignore:`).

## Node (`tests/node/`)

`npm run test:node` collects every `*_spec.js` / `*_spec.ts` and ignores extra
args. Call `node --test` on the file instead:

```bash
node --test tests/node/scripts/generateSources/items_spec.ts
node --test --test-name-pattern="parseItem" tests/node/scripts/generateSources/items_spec.ts
```

`npm run test:node:coverage` also runs every Node spec, not this file alone.

## Browser (Testem + Mocha)

[`tests/tests.js`](../../../tests/tests.js) imports every browser spec. There is
no CLI file filter. Do not comment out imports. A spec that is not imported
never runs; Codecov patch then fails with no Mocha failure.

**Filter with `?grep=` (best isolation).** Start the server, then open the
harness with a grep pattern:

```bash
npm run test:server
# then open, in the launched browser:
# http://localhost:7357/tests_run.html?debug=false&grep=CategoryTree
```

Mocha's browser bundle reads `grep`, `fgrep`, and `invert` from
`location.search` inside `mocha.run()`, which
[`tests/tests.js`](../../../tests/tests.js) calls. Every spec file is still
imported, so the filter selects which tests execute, not which files load.
The Mocha UI search box does the same thing by rewriting this query string.

If 7357 is busy, `testem.cjs` reads `TESTEM_PORT`:

```bash
TESTEM_PORT=7360 npm run test:server
```

`it.only` / `describe.only` works locally as a fallback. Do not commit it.

`testem.cjs` `before_tests` always runs every Node spec first, including this
Chrome-only command. It is still the full Mocha browser suite, not one file:

```bash
node ./node_modules/testem/testem.js ci --launch Chrome
```

`npm run test:browser:coverage` is that full suite in Chrome and Firefox.

`DEBUG=1` (or `DEBUG=true`) keeps the app's verbose debug output instead of the
default `?debug=false`.

## Visual (Playwright)

`npm run test:visual` uses Playwright’s `webServer` (`npm run dev` locally).
`npx playwright test` with this repo’s config does the same.

```bash
npx playwright test tests/visual/home.spec.js
npx playwright test -g "title substring"
```

Wait for catalog/canvas via [`tests/visual/home-helpers.ts`](../../../tests/visual/home-helpers.ts).
Do not register visual specs in `tests/tests.js`. They are not
Codecov-instrumented. Argos upload needs `ARGOS_TOKEN`.

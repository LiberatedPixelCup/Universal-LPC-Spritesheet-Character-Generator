---
name: run-one-spec
description: >-
  Run a single Node, browser, or Playwright spec instead of the full suite.
  Use when debugging one test, iterating on a failing spec, or the user asks
  to run one file, one test, or a filtered suite. Do not start with npm test.
---

# Run one spec

Pick the suite the file belongs to. Do not start with `npm test`. After a
`sources/` or `scripts/` edit, also run the matching coverage command
(`npm run test:browser:coverage` or `npm run test:node:coverage`).

## Node (`tests/node/`)

`npm run test:node` collects every `*_spec.js` / `*_spec.ts` and ignores extra
args. Call `node --test` on the file instead:

```bash
node --test tests/node/scripts/generateSources/items_spec.ts
node --test --test-name-pattern="parseItem" tests/node/scripts/generateSources/items_spec.ts
```

## Browser (Testem + Mocha)

[`tests/tests.js`](../../../tests/tests.js) imports every browser spec. There is
no CLI file filter. Do not comment out imports. A spec that is not imported
never runs; Codecov patch then fails with no Mocha failure.

URL `?grep=` does not work: [`tests_run.html`](../../../tests_run.html) (repo
root) calls `mocha.setup("bdd")` with no grep.

Supported isolation: `npm run test:server` and search in the Mocha UI.

Local `it.only` / `describe.only` is the practical hammer. Do not commit it.

Narrowest CI-style run: one browser, still the full Mocha suite:

```bash
node ./node_modules/testem/testem.js ci --launch Chrome
```

## Visual (Playwright)

```bash
npx playwright test tests/visual/home.spec.js
npx playwright test -g "title substring"
```

---
name: write-spec
description: >-
  Write a browser Mocha or Node unit spec for this repo. Use when adding a
  test, covering new production lines, or the user asks for a spec. New specs
  are TypeScript. Register browser specs in tests/tests.js.
---

# Write a spec

New specs are TypeScript (`*_spec.ts`). Do not add a new `.js` spec.

## Browser (Testem + Mocha + Chai)

- Import `describe` / `it` / hooks from `"mocha-globals"` (Vite alias to
  [`tests/bdd-globals.js`](../../../tests/bdd-globals.js)) and `assert` or
  `expect` from `"chai"`. Render with global `m`.
- Use `createCatalog()` and
  [`tests/browser-catalog-fixture.js`](../../../tests/browser-catalog-fixture.js)
  (`seedCatalog` / `seedCatalogWithGeneratedContext`). Do not depend on the
  production catalog singleton.
- `beforeEach` / `afterEach` should create and remove DOM hosts.
- Import the new file from [`tests/tests.js`](../../../tests/tests.js). If you
  skip this, Mocha never runs the spec and Codecov patch fails with no test
  failure.

Example and more patterns: [CONTRIBUTING.md](../../../CONTRIBUTING.md)
(Unit and component specs).

## Node

Put the file under `tests/node/`. Import the `.ts` implementation. The runner
collects `*_spec.js` and `*_spec.ts` automatically — no registry file.

How to run one file: [run-one-spec](../run-one-spec/SKILL.md).

## Confirm the new lines are hit

`sources/` → `npm run test:browser:coverage`, then
`coverage/browser/index.html` (or the terminal report).

`scripts/` → `npm run test:node:coverage`, then `coverage/node/index.html`.

Exceptions and PR gates: [CONTRIBUTING.md](../../../CONTRIBUTING.md#unit-test-coverage).

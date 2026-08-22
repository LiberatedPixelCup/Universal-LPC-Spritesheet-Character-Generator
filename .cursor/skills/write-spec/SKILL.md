---
name: write-spec
description: >-
  Write a browser Mocha, Node, or Playwright visual spec for this repo. Use
  when adding a test, covering new production lines, or the user asks for a
  spec. New specs are TypeScript. Register browser specs in tests/tests.js.
---

# Write a spec

New specs are TypeScript (`*_spec.ts`). Do not add a new `.js` spec.

## Browser (Testem + Mocha + Chai)

- Import `describe` / `it` / hooks from `"mocha-globals"` (Vite alias to
  [`tests/bdd-globals.js`](../../../tests/bdd-globals.js)) and `assert` or
  `expect` from `"chai"`. Render with global `m`.
- Thread `catalog: CatalogReader`. Use `createCatalog()` and
  [`tests/browser-catalog-fixture.js`](../../../tests/browser-catalog-fixture.js)
  (`seedCatalog` / `seedCatalogWithGeneratedContext`). Do not depend on the
  production catalog singleton. See [catalog](../catalog/SKILL.md).
- `seedCatalogWithGeneratedContext` pulls in generated metadata, so run
  `npm run dev` or `npm run build` first or it resolves nothing.
- `beforeEach` / `afterEach` should create and remove DOM hosts.
- Import the new file from [`tests/tests.js`](../../../tests/tests.js). If you
  skip this, Mocha never runs the spec and Codecov patch fails with no test
  failure. A `.ts` spec is registered with its real extension
  (`import "./foo_spec.ts";`) — see
  [typescript](../typescript/SKILL.md#the-first-ts-browser-spec).

New `.ts` specs are type-checked: `tests` is in `tsconfig.json` `include` under
`@tsconfig/strictest`, so run `npm run type-check` as well.

Example: [Unit and component specs](../../../CONTRIBUTING.md#unit-and-component-specs).

## Node

Put the file under `tests/node/`. Import the implementation (`.ts`, or leftover
`.js`). The runner collects `*_spec.js` and `*_spec.ts` automatically — no
registry file.

How to run one file: [run-one-spec](../run-one-spec/SKILL.md).

## Visual (Playwright)

Add cases under [`tests/visual/`](../../../tests/visual/). Reuse waits in
[`home-helpers.ts`](../../../tests/visual/home-helpers.ts). Do not import the
file from `tests/tests.js`. Visual tests are not Codecov-instrumented; Argos
needs `ARGOS_TOKEN`. How to run one: [run-one-spec](../run-one-spec/SKILL.md).

## Confirm the new lines are hit

This is a full-suite run, not isolation. Skip if the path is in
[`codecov.yml`](../../../codecov.yml) `ignore:`.

`sources/` → `npm run test:browser:coverage`, then
`coverage/browser/index.html` (or the terminal report).

`scripts/` → `npm run test:node:coverage`, then `coverage/node/index.html`.

Which command, what the gates mean, and why comment-only diffs still pass:
[coverage](../coverage/SKILL.md). PR gates:
[CONTRIBUTING.md](../../../CONTRIBUTING.md#unit-test-coverage).

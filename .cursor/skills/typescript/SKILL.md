---
name: typescript
description: >-
  Write TypeScript that satisfies this repo's lint and tsconfig rules, and
  convert an existing .js file to .ts without breaking its call sites. Use when
  adding or editing a .ts file, converting a .js file, adding the first .ts
  browser spec, or hitting a type-check or ESLint failure.
---

# TypeScript in this repo

New code is `.ts`, including tests, scripts, and Vite plugins. Do not add new
`.js`. [`testem.cjs`](../../../testem.cjs) is the only CommonJS file.

`npm run type-check` (`tsc --noEmit`) and `npm run lint` both gate PRs via the
Lint workflow. Run `npm run type-check` and `npm run lint:fix` after any edit
under `sources/`, `scripts/`, `vite/`, or `tests/` — all four are in
`tsconfig.json` `include`.

## Erasable syntax only

Node runs first-party `.ts` by type-stripping it, with no `tsx` and no compile
step. `erasableSyntaxOnly` is on, so **no enums, no namespaces, no parameter
properties**. Anything that would need to emit runtime code is a type error.

Relative imports use the extension of the file **on disk**, so a `.ts` file
importing a still-`.js` module writes `.js`:

```typescript
import { markNonExecutableLinesInLcov } from "./mark-non-executable-lines.js";
```

`allowImportingTsExtensions` is on, so importing `./foo.ts` is correct once the
target is converted. Getting this backwards is the most common failure when
converting a file — every importer has to move with it.

## tsconfig deliberately relaxes three strictest flags

[`tsconfig.json`](../../../tsconfig.json) extends `@tsconfig/strictest` and then
turns off `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
`noPropertyAccessFromIndexSignature`, each with a comment explaining why. Do not
re-enable them as a drive-by; pixel-index loops and metadata config bags depend
on them being off.

## Lint rules that bite

- **Unused bindings** that must exist need a `_` prefix. `argsIgnorePattern`,
  `varsIgnorePattern`, and `caughtErrorsIgnorePattern` are all `^_`.
- **`console.*` is an error except `console.error`.** Use `console.error`, or
  `debugLog` / `debugWarn` / `debugGroup` / `debugGroupEnd` / `debugTable` from
  [`sources/utils/debug.ts`](../../../sources/utils/debug.ts), which are gated
  on localhost or `?debug=`.
- [`eslint.config.js`](../../../eslint.config.js) applies
  `typescript-eslint`'s recommended preset to `**/*.ts` only, and layers
  per-directory blocks for `sources/`, `scripts/` + `vite/`, `tests/`,
  `tests/node/`, and `tests/visual/`. A converted file moves from the `.js`
  block to the `.ts` block and can pick up rules it was never subject to, so
  lint the file after renaming, not before.

## Converting a `.js` file

Only two non-test `.js` files are left: `scripts/coverage/mark-non-executable-lines.js`
and `vite/vite-plugin-coverage-collect.js`. The rest are under `tests/`.

Before renaming anything, grep for the filename. Several of the remaining files
are named by **hardcoded string path** from places that no rename tool will
follow, and breaking one of those fails a command rather than the type-check:

- `scripts/coverage/mark-non-executable-lines.js` — named in
  [`package.json`](../../../package.json) `test:node:coverage`, and imported by
  [`merge-browser-coverage.ts`](../../../scripts/coverage/merge-browser-coverage.ts).
- `tests/node/run-node-tests.js` — named in
  [`testem.cjs`](../../../testem.cjs) `before_tests`.
- `tests/tests.js` — named in [`tests_run.html`](../../../tests_run.html).
- `tests/bdd-globals.js` — the `mocha-globals` alias target in
  [`vite.config.ts`](../../../vite.config.ts), in two HTML import maps
  (`scripts/zip/zip-export-profile-runner.html`,
  `tests/fixtures/issue-382/issue382-golden-runner.html`), and asserted by path
  in `tests/node/scripts/generateSources/vite_config_factory_and_resolve_spec.ts`.
- `vite/vite-plugin-coverage-collect.js` — imported by
  [`vite.config.ts`](../../../vite.config.ts).

Checklist for a conversion:

1. `git mv` the file, then update every importer to the new extension.
2. Update hardcoded paths in `package.json`, `testem.cjs`, HTML files, and any
   spec that asserts on the path.
3. `npm run type-check` — the file is newly checked, so expect real errors.
4. `npm run lint:fix` — it may have moved into a stricter ESLint block.
5. Run whatever command names the file, not just the test suite. A broken
   `before_tests` path or import map does not surface as a test failure.
6. Check [`codecov.yml`](../../../codecov.yml) `ignore:`. If the file is not
   ignored, it now owes covered lines: [coverage](../coverage/SKILL.md).

## The first `.ts` browser spec

There is no precedent to copy yet: every one of the 53 imports in
[`tests/tests.js`](../../../tests/tests.js) ends in `_spec.js`, and no
`*_spec.ts` exists outside `tests/node/`. Two things differ from the lines
around it:

- Register it with its **real extension**, since relative imports use the
  on-disk extension:

  ```javascript
  import "./components/MyComponent_spec.ts";
  ```

- It is type-checked under `@tsconfig/strictest` as soon as it exists, which
  existing `.js` specs are not (`checkJs` is off). Run `npm run type-check`;
  expect to annotate DOM hosts and catalog handles, as in the example in
  [CONTRIBUTING.md](../../../CONTRIBUTING.md#unit-and-component-specs).

Everything else about writing the spec is unchanged:
[write-spec](../write-spec/SKILL.md).

# AGENTS.md

Prefer the linked skill or [CONTRIBUTING.md](CONTRIBUTING.md) when it
is more specific.

## What this repo is

A Vite + Mithril app that composites [LPC](https://lpc.opengameart.org)
character layers and exports a spritesheet ZIP plus attribution. Users
pick body type, items, and palettes; the shareable selection is the URL
hash. The canvas stacks PNGs (WebGL palette recolor, CPU fallback).

Source of truth: `sheet_definitions/`, `palette_definitions/`, and
`spritesheets/`. Vite emits five `dist/*-metadata.js` modules. The app
reads them only through `CatalogReader`. Do not add another metadata
module or a global; extend `CatalogReader`. Do not hand-edit generated
files. Credits are structural: every new or derived PNG needs a
`credits` entry on its sheet definition or generation fails.

## Skills

- Run one spec (Node, browser, visual): [run-one-spec](.cursor/skills/run-one-spec/SKILL.md)
- Write a spec (browser Mocha or Node): [write-spec](.cursor/skills/write-spec/SKILL.md)
- Sheet definition shape (copy an existing JSON): [sheet-definition](.cursor/skills/sheet-definition/SKILL.md)

## Invariants

- **TypeScript:** New code is `.ts` (tests, scripts, Vite plugins). Do
  not add or grow `.js`. [`testem.cjs`](testem.cjs) is the only CJS
  exception. ESM (`import` / `export`); relative imports use the on-disk
  extension. Erasable syntax only: no enums, namespaces, or parameter
  properties. Do not add `tsx` or a compile step. Unused bindings that
  must exist use a `_` prefix. `console.*` except `console.error` are
  lint errors; use `console.error`, or `debugLog` / `debugWarn` from
  `sources/utils/debug.ts`.
- **Catalog:** Thread `catalog: CatalogReader` through attrs. Getters
  return `Result<T, LoadError>` (`neverthrow`). In views, use
  `renderResult`. Elsewhere `.match` / `.unwrapOr` / `if (r.isErr())`.
  Tests create their own catalog and seed it. Do not read a hidden
  global catalog.
- **Hash / aliases:** Old hashes must keep working. Put `aliases` on
  the **destination** definition; do not rewrite or delete old hash
  keys in place. Discuss renames in an issue first.
- **CSS:** First-paint CSS is PurgeCSS-trimmed. Do not drop a class
  from markup or the safelist without checking
  [`vite/purgecss-critical-safelist.ts`](vite/purgecss-critical-safelist.ts).
  A class used only at runtime can be purged and ship a blank control.
- **Lockfile:** After a lockfile merge or rebase, `npm run lockfile:fix`,
  not `npm install`.
- **Coverage:** `codecov/patch` is 100% on `sources/` (browser) and
  `scripts/` (node). `codecov/changes` must not drop hits. No
  project-percentage gate. Exceptions: [`codecov.yml`](codecov.yml)
  `ignore:`. Confirm locally: run the matching coverage script and
  inspect `coverage/browser/` or `coverage/node/` for the new lines.
  Do not wait for CI.

## Where to look

- Layout, setup, commands: [Repository layout](CONTRIBUTING.md#repository-layout), [Requirements](CONTRIBUTING.md#requirements)
- Catalog API, generated metadata, Vite cache: [File Generation](CONTRIBUTING.md#file-generation)
- Specs: [write-spec](.cursor/skills/write-spec/SKILL.md), [run-one-spec](.cursor/skills/run-one-spec/SKILL.md)
- Sheet JSON / credits: [sheet-definition](.cursor/skills/sheet-definition/SKILL.md)
- Asset rename / aliases: [Renaming an Asset](CONTRIBUTING.md#renaming-an-asset)
- z-positions: [z-positions](CONTRIBUTING.md#z-positions)
- Palette items: [PALETTE_RECOLOR_GUIDE.md](PALETTE_RECOLOR_GUIDE.md)
- Canvas / ZIP profiling: [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md)

## Narrowest check

`npm test` is the full suite — last resort. Use `npm run lint:fix` for
auto-fixable issues. Update docs and comments the change makes stale.
Do not skip license/credit updates when touching art or definitions.
Canvas (WebGL and CPU fallback) or ZIP export:
[PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md).

| Change | Check |
| --- | --- |
| Definitions only | `npm run validate-site-sources` |
| `sources/` | one spec ([run-one-spec](.cursor/skills/run-one-spec/SKILL.md)) + `npm run test:browser:coverage` |
| `scripts/` (see [`codecov.yml`](codecov.yml) `ignore:`) | `node --test <file>` + `npm run test:node:coverage` |
| Vite plugin | Node spec if behavior changed (plugins are Codecov-ignored) |

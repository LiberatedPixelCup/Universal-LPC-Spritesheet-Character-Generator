# AGENTS.md

Prefer the linked skill or [CONTRIBUTING.md](CONTRIBUTING.md) when it
is more specific.

## What this repo is

A Vite + Mithril app that composites [LPC](https://lpc.opengameart.org)
character layers and exports a spritesheet ZIP plus attribution. Users
pick body type, items, and palettes; the shareable selection is the URL
hash. The canvas stacks PNGs (WebGL palette recolor, CPU fallback).
Runtime wiring: [ARCHITECTURE.md](ARCHITECTURE.md).

Source of truth: `sheet_definitions/`, `palette_definitions/`, and
`spritesheets/`. Vite emits five `dist/*-metadata.js` modules. The app
reads them only through `CatalogReader`. Do not add another metadata
module or a global; extend `CatalogReader`. Do not hand-edit generated
`dist/` files. Credits are structural: every new or derived PNG needs a
`credits` entry on its sheet definition or generation fails.

## Invariants

- **TypeScript:** New code is `.ts` (tests, scripts, Vite plugins); do
  not add new `.js`. [`testem.cjs`](testem.cjs) is the only CJS
  exception. ESM only; relative imports use the on-disk extension.
  Erasable syntax only — no enums, namespaces, or parameter properties,
  and no `tsx` or compile step. Converting a `.js` you touch is
  encouraged, but check for hardcoded call sites first:
  [typescript](.cursor/skills/typescript/SKILL.md).
- **Catalog:** Thread `catalog: CatalogReader` through attrs; never read
  a hidden global. Getters return `Result<T, LoadError>` (`neverthrow`)
  — handle both arms. Tests create and seed their own catalog.
  [catalog](.cursor/skills/catalog/SKILL.md).
- **Hash / aliases:** Hash values are `Item_variant` (e.g.
  `expression=Neutral_light`). Old hashes must keep working. Put
  `aliases` on the **destination** definition; do not rewrite or delete
  old hash keys in place. Discuss renames in an issue first.
- **Coverage:** `codecov/patch` is 100% on gated production lines
  (`sources/` browser, `scripts/` node, minus [`codecov.yml`](codecov.yml)
  `ignore:`); `codecov/changes` must not drop hits. No project gate.
  Confirm locally, do not wait for CI:
  [coverage](.cursor/skills/coverage/SKILL.md).

## Where to look

- Bootstrap, render path, module roles: [ARCHITECTURE.md](ARCHITECTURE.md)
- Layout and setup: [Repository layout](CONTRIBUTING.md#repository-layout), [Requirements](CONTRIBUTING.md#requirements)
- Every npm script: [Commands](CONTRIBUTING.md#commands)
- What must be green on a PR: [CI checks](CONTRIBUTING.md#ci-checks)
- Generated metadata, stale `dist/`: [File Generation](CONTRIBUTING.md#file-generation)
- URL hash / aliases: [URL hash](CONTRIBUTING.md#url-hash), [Renaming an Asset](CONTRIBUTING.md#renaming-an-asset)
- z-positions: [z-positions](CONTRIBUTING.md#z-positions)
- Palette items: [Adding Palette Support](PALETTE_RECOLOR_GUIDE.md#adding-palette-support-to-items)
- Canvas / ZIP profiling: [PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md)

## Narrowest check

`npm test` is the full suite — last resort. For any `sources/` /
`scripts/` / `vite/` / `tests/` edit, run `npm run type-check` and
`npm run lint:fix` (`tsconfig.json` includes all four). Update docs and
comments the change makes stale. Do not skip license/credit updates when
touching art or definitions.

Canvas rendering must work on **both** WebGL and the CPU fallback, and
you cannot confirm that yourself — it needs a browser. Ask the user to
check. For ZIP export, match the headless script to the change:
[PERFORMANCE_PROFILING.md](PERFORMANCE_PROFILING.md).

| Change | Check |
| --- | --- |
| Definitions only | `npm run validate-site-sources`; commit dirty `CREDITS.csv` / `z_positions.csv` |
| `sources/` | `npm run type-check` + one spec ([run-one-spec](.cursor/skills/run-one-spec/SKILL.md)) + `npm run test:browser:coverage` (full suite) |
| `scripts/` | `node --test <file>` + `npm run test:node:coverage` (all Node specs) |
| Either of the above, path in [`codecov.yml`](codecov.yml) `ignore:` | Skip the coverage run; it owes no test |
| Vite plugin | Node spec if behavior changed (`vite/` is Codecov-ignored) |
| First-paint CSS class | [`vite/purgecss-critical-safelist.ts`](vite/purgecss-critical-safelist.ts) |
| Lockfile merge/rebase | `npm run lockfile:fix` (not `npm install`) |

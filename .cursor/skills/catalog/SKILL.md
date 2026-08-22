---
name: catalog
description: >-
  Thread CatalogReader through Mithril attrs, handle Result/LoadError, seed
  test catalogs, and keep URL hashes stable. Use when adding or editing a
  component, a browser spec, or sources/state/ code, or when the user
  mentions catalog, hash, or aliases.
---

# Catalog and URL hash

## Production

Thread `catalog: CatalogReader` from bootstrap through attrs. Do not read a
hidden global. Views must not call `CatalogWriter` (`registerFrom*`,
`loadCatalogFromFixtures`).

Getters return `Result<T, LoadError>` (`neverthrow`). `LoadError` is
`{ kind: "loading"; chunk }` or `{ kind: "not-found"; id }`.

- Views: `renderResult` from [`sources/utils/render-result.ts`](../../../sources/utils/render-result.ts)
- Elsewhere: `.match` / `.unwrapOr` / `if (r.isErr())`

Use typed getters (`getItemLite`, `getItemLayers`, `getCategoryTree`, …).

Readiness is staged: `isIndexReady()`, `isLiteReady()`, `isCreditsReady()`,
`isPaletteReady()`, `isLayersReady()`, plus `catalog.ready.on*`. UI already
branches on these (e.g. [`preview-canvas-loading.ts`](../../../sources/state/preview-canvas-loading.ts)).

Bootstrap: [`sources/main.ts`](../../../sources/main.ts) and
[`sources/install-item-metadata.ts`](../../../sources/install-item-metadata.ts)
call `configureStateCatalog`.

## Importing generated metadata

Source code imports the five chunks as `../<name>-metadata.js`, **not** as a
`dist/` path. `itemMetadataResolveAliases()` in
[`vite/wiring.ts`](../../../vite/wiring.ts) installs a `resolve.alias` regex
that rewrites any specifier ending in a metadata basename to `dist/`. So
[`install-item-metadata.ts`](../../../sources/install-item-metadata.ts) and
[`browser-catalog-fixture.js`](../../../tests/browser-catalog-fixture.js) both
write `../index-metadata.js` and get `dist/index-metadata.js`. Copy the
existing specifier shape; do not "fix" it to a real path, and do not expect the
file to exist next to the importer. If it fails to resolve, `dist/` was never
built — run `npm run dev` or `npm run build`.

## Tests

`createCatalog()` then seed. Never the production singleton.

- [`seedCatalog`](../../../tests/browser-catalog-fixture.js) — explicit fixtures
- `seedCatalogWithGeneratedContext` — keeps generated palette/alias/tree/index
  context; needs generated metadata, so run `npm run dev` or `npm run build`
  first
- `registerFrom*Module` — one readiness stage

A new spec has to actually hit the lines it covers: [coverage](../coverage/SKILL.md).

## URL hash

Shape: `type_name=Item_variant` (e.g. `expression=Neutral_light`). Old hashes
must keep working. Put `aliases` on the **destination** definition. Do not
rewrite or delete old hash keys. Discuss renames in an issue first.

Details: [Catalog](../../../CONTRIBUTING.md#catalog),
[URL hash](../../../CONTRIBUTING.md#url-hash).

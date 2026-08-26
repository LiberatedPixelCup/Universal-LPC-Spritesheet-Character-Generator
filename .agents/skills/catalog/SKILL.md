---
name: catalog
description: >-
  Thread CatalogReader and State through Mithril attrs, never a hidden
  global. Handle Result/LoadError, seed test catalogs, and keep URL hashes
  stable. Use when adding or editing a component, a browser spec, or
  sources/state/ code, or when the user mentions catalog, state, hash, or
  aliases.
---

# Catalog, state, and URL hash

## Production

Thread `catalog: CatalogReader` and `state: State` from bootstrap to a UI
composition boundary. Prefer passing a narrow model below that boundary when
one exists; `CurrentSelections` is the first example. Build those models in
`main.ts`, then have components forward or consume their assigned slices rather
than constructing dependencies themselves. Do not read a hidden global. Views
must not receive `CatalogWriter` (`register*Metadata`,
`loadCatalogFromFixtures`).

Getters return `Result<T, LoadError>` (`neverthrow`). `LoadError` is
`{ kind: "loading"; chunk }` or `{ kind: "not-found"; id }`.

- Views: `renderResult` from [`sources/utils/render-result.ts`](../../../sources/utils/render-result.ts)
- Elsewhere: `.match` / `.unwrapOr` / `if (r.isErr())`

Use typed getters (`getItemLite`, `getItemLayers`, `getCategoryTree`, …).

Readiness is staged: `isIndexReady()`, `isLiteReady()`, `isCreditsReady()`,
`isPaletteReady()`, `isLayersReady()`, plus `catalog.ready.on*`. UI already
branches on these (e.g. [`preview-canvas-loading.ts`](../../../sources/state/preview-canvas-loading.ts)).

Only [`sources/main.ts`](../../../sources/main.ts) calls
`configureStateCatalog`. That binds the catalog for `sources/state/` so those
modules do not take a catalog argument on every call. It is not a hidden
global for UI — components still receive `catalog` and `state` as attrs.
`createCatalog()` returns separate `{ reader, writer }` runtime objects backed
by the same private stores. [`sources/install-item-metadata.ts`](../../../sources/install-item-metadata.ts)
starts registration with the writer and returns only the reader to production
bootstrap.

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
built — run `npm run dev` or `npm run build`. Stale `.cache/` or a missing
`dist/` after a definition change:
[generated-metadata](../generated-metadata/SKILL.md).

## Tests

Destructure `{ reader, writer } = createCatalog()` and create a fresh
`createState()`. Never use the production reader or bootstrap state instance.
Create a new catalog rather than re-seeding: `loadCatalogFromFixtures` and
`register*Metadata` overwrite the stores but cannot move a resolved stage
back to unresolved. A spec that re-seeds expecting a fresh "loading"
catalog will silently see resolved stages instead.

Call `configureStateCatalog(catalog)` when the spec exercises `sources/state/`
effects. Override individual effects with `setStateDeps` and restore them with
`resetStateDeps`.

- [`seedCatalog`](../../../tests/browser-catalog-fixture.js) — pass the writer
  to seed explicit fixtures; pass the paired reader to consumers
- `seedCatalogWithGeneratedContext` — keeps generated palette/alias/tree/index
  context; needs generated metadata, so run `npm run dev` or `npm run build`
  first
- `register*Metadata` — one readiness stage

A new spec has to actually hit the lines it covers: [coverage](../coverage/SKILL.md).

## Emitted vs expanded `ItemLite`

`dist/item-metadata.js` may intern variant strings and recolor palette maps.
`registerItemMetadata` / `registerIndexMetadata` expand those into the runtime
shapes getters return. Do not read `v` / `r` / `p` off `getItemLite`.

| Field | Emitted (interned) | Expanded (runtime `ItemLite`) |
| --- | --- | --- |
| `variants` | omitted; `v` indexes `variantArrays` | `string[]` |
| `recolors[0].variants` | omitted; `r` indexes `recolorVariantArrays` | `string[]` |
| `recolors[].palettes` | omitted; `p` indexes `paletteArrays` | `PaletteMap` |
| licenses / tags / priority | not on lite (credits chunk / sheet JSON / generator sort) | not on lite |

`MetadataIndexes` may include `variantArrays`, `recolorVariantArrays`, and
`paletteArrays`. Expansion keeps those tables on the index store. Palette
restore (`hasInternedPalettes`) does not require `v` / `r`. Until the index
chunk arrives, `getPaletteOptions` treats missing `palettes` as `{}`.

## URL hash

Shape: `type_name=Item_variant` (e.g. `expression=Neutral_light`). Old hashes
must keep working. Put `aliases` on the **destination** definition. Do not
rewrite or delete old hash keys. Discuss renames in an issue first.

Details: [Catalog and state](../../../CONTRIBUTING.md#catalog-and-state),
[URL hash](../../../CONTRIBUTING.md#url-hash).

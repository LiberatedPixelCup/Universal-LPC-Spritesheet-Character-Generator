---
name: generated-metadata
description: >-
  Diagnose missing or stale dist/*-metadata.js, the Vite metadata plugin
  cache, and the ../name-metadata.js import alias. Use when dist/ is
  missing, a catalog resolves nothing, a spec fails only locally, or
  editing the Vite metadata plugin. Do not hand-edit dist/ or add another
  metadata module.
---

# Generated metadata

Vite writes five modules to `dist/`: `index-`, `palette-`, `item-`,
`credits-`, and `layers-metadata.js`. Source code imports them as
`../<name>-metadata.js`, never as a `dist/` path. See
[Generated metadata and the dist alias](../../../ARCHITECTURE.md#generated-metadata-and-the-dist-alias).

A resolve failure means `dist/` was never built. After a fresh clone, run
`npm run dev` or `npm run build` once before specs, ZIP profiles, or
`seedCatalogWithGeneratedContext`. `profile:app` starts Vite itself.

The plugin fingerprints `sheet_definitions/`, `palette_definitions/`, and
`scripts/generateSources/` under `.cache/` (gitignored). If the fingerprint
matches and `dist/index-metadata.js` exists, generation is skipped. A
generator emit change without a definition change used to reuse stale
`dist/`. Symptoms: a seeded catalog resolves nothing, `not-found` for an
item you just added, or a spec that passes for someone else.

Force the full pipeline:

```bash
VITE_REGENERATE_SOURCES=1 npm run dev
```

Deleting `.cache/` has the same effect. Details:
[File Generation](../../../CONTRIBUTING.md#file-generation).

After changing emit (`scripts/generateSources/`), run `npm run metadata:size`
(and `metadata:size:check` once that gate exists) so payload regressions are
visible. Do not hand-edit `dist/` or add a sixth metadata module.

## Intern tables

Emitted `index-metadata.js` stores shared tables; `item-metadata.js` stores
indices. `registerIndexMetadata` / `registerItemMetadata` expand them.

| Table | Indexed by | Restores |
| --- | --- | --- |
| `variantArrays` | per-item `v` | `ItemLite.variants` |
| `recolorVariantArrays` | per-item `r` | `recolors[0].variants` |
| `paletteArrays` | per-recolor `p` | `recolors[].palettes` |

Emitted lite has `v` / `r` / `p` and omits the expanded arrays/maps. Not
emitted on lite: `licenses`, `tags`, `required_tags`, `excluded_tags`,
`priority` (credits chunk / sheet JSON / generator tree sort).

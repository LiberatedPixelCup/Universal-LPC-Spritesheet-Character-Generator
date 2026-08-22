---
name: generated-metadata
description: >-
  Diagnose missing or stale dist/*-metadata.js, the Vite metadata plugin
  cache, and the ../name-metadata.js import alias. Use when dist/ is
  missing, a catalog resolves nothing, a spec fails only locally, or
  editing the Vite metadata plugin.
---

# Generated metadata

Vite writes five modules to `dist/`: `index-`, `palette-`, `item-`,
`credits-`, and `layers-metadata.js`. Source code imports them as
`../<name>-metadata.js`, never as a `dist/` path. See
[Generated metadata and the dist alias](../../../ARCHITECTURE.md#generated-metadata-and-the-dist-alias).

A resolve failure means `dist/` was never built. After a fresh clone, run
`npm run dev` or `npm run build` once before specs, ZIP profiles, or
`seedCatalogWithGeneratedContext`. `profile:app` starts Vite itself.

The plugin fingerprints `sheet_definitions/` and `palette_definitions/` under
`.cache/` (gitignored). If the fingerprint matches and
`dist/index-metadata.js` exists, generation is skipped. Symptoms: a seeded
catalog resolves nothing, `not-found` for an item you just added, or a spec
that passes for someone else.

Force the full pipeline:

```bash
VITE_REGENERATE_SOURCES=1 npm run dev
```

Deleting `.cache/` has the same effect. Details:
[File Generation](../../../CONTRIBUTING.md#file-generation).

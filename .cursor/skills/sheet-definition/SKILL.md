---
name: sheet-definition
description: >-
  Add or edit sheet_definitions JSON for items, categories, variants, credits,
  layers, or z-positions. Use when adding art, a new category, a credits entry,
  or renaming an asset. Copy a neighboring definition; do not invent keys.
---

# Sheet definitions

Copy a neighboring JSON under `sheet_definitions/`. Do not invent a schema.
Human walkthrough and the `credits` example: [CONTRIBUTING.md](../../../CONTRIBUTING.md).
Multi-layer example: [tail_lizard.json](../../../sheet_definitions/body/lizard/tail_lizard.json).

**Required**

- `name`, `type_name`
- `layer_1` (and `layer_2`… if needed), each with `zPos` and body-type paths
  into `spritesheets/`
- `credits[]` with `file`, `authors`, `licenses`, `urls` (generation fails
  without this)

**Existing category:** add PNGs under `spritesheets/` and the variant name on
the matching definition (`variants`, or `recolors` for palette-backed items).

**New category:** new JSON next to similar items. Palette-backed items:
[PALETTE_RECOLOR_GUIDE.md](../../../PALETTE_RECOLOR_GUIDE.md).

**Optional:** `animations` restricts the animations filter; omit it for the
default list. Asset renames need `aliases` on the **destination** definition
and an issue first.

Then `npm run validate-site-sources` and commit any dirty `CREDITS.csv` /
`z_positions.csv`. Do not hand-edit those CSVs.

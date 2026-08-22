---
name: sheet-definition
description: >-
  Add or edit sheet_definitions JSON for items, categories, variants, credits,
  layers, or z-positions. Use when adding art, a new category, a credits entry,
  or renaming an asset. Copy a neighboring definition; do not invent keys.
---

# Sheet definitions

Copy a neighboring JSON under `sheet_definitions/`. Do not invent a schema.
Accepted fields: `SheetDefinition` in
[`scripts/generateSources/items.ts`](../../../scripts/generateSources/items.ts).
Human walkthrough and the `credits` example:
[CONTRIBUTING.md](../../../CONTRIBUTING.md#adding-a-new-category).
Multi-layer example: [tail_lizard.json](../../../sheet_definitions/body/lizard/tail_lizard.json).

Typical required keys: `name`, `type_name`, `layer_1` (`zPos` plus body-type
paths into `spritesheets/`), and `credits[]` (`file`, `authors`, `licenses`,
`urls`; `notes` is optional).

`type_name` is the hash key and `name` supplies the `Item` half of the
`Item_variant` hash value, so both are part of the URL contract — see
[catalog](../catalog/SKILL.md).

`credits[].file` must name the spritesheet file or one of its **path-segment
ancestors**, not an arbitrary string prefix. `searchCredit` in
[`credits.ts`](../../../scripts/generateSources/credits.ts) matches
`credit.file` against the path exactly, against `path + ".png"`, or against
`credit.file + "/"`, then retries after trimming at the last `/`. So
`arms/hands/ring` covers `arms/hands/ring/stud`, but `arms/hands/ri` covers
nothing. Failing to match logs `missing credit after searching recursively`
and then throws `missing credit inside …`.

**Existing category:** add PNGs under `spritesheets/` and the variant name on
the matching definition (`variants`). Palette-backed items use `recolors` and
do **not** add a PNG per color — follow
[Adding Palette Support](../../../PALETTE_RECOLOR_GUIDE.md#adding-palette-support-to-items),
do not invent `recolors` keys.

**New category:** new JSON next to similar items.

**Optional:** `animations` restricts the animations filter; omit it for the
default list. Asset renames need `aliases` on the **destination** definition
and an issue first. Other keys (`tags`, `replace_in_path`, `match_body_color`,
…) — copy a neighbor that already uses them.

Then `npm run validate-site-sources` and commit any dirty `CREDITS.csv` /
`z_positions.csv`. `CREDITS.csv` is generate-only. `z_positions.csv` may be
edited as a bulk aid; JSON is the source of truth
(`npm run z-positions:update` writes the CSV back to JSON). The app reads
generated `dist/*-metadata.js`, not the JSON directly; if a new item is
invisible after `npm run dev`, see
[generated-metadata](../generated-metadata/SKILL.md).

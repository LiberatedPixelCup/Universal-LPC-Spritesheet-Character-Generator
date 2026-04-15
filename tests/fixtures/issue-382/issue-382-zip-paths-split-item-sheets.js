/**
 * exportSplitItemSheets — sorted zip paths
 *
 * Regenerate (writes this file and sibling issue-382 fixtures):
 *   node scripts/fixture-builder.js tests/fixtures/issue-382/issue-382-selections.json
 *
 * Snapshot: encodes current export behavior — review diffs; do not regenerate blindly
 * after a suspected bug without verifying output (see scripts/fixture-builder.js).
 *
 * @see scripts/fixture-builder.js
 * @see scripts/issue382-golden-playwright.mjs
 * @see issue382-golden-runner.html
 */

/** Sorted zip entry paths for regression tests (issue #382). */
export const paths = [
  "character.json",
  "credits/credits.csv",
  "credits/credits.txt",
  "items/009 longsword__longsword_.png",
  "items/010 body_color__light_.png",
  "items/015 revised_shoes__bluegray_.png",
  "items/020 long_pants__orange_.png",
  "items/055 iverness_cloak__black_.png",
  "items/100 human_male__light_.png",
  "items/120 natural__violet_.png",
  "items/140 longsword__longsword_.png"
];

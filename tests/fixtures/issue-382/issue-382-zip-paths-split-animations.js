/**
 * exportSplitAnimations — sorted zip paths
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
  "credits/metadata.json",
  "custom/slash_oversize.png",
  "custom/slash_reverse_oversize.png",
  "custom/thrust_oversize.png",
  "standard/1h_backslash.png",
  "standard/1h_halfslash.png",
  "standard/1h_slash.png",
  "standard/climb.png",
  "standard/combat.png",
  "standard/emote.png",
  "standard/hurt.png",
  "standard/idle.png",
  "standard/jump.png",
  "standard/run.png",
  "standard/shoot.png",
  "standard/sit.png",
  "standard/slash.png",
  "standard/spellcast.png",
  "standard/thrust.png",
  "standard/walk.png",
  "standard/watering.png"
];

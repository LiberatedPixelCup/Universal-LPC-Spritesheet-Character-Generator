/**
 * Loads generated metadata chunks via parallel dynamic imports and registers them with `catalog`.
 * Each chunk calls `register*` as soon as its file loads; `m.redraw()` is coalesced to at most
 * once per animation frame so several chunks landing together do not thrash layout.
 *
 * Call `loadAllMetadata()` to start loading; it returns a promise that resolves when all five
 * chunks are registered. The return value exposes lite `itemMetadata`, `layersMetadata`, and
 * `creditsMetadata` separately (no merged per-item objects). Tests merge as needed.
 * The browser test page (`tests_run.html`) still awaits `loadAllMetadata()` at module evaluation.
 */
import {
  registerFromCreditsModule,
  registerFromIndexModule,
  registerFromItemModule,
  registerFromLayersModule,
  registerFromPaletteModule,
} from "./state/catalog.ts";

/** @returns {boolean} */
function isBrowserTestHarnessPage() {
  try {
    return /tests_run/i.test(globalThis.location?.pathname ?? "");
  } catch {
    return false;
  }
}

let loadAllMetadataPromise = null;

/** @type {number|null} */
let metadataRedrawRaf = null;

function safeRedraw() {
  if (metadataRedrawRaf !== null) return;
  metadataRedrawRaf = requestAnimationFrame(() => {
    metadataRedrawRaf = null;
    try {
      globalThis.m?.redraw?.();
    } catch {
      /* ignore */
    }
  });
}

/** Test harness: allow `loadAllMetadata()` to run again after `resetCatalogForTests()`. */
export function resetLoadAllMetadataCacheForTests() {
  loadAllMetadataPromise = null;
}

/**
 * Parallel `import()` of the five metadata modules; each registers as soon as its file loads.
 * @returns {Promise<{
 *   itemMetadata: Record<string, object>,
 *   layersMetadata: Record<string, Record<string, object>>,
 *   creditsMetadata: Record<string, object[]>,
 *   aliasMetadata: object,
 *   categoryTree: object,
 *   paletteMetadata: object,
 *   metadataIndexes: object,
 * }>}
 */
export function loadAllMetadata() {
  loadAllMetadataPromise ??= (async () => {
    const [indexMod, paletteMod, itemMod, creditsMod, layersMod] =
      await Promise.all([
        import("../index-metadata.js").then((mod) => {
          registerFromIndexModule({
            aliasMetadata: mod.aliasMetadata,
            categoryTree: mod.categoryTree,
            metadataIndexes: mod.metadataIndexes,
          });
          safeRedraw();
          return mod;
        }),
        import("../palette-metadata.js").then((mod) => {
          registerFromPaletteModule({ paletteMetadata: mod.paletteMetadata });
          safeRedraw();
          return mod;
        }),
        import("../item-metadata.js").then((mod) => {
          registerFromItemModule({ itemMetadata: mod.itemMetadata });
          safeRedraw();
          return mod;
        }),
        import("../credits-metadata.js").then((mod) => {
          registerFromCreditsModule({ itemCredits: mod.itemCredits });
          safeRedraw();
          return mod;
        }),
        import("../layers-metadata.js").then((mod) => {
          registerFromLayersModule({ itemLayers: mod.itemLayers });
          safeRedraw();
          return mod;
        }),
      ]);

    return {
      itemMetadata: itemMod.itemMetadata,
      layersMetadata: layersMod.itemLayers,
      creditsMetadata: creditsMod.itemCredits,
      aliasMetadata: indexMod.aliasMetadata,
      categoryTree: indexMod.categoryTree,
      paletteMetadata: paletteMod.paletteMetadata,
      metadataIndexes: indexMod.metadataIndexes,
    };
  })();

  return loadAllMetadataPromise;
}

if (isBrowserTestHarnessPage()) {
  await loadAllMetadata();
}

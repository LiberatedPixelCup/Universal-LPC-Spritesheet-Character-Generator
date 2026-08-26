/**
 * Loads generated metadata chunks via parallel dynamic imports and registers them with `catalog`.
 * Each chunk calls `register*` as soon as its file loads; `m.redraw()` is coalesced to at most
 * once per animation frame so several chunks landing together do not thrash layout.
 *
 * Call `loadAllMetadata(catalog)` to start loading; it returns a promise that resolves when all five
 * chunks are registered. The return value exposes lite `itemMetadata`, `layersMetadata`, and
 * `creditsMetadata` separately (no merged per-item objects). Tests merge as needed.
 *
 * Native User Timing (not `window.profiler`) wraps the `Promise.all` as `catalog-load` and each
 * `import()` plus `register*` as `catalog-chunk:*`, so production catalog-ready time is observable
 * before `main.ts` constructs the profiler.
 */
import {
  createCatalog,
  type AliasMetadata,
  type CatalogReader,
  type CatalogWriter,
  type CategoryTree,
  type Credit,
  type ItemLite,
  type LayerEntry,
  type MetadataIndexes,
  type PaletteMetadata,
} from "./state/catalog.ts";

type LoadedChunks = {
  itemMetadata: Record<string, ItemLite>;
  layersMetadata: Record<string, Record<string, LayerEntry>>;
  creditsMetadata: Record<string, Credit[]>;
  aliasMetadata: AliasMetadata;
  categoryTree: CategoryTree;
  paletteMetadata: PaletteMetadata;
  metadataIndexes: MetadataIndexes;
};

export const CATALOG_LOAD_MEASURE = "catalog-load";

export const CATALOG_CHUNK_MEASURE_NAMES = [
  "catalog-chunk:index",
  "catalog-chunk:item",
  "catalog-chunk:credits",
  "catalog-chunk:palette",
  "catalog-chunk:layers",
] as const;

let catalogTimingSeq = 0;

let metadataRedrawRaf: number | null = null;

function safeRedraw(): void {
  if (metadataRedrawRaf !== null) return;
  metadataRedrawRaf = requestAnimationFrame(() => {
    metadataRedrawRaf = null;
    try {
      (globalThis as { m?: { redraw?: () => void } }).m?.redraw?.();
    } catch {
      /* ignore */
    }
  });
}

async function measureAsync<T>(
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  const id = ++catalogTimingSeq;
  const startMark = `${name}-start-${id}`;
  const endMark = `${name}-end-${id}`;
  performance.mark(startMark);
  const result = await work();
  performance.mark(endMark);
  performance.measure(name, startMark, endMark);
  return result;
}

/**
 * Parallel `import()` of the five metadata modules; each registers as soon as its file loads.
 */
export function loadAllMetadata(catalog: CatalogWriter): Promise<LoadedChunks> {
  return measureAsync(CATALOG_LOAD_MEASURE, () =>
    loadAllMetadataChunks(catalog),
  );
}

async function loadAllMetadataChunks(
  catalog: CatalogWriter,
): Promise<LoadedChunks> {
  const [indexMod, paletteMod, itemMod, creditsMod, layersMod] =
    await Promise.all([
      measureAsync("catalog-chunk:index", async () => {
        const mod = await import("../index-metadata.js");
        catalog.registerIndexMetadata({
          aliasMetadata: mod.aliasMetadata,
          categoryTree: mod.categoryTree,
          metadataIndexes: mod.metadataIndexes,
        });
        safeRedraw();
        return mod;
      }),
      measureAsync("catalog-chunk:palette", async () => {
        const mod = await import("../palette-metadata.js");
        catalog.registerPaletteMetadata(mod.paletteMetadata);
        safeRedraw();
        return mod;
      }),
      measureAsync("catalog-chunk:item", async () => {
        const mod = await import("../item-metadata.js");
        catalog.registerItemMetadata(mod.itemMetadata);
        safeRedraw();
        return mod;
      }),
      measureAsync("catalog-chunk:credits", async () => {
        const mod = await import("../credits-metadata.js");
        catalog.registerCreditsMetadata(mod.itemCredits);
        safeRedraw();
        return mod;
      }),
      measureAsync("catalog-chunk:layers", async () => {
        const mod = await import("../layers-metadata.js");
        catalog.registerLayersMetadata(mod.itemLayers);
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
}

/**
 * Create the production catalog, start registering generated chunks, and
 * expose only its runtime reader capability to application code.
 *
 * Call this as the entry module runs, before `DOMContentLoaded`, so chunk
 * download and parse overlap HTML parsing.
 */
export function createLoadedCatalog(): CatalogReader {
  const { reader, writer } = createCatalog();
  void loadAllMetadata(writer);
  return reader;
}

type CatalogReadinessHookGlobals = {
  __LPC_waitCatalogIndexReady: () => Promise<void>;
  __LPC_waitCatalogLiteReady: () => Promise<void>;
  __LPC_waitCatalogAllReady: () => Promise<void>;
  __LPC_arePaletteModalMetadataChunksReady: () => boolean;
};

/**
 * Expose metadata readiness to Playwright, Argos, and dump-computed-styles.
 * These tools execute in a separate browser context and need a global bridge
 * to wait for dynamically imported catalog chunks before inspecting the UI.
 *
 * `main.ts` calls this after `createLoadedCatalog()`. Specs call it on a test
 * catalog so they do not import `main.ts`.
 */
export function installCatalogReadinessHooksForVisualTooling(
  catalog: CatalogReader,
): void {
  const g = globalThis as typeof globalThis & CatalogReadinessHookGlobals;
  g.__LPC_waitCatalogIndexReady = () => catalog.ready.onIndexReady;
  g.__LPC_waitCatalogLiteReady = () => catalog.ready.onLiteReady;
  g.__LPC_waitCatalogAllReady = () => catalog.ready.onAllReady;
  g.__LPC_arePaletteModalMetadataChunksReady = () =>
    catalog.isIndexReady() &&
    catalog.isLiteReady() &&
    catalog.isCreditsReady() &&
    catalog.isPaletteReady() &&
    catalog.isLayersReady();
}

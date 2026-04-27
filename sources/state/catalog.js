/**
 * Central façade for split metadata chunks (index, palette, lite items, credits, layers).
 * Loaders call `registerFrom*Module` after each dynamic import; consumers use getters and `is*Ready`.
 */

import {
  buildItemsByTypeNameLite,
  expandInternedItemLite,
  expandMetadataIndexesWithInternedArrays,
  isInternedItemLite,
} from "./resolve-hash-param.js";

function makeStage() {
  let resolveFn;
  const promise = new Promise((r) => {
    resolveFn = r;
  });
  /** @type {{ promise: Promise<void>, resolved: boolean, resolve: () => void }} */
  const stage = {
    promise,
    resolved: false,
    resolve: () => {
      stage.resolved = true;
      resolveFn?.();
    },
  };
  return stage;
}

let indexStage = makeStage();
let liteStage = makeStage();
let creditsStage = makeStage();
let paletteStage = makeStage();
let layersStage = makeStage();

/** @type {Record<string, unknown>|null} */
let aliasMetadataStore = null;
/** @type {Record<string, unknown>|null} */
let categoryTreeStore = null;
/** @type {Record<string, unknown>|null} */
let metadataIndexesStore = null;
/** @type {Record<string, unknown>|null} */
let itemLiteStore = null;
/** @type {Record<string, unknown[]>|null} */
let itemCreditsStore = null;
/** @type {Record<string, Record<string, unknown>>|null} */
let itemLayersStore = null;
/** @type {Record<string, unknown>|null} */
let paletteMetadataStore = null;

/**
 * Promises that settle once when the corresponding chunk registers (idempotent per stage).
 * After `resetCatalogForTests()`, use these getters again for fresh promises.
 */
export const catalogReady = {
  get onIndexReady() {
    return indexStage.promise;
  },
  get onLiteReady() {
    return liteStage.promise;
  },
  get onCreditsReady() {
    return creditsStage.promise;
  },
  get onPaletteReady() {
    return paletteStage.promise;
  },
  get onLayersReady() {
    return layersStage.promise;
  },
  get onAllReady() {
    return Promise.all([
      indexStage.promise,
      liteStage.promise,
      creditsStage.promise,
      paletteStage.promise,
      layersStage.promise,
    ]).then(() => {});
  },
};

/**
 * Synchronous resolution flags for each stage (mirrors `catalogReady` but without awaiting).
 * Read by `catalog-typed.ts` to discriminate `Result.Ok` vs `Err({kind:"loading"})`.
 * Recreated alongside the stages on `resetCatalogForTests()`.
 */
export const stages = {
  get index() {
    return indexStage;
  },
  get lite() {
    return liteStage;
  },
  get credits() {
    return creditsStage;
  },
  get palette() {
    return paletteStage;
  },
  get layers() {
    return layersStage;
  },
};

/**
 * @param {Record<string, object>} fullItemMetadata
 * @returns {{ itemMetadataLite: Record<string, object>, itemCredits: Record<string, object[]>, itemLayers: Record<string, Record<string, object>> }}
 */
function splitFullItemMetadataForCatalog(fullItemMetadata) {
  const itemMetadataLite = {};
  const itemCredits = {};
  const itemLayers = {};

  for (const [itemId, meta] of Object.entries(fullItemMetadata)) {
    const { layers, credits, ...lite } = meta;
    itemMetadataLite[itemId] = lite;
    itemCredits[itemId] = credits ?? [];
    itemLayers[itemId] = layers ?? {};
  }
  return { itemMetadataLite, itemCredits, itemLayers };
}

/**
 * Fills `variants` and `recolors[0].variants` from `metadataIndexesStore` when the lite chunk
 * was emitted with interned `v` / `r` (shared tables live only in `index-metadata.js`).
 */
function expandInternedItemLitesInStore() {
  if (itemLiteStore === null || metadataIndexesStore === null) {
    return;
  }
  const { variantArrays, recolorVariantArrays } = metadataIndexesStore;
  if (!Array.isArray(variantArrays) || !Array.isArray(recolorVariantArrays)) {
    return;
  }
  for (const itemId of Object.keys(itemLiteStore)) {
    const cur = itemLiteStore[itemId];
    if (isInternedItemLite(cur)) {
      itemLiteStore[itemId] = expandInternedItemLite(
        cur,
        variantArrays,
        recolorVariantArrays,
      );
    }
  }
}

export function isIndexReady() {
  return (
    aliasMetadataStore !== null &&
    categoryTreeStore !== null &&
    metadataIndexesStore !== null
  );
}

export function isLiteReady() {
  return itemLiteStore !== null;
}

export function isCreditsReady() {
  return itemCreditsStore !== null;
}

export function isPaletteReady() {
  return paletteMetadataStore !== null;
}

export function isLayersReady() {
  return itemLayersStore !== null;
}

export function isHashHydrationReady() {
  return isIndexReady() && isLiteReady();
}

export function isAllReady() {
  return isIndexReady() && isLiteReady() && isCreditsReady() && isLayersReady();
}

export function getAliasMetadata() {
  return aliasMetadataStore;
}

export function getCategoryTree() {
  return categoryTreeStore;
}

export function getMetadataIndexes() {
  return metadataIndexesStore;
}

export function getPaletteMetadata() {
  return paletteMetadataStore;
}

/** @param {string} itemId */
export function getItemLite(itemId) {
  if (!isLiteReady()) {
    return undefined;
  }
  return itemLiteStore[itemId];
}

/** @param {string} itemId */
export function getItemLayers(itemId) {
  if (!isLayersReady()) {
    return undefined;
  }
  return itemLayersStore[itemId] ?? {};
}

/** @param {string} itemId */
export function getItemCredits(itemId) {
  if (!isCreditsReady()) {
    return [];
  }
  return itemCreditsStore[itemId] ?? [];
}

/**
 * Merged item view (lite + layers + credits) compatible with legacy monolithic `itemMetadata[id]`.
 * Layers default to `{}` and credits to `[]` when those chunks are not registered yet.
 * @param {string} itemId
 * @returns {object|undefined}
 */
export function getItemMerged(itemId) {
  if (!isLiteReady() || itemLiteStore === null) {
    return undefined;
  }
  const lite = itemLiteStore[itemId];
  if (lite === undefined) {
    return undefined;
  }
  const layers =
    isLayersReady() && itemLayersStore !== null
      ? (itemLayersStore[itemId] ?? {})
      : {};
  const credits =
    isCreditsReady() && itemCreditsStore !== null
      ? (itemCreditsStore[itemId] ?? [])
      : [];
  return { ...lite, layers, credits };
}

/**
 * `byTypeName` for hash resolution when the index module is not registered yet. Rows match
 * `buildSlimByTypeNameRow` (itemId, name, type_name, variants, recolors minimal array).
 */
export function buildItemsByTypeNameFromRegisteredLite() {
  if (!itemLiteStore) {
    return {};
  }
  /** @type {Record<string, object>} */
  const synthetic = {};
  for (const [id, lite] of Object.entries(itemLiteStore)) {
    synthetic[id] = { ...lite, layers: {}, credits: [] };
  }
  return buildItemsByTypeNameLite(synthetic);
}

/**
 * @param {{ aliasMetadata: object, categoryTree: object, metadataIndexes: object }} exports_
 */
export function registerFromIndexModule(exports_) {
  aliasMetadataStore = exports_.aliasMetadata;
  categoryTreeStore = exports_.categoryTree;
  metadataIndexesStore = expandMetadataIndexesWithInternedArrays(
    exports_.metadataIndexes,
  );
  indexStage.resolve();
  expandInternedItemLitesInStore();
}

/** @param {{ paletteMetadata: object }} exports_ */
export function registerFromPaletteModule(exports_) {
  paletteMetadataStore = exports_.paletteMetadata;
  paletteStage.resolve();
}

/** @param {{ itemMetadata: Record<string, object> }} exports_ */
export function registerFromItemModule(exports_) {
  itemLiteStore = exports_.itemMetadata;
  expandInternedItemLitesInStore();
  liteStage.resolve();
}

/** @param {{ itemCredits: Record<string, object[]> }} exports_ */
export function registerFromCreditsModule(exports_) {
  itemCreditsStore = exports_.itemCredits;
  creditsStage.resolve();
}

/** @param {{ itemLayers: Record<string, Record<string, object>> }} exports_ */
export function registerFromLayersModule(exports_) {
  itemLayersStore = exports_.itemLayers;
  layersStage.resolve();
}

/**
 * Loads the catalog from `extractMetadataGlobalsFromWrites` / `runBuild` `.globals`
 * (merged `itemMetadata` is split into lite, credits, and layers).
 * @param {{
 *   itemMetadata: Record<string, object>,
 *   aliasMetadata: object,
 *   categoryTree: object,
 *   metadataIndexes: object,
 *   paletteMetadata: object,
 * }} fixtureGlobals
 */
export function loadCatalogFromFixtures(fixtureGlobals) {
  resetCatalogForTests();
  const {
    itemMetadata,
    aliasMetadata,
    categoryTree,
    metadataIndexes,
    paletteMetadata,
  } = fixtureGlobals;
  registerFromIndexModule({ aliasMetadata, categoryTree, metadataIndexes });
  registerFromPaletteModule({ paletteMetadata });
  const { itemMetadataLite, itemCredits, itemLayers } =
    splitFullItemMetadataForCatalog(itemMetadata);
  registerFromItemModule({ itemMetadata: itemMetadataLite });
  registerFromCreditsModule({ itemCredits });
  registerFromLayersModule({ itemLayers });
}

// TODO: Replace module-level singletons with a `createCatalog()` factory + DI.
// This reset exists only because catalog state lives at module scope; tests
// have to scrub it between cases. With a factory, each test would construct
// its own instance, consumers would receive the catalog via context (e.g. a
// Mithril provider component or `state.catalog`) instead of importing it
// directly, and this function would disappear. Defer until after the
// Result-API migration lands so the consumer surface is already typed.
export function resetCatalogForTests() {
  indexStage = makeStage();
  liteStage = makeStage();
  creditsStage = makeStage();
  paletteStage = makeStage();
  layersStage = makeStage();

  aliasMetadataStore = null;
  categoryTreeStore = null;
  metadataIndexesStore = null;
  itemLiteStore = null;
  itemCreditsStore = null;
  itemLayersStore = null;
  paletteMetadataStore = null;
}

if (typeof globalThis !== "undefined") {
  /**
   * Playwright, Argos, and `dump-computed-styles` (production / vite preview).
   * Inlined here so the assignment is not tree-shaken (uses `catalogReady` from this module).
   */
  globalThis.__LPC_waitCatalogAllReady = async () => {
    await catalogReady.onAllReady;
  };
  /**
   * Same gates as `PaletteSelectModal` (split metadata: palette + layers must be present).
   * Used when a stale preview build omits `__LPC_waitCatalogAllReady` so we do not treat
   * “shell un-spinner” as sufficient — otherwise the skintone modal stays on
   * “Loading layer data…” and `data-previews-ready` never flips to true.
   */
  globalThis.__LPC_arePaletteModalMetadataChunksReady = () =>
    isIndexReady() &&
    isLiteReady() &&
    isCreditsReady() &&
    isPaletteReady() &&
    isLayersReady();
}

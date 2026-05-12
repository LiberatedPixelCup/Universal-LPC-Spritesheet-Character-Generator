import {
  loadCatalogFromFixtures,
  resetCatalogForTests,
} from "../sources/state/catalog.ts";
import {
  loadAllMetadata,
  resetLoadAllMetadataCacheForTests,
} from "../sources/install-item-metadata.ts";
import { buildItemsByTypeNameLite } from "../sources/state/resolve-hash-param.ts";

const emptyPalette = { versions: {}, materials: {} };
const emptyTree = { items: [], children: {} };

/**
 * @param {{
 *   itemMetadata: Record<string, object>,
 *   layersMetadata: Record<string, Record<string, object>>,
 *   creditsMetadata: Record<string, object[]>,
 * }} loaded
 * @returns {Record<string, object>}
 */
function mergedItemMapFromLoadedChunks(loaded) {
  const { itemMetadata: lite, layersMetadata, creditsMetadata } = loaded;
  const out = {};
  for (const id of Object.keys(lite)) {
    out[id] = {
      ...lite[id],
      layers: layersMetadata[id] ?? {},
      credits: creditsMetadata[id] ?? [],
    };
  }
  return out;
}

/**
 * Load split catalog from a merged item map (browser tests; mirrors generator split).
 * @param {Record<string, object>} itemMetadata
 * @param {{ aliasMetadata?: object, categoryTree?: object, paletteMetadata?: object }} [extras]
 */
export function seedBrowserCatalog(itemMetadata, extras = {}) {
  const byTypeName = buildItemsByTypeNameLite(itemMetadata);
  loadCatalogFromFixtures({
    itemMetadata,
    aliasMetadata: extras.aliasMetadata ?? {},
    categoryTree: extras.categoryTree ?? emptyTree,
    metadataIndexes: {
      byTypeName,
      hashMatch: { itemsByTypeName: byTypeName },
    },
    paletteMetadata: extras.paletteMetadata ?? emptyPalette,
  });
}

/** Reload dist metadata into `catalog` after specs call `resetCatalogForTests()`. */
export async function restoreAppCatalogAfterTest() {
  resetCatalogForTests();
  resetLoadAllMetadataCacheForTests();
  await loadAllMetadata();
}

/**
 * Replace `catalog` with merged dist `itemMetadata` plus `patch` (re-seed lite + index after
 * loading real dist chunks, mirroring a targeted edit to the in-memory item map).
 * Preserves dist index, palette, alias, and tree data so palette resolution matches production.
 */
export async function seedBrowserCatalogMergedOnDist(patch) {
  resetLoadAllMetadataCacheForTests();
  const loaded = await loadAllMetadata();
  const mergedItems = {
    ...mergedItemMapFromLoadedChunks(loaded),
    ...patch,
  };
  const byTypeName = buildItemsByTypeNameLite(mergedItems);
  resetCatalogForTests();
  loadCatalogFromFixtures({
    itemMetadata: mergedItems,
    aliasMetadata: loaded.aliasMetadata,
    categoryTree: loaded.categoryTree,
    metadataIndexes: {
      ...loaded.metadataIndexes,
      byTypeName,
      hashMatch: { itemsByTypeName: byTypeName },
    },
    paletteMetadata: loaded.paletteMetadata,
  });
}

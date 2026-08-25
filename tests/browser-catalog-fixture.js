import { buildItemsByTypeNameLite } from "../sources/state/resolve-hash-param.ts";
import {
  aliasMetadata,
  categoryTree,
  metadataIndexes,
} from "../index-metadata.js";
import { paletteMetadata } from "../palette-metadata.js";

const emptyPalette = { versions: {}, materials: {} };
const emptyTree = { items: [], children: {} };

/** Seed a specific catalog instance from a merged item map. */
export function seedCatalog(writer, itemMetadata, extras = {}) {
  const byTypeName = buildItemsByTypeNameLite(itemMetadata);
  writer.loadCatalogFromFixtures({
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

/** Seed fixture items while retaining generated palette, alias, tree, and index context. */
export function seedCatalogWithGeneratedContext(writer, fixtureItems) {
  const byTypeName = buildItemsByTypeNameLite(fixtureItems);
  writer.loadCatalogFromFixtures({
    itemMetadata: fixtureItems,
    aliasMetadata,
    categoryTree,
    metadataIndexes: {
      ...metadataIndexes,
      byTypeName,
      hashMatch: { itemsByTypeName: byTypeName },
    },
    paletteMetadata,
  });
}

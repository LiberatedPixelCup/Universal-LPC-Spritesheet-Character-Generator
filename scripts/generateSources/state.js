import fs from "node:fs";
import path from "node:path";
import { buildSlimByTypeNameRow } from "../../sources/state/resolve-hash-param.js";

export const SHEETS_DIR = "sheet_definitions" + path.sep;
export const PALETTES_DIR = "palette_definitions" + path.sep;
export const METADATA_OUTPUT = "item-metadata.js";
export const onlyIfTemplate = false;

export const METADATA_MODULE_BASENAMES = [
  "index-metadata.js",
  "palette-metadata.js",
  "item-metadata.js",
  "credits-metadata.js",
  "layers-metadata.js",
];

export const licensesFound = [];
export const csvList = [];
export const itemMetadata = {};
export const paletteMetadata = { versions: {}, materials: {} };
export const aliasMetadata = {};
export const categoryTree = { items: [], children: {} };

const METADATA_FILE_BANNER = `// THIS FILE IS AUTO-GENERATED. PLEASE DON'T ALTER IT MANUALLY
// Generated from sheet_definitions/*.json by scripts/generate_sources.js
`;

function clearObject(obj) {
  for (const key of Object.keys(obj)) {
    delete obj[key];
  }
}

/**
 * Clears shared generator state so repeated full runs (e.g. Vite watch without a fresh module load)
 * do not accumulate stale keys in itemMetadata and related structures.
 */
export function resetGeneratorState() {
  licensesFound.length = 0;
  csvList.length = 0;
  clearObject(itemMetadata);
  paletteMetadata.versions = {};
  paletteMetadata.materials = {};
  clearObject(aliasMetadata);
  categoryTree.items = [];
  categoryTree.children = {};
}

/**
 * @param {"development"|"production"} env
 * @returns {number|undefined} JSON.stringify indent (2 in dev, compact in prod)
 */
export function getMetadataJsonIndent(env = "production") {
  return env === "development" ? 2 : undefined;
}

/**
 * Sorts recursive directory entries by depth first, then locale-aware path name.
 * @param {{parentPath: string, name: string}} a First directory entry.
 * @param {{parentPath: string, name: string}} b Second directory entry.
 * @return {number} Sort comparator result compatible with Array.prototype.sort.
 * @throws {TypeError} If entry objects do not include expected path fields.
 */
export function sortDirTree(a, b) {
  const pa = path.join(a.parentPath, a.name);
  const pb = path.join(b.parentPath, b.name);

  const depthA = pa.split(path.sep).length;
  const depthB = pb.split(path.sep).length;
  if (depthA !== depthB) return depthA - depthB;

  return pa.localeCompare(pb, ["en"]);
}

/**
 * Reads and parses a Directory Tree and sorts it.
 * @param {string} dirToRead Absolute path to the directory to read.
 * @return {Array} Array of directory entries sorted by depth and name.
 * @throws {Error} If the directory does not exist.
 */
export function readDirTree(dirToRead) {
  return fs
    .readdirSync(dirToRead, {
      recursive: true,
      withFileTypes: true,
    })
    .sort(sortDirTree);
}

/**
 * Reads and parses a JSON file from disk.
 * @param {string} fullPath Absolute file path to the JSON file.
 * @return {Object} Parsed JSON object.
 * @throws {SyntaxError} If file contents are not valid JSON.
 * @throws {Error} If the file does not exist.
 */
export function parseJson(fullPath) {
  try {
    return JSON.parse(fs.readFileSync(fullPath));
  } catch (e) {
    console.error("Error parsing JSON from file:", fullPath);
    throw e;
  }
}

/**
 * Splits full generator item entries into lite fields, credits, and layers maps.
 * @param {Record<string, object>} fullItemMetadata
 * @returns {{ itemMetadataLite: Record<string, object>, itemCredits: Record<string, Array>, itemLayers: Record<string, object> }}
 */
export function splitItemMetadataMaps(fullItemMetadata) {
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
 * Builds `metadataIndexes.byTypeName` for path/hash helpers: `itemId`, `name`, `type_name`,
 * `variants`, and a minimal `recolors` (only `recolors[0].variants` for matching). The full
 * lite item map is emitted separately in `item-metadata.js`. `hashMatch.itemsByTypeName` shares
 * the same ordered lists as `byTypeName` (emitted as one JSON blob + shared references in JS).
 *
 * @param {Record<string, object>} fullItemMetadata
 * @param {Record<string, object>} _aliasMetadata Reserved for future alias-aware indexes.
 */
export function buildMetadataIndexes(fullItemMetadata, _aliasMetadata) {
  const keys = Object.keys(fullItemMetadata);
  const byTypeName = {};
  for (const itemId of keys) {
    const meta = fullItemMetadata[itemId];
    const t = meta.type_name;
    if (!byTypeName[t]) byTypeName[t] = [];
    byTypeName[t].push(buildSlimByTypeNameRow(itemId, meta));
  }
  return { byTypeName };
}

/**
 * Deduplicate repeated `variants` and `recolor[0].variants` across slim rows (smaller `index-metadata.js`).
 * Rows become `{ itemId, name, type_name, v, r }` indexing into the two parallel tables.
 * @param {Record<string, object[]>} byTypeNameFull  Slim rows from `buildSlimByTypeNameRow`
 * @returns {{ variantArrays: string[][], recolorVariantArrays: string[][], byTypeName: Record<string, Array<{ itemId: string, name: unknown, type_name: unknown, v: number, r: number }>> }}
 */
export function internSlimByTypeNameRows(byTypeNameFull) {
  const vKey = new Map();
  const rKey = new Map();
  const variantArrays = [];
  const recolorVariantArrays = [];

  function internVariants(variants) {
    const k = JSON.stringify(variants);
    if (!vKey.has(k)) {
      vKey.set(k, variantArrays.length);
      variantArrays.push(Array.isArray(variants) ? [...variants] : []);
    }
    return vKey.get(k);
  }

  function internRecolorVariants(recolors) {
    const v0 = recolors?.[0]?.variants;
    const arr = Array.isArray(v0) && v0.length > 0 ? [...v0] : [];
    const k = JSON.stringify(arr);
    if (!rKey.has(k)) {
      rKey.set(k, recolorVariantArrays.length);
      recolorVariantArrays.push(arr);
    }
    return rKey.get(k);
  }

  const byTypeName = {};
  for (const [t, rows] of Object.entries(byTypeNameFull)) {
    byTypeName[t] = rows.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      type_name: row.type_name,
      v: internVariants(row.variants),
      r: internRecolorVariants(row.recolors),
    }));
  }
  return { variantArrays, recolorVariantArrays, byTypeName };
}

/**
 * Drop duplicate variant strings on `recolors[0]`; runtime restores them from
 * `recolorVariantArrays[r]` in `index-metadata.js`.
 * @param {Array|undefined} recolors
 * @returns {Array}
 */
function stripRecolorEntryZeroVariantsForEmit(recolors) {
  if (!Array.isArray(recolors) || recolors.length === 0) {
    return recolors ?? [];
  }
  return recolors.map((entry, i) => {
    if (i !== 0 || !entry || typeof entry !== "object") {
      return entry;
    }
    return { ...entry, variants: [] };
  });
}

/**
 * @param {Record<string, object>} itemMetadataLite
 * @param {Record<string, { v: number, r: number, itemId: string }[]>} internedByTypeName
 * @return {Record<string, object>}
 */
function buildInternedItemMetadataLiteMap(
  itemMetadataLite,
  internedByTypeName,
) {
  const itemIdToVr = new Map();
  for (const rows of Object.values(internedByTypeName)) {
    for (const row of rows) {
      itemIdToVr.set(row.itemId, { v: row.v, r: row.r });
    }
  }
  const out = {};
  for (const [itemId, lite] of Object.entries(itemMetadataLite)) {
    const vr = itemIdToVr.get(itemId);
    if (vr == null) {
      out[itemId] = lite;
      continue;
    }
    const { variants: _dropV, recolors, ...rest } = lite;
    out[itemId] = {
      ...rest,
      v: vr.v,
      r: vr.r,
      recolors: stripRecolorEntryZeroVariantsForEmit(recolors ?? []),
    };
  }
  return out;
}

function buildNamedConstModule(constName, valueJson, exportNames) {
  const exports = exportNames.join(", ");
  return `${METADATA_FILE_BANNER}
const ${constName} = ${valueJson};

export { ${exports} };
`;
}

/**
 * @param {Record<string, object>} aliasMetadata
 * @param {Record<string, object>} categoryTree
 * @param {Record<string, object>} fullItemMetadata
 * @param {"development"|"production"} [env="production"]
 * @return {string} JavaScript module source for index-metadata.js
 */
export function buildIndexMetadataJs(
  aliasMetadata,
  categoryTree,
  fullItemMetadata,
  env = "production",
) {
  const indent = getMetadataJsonIndent(env);
  const { byTypeName: byTypeNameFull } = buildMetadataIndexes(
    fullItemMetadata,
    aliasMetadata,
  );
  const { variantArrays, recolorVariantArrays, byTypeName } =
    internSlimByTypeNameRows(byTypeNameFull);
  const variantArraysJson = JSON.stringify(variantArrays, null, indent);
  const recolorVariantArraysJson = JSON.stringify(
    recolorVariantArrays,
    null,
    indent,
  );
  const byTypeJson = JSON.stringify(byTypeName, null, indent);
  const aliasJson = JSON.stringify(aliasMetadata, null, indent);
  const treeJson = JSON.stringify(categoryTree, null, indent);

  return `${METADATA_FILE_BANNER}
const variantArrays = ${variantArraysJson};

const recolorVariantArrays = ${recolorVariantArraysJson};

const byTypeName = ${byTypeJson};

const metadataIndexes = {
  variantArrays,
  recolorVariantArrays,
  byTypeName,
  hashMatch: { itemsByTypeName: byTypeName },
};

const aliasMetadata = ${aliasJson};

const categoryTree = ${treeJson};

export { aliasMetadata, categoryTree, metadataIndexes };
`;
}

/**
 * @param {"development"|"production"} [env="production"]
 * @return {string} JavaScript module source for palette-metadata.js
 */
export function buildPaletteMetadataJs(env = "production") {
  const indent = getMetadataJsonIndent(env);
  const paletteJson = JSON.stringify(paletteMetadata, null, indent);
  return buildNamedConstModule("paletteMetadata", paletteJson, [
    "paletteMetadata",
  ]);
}

/**
 * @param {Record<string, object>} fullItemMetadata
 * @param {"development"|"production"} [env="production"]
 * @return {string} JavaScript module source for item-metadata.js (lite records only)
 */
export function buildItemMetadataLiteJs(fullItemMetadata, env = "production") {
  const indent = getMetadataJsonIndent(env);
  const { itemMetadataLite } = splitItemMetadataMaps(fullItemMetadata);
  const { byTypeName: byTypeNameFull } = buildMetadataIndexes(
    fullItemMetadata,
    {},
  );
  const { byTypeName: internedByType } =
    internSlimByTypeNameRows(byTypeNameFull);
  const internedLite = buildInternedItemMetadataLiteMap(
    itemMetadataLite,
    internedByType,
  );
  const itemJson = JSON.stringify(internedLite, null, indent);
  return buildNamedConstModule("itemMetadata", itemJson, ["itemMetadata"]);
}

/**
 * @param {Record<string, object>} fullItemMetadata
 * @param {"development"|"production"} [env="production"]
 * @return {string} JavaScript module source for credits-metadata.js
 */
export function buildCreditsMetadataJs(fullItemMetadata, env = "production") {
  const indent = getMetadataJsonIndent(env);
  const { itemCredits } = splitItemMetadataMaps(fullItemMetadata);
  const json = JSON.stringify(itemCredits, null, indent);
  return buildNamedConstModule("itemCredits", json, ["itemCredits"]);
}

/**
 * @param {Record<string, object>} fullItemMetadata
 * @param {"development"|"production"} [env="production"]
 * @return {string} JavaScript module source for layers-metadata.js
 */
export function buildLayersMetadataJs(fullItemMetadata, env = "production") {
  const indent = getMetadataJsonIndent(env);
  const { itemLayers } = splitItemMetadataMaps(fullItemMetadata);
  const json = JSON.stringify(itemLayers, null, indent);
  return buildNamedConstModule("itemLayers", json, ["itemLayers"]);
}

/**
 * @param {"development"|"production"} [env="production"]
 * @param {Record<string, object>} [sources] Defaults to shared generator state objects.
 * @returns {Map<string, string>} basename -> module source
 */
export function buildAllMetadataModules(env = "production", sources = {}) {
  const fullItems = sources.itemMetadata ?? itemMetadata;
  const aliases = sources.aliasMetadata ?? aliasMetadata;
  const tree = sources.categoryTree ?? categoryTree;

  const out = new Map();
  out.set(
    "index-metadata.js",
    buildIndexMetadataJs(aliases, tree, fullItems, env),
  );
  out.set("palette-metadata.js", buildPaletteMetadataJs(env));
  out.set("item-metadata.js", buildItemMetadataLiteJs(fullItems, env));
  out.set("credits-metadata.js", buildCreditsMetadataJs(fullItems, env));
  out.set("layers-metadata.js", buildLayersMetadataJs(fullItems, env));
  return out;
}

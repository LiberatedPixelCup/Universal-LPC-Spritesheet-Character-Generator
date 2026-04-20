import fs from "fs";
import path from "path";

export const SHEETS_DIR = "sheet_definitions" + path.sep;
export const PALETTES_DIR = "palette_definitions" + path.sep;
export const METADATA_OUTPUT = "item-metadata.js";
export const onlyIfTemplate = false;

export const licensesFound = [];
export const csvList = [];
export const itemMetadata = {};
export const paletteMetadata = { versions: {}, materials: {} };
export const aliasMetadata = {};
export const categoryTree = { items: [], children: {} };

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
 * Builds browser-side metadata bootstrap JS from shared generator state.
 * Emits an ES module (named exports) so Vite/Vitest can import it; also assigns
 * onto `window` when running in a browser so plain script or VM-style eval still works.
 * @return {string} JavaScript module source for item-metadata.js.
 */
export function buildMetadataJs() {
  const itemJson = JSON.stringify(itemMetadata, null, 2);
  const aliasJson = JSON.stringify(aliasMetadata, null, 2);
  const treeJson = JSON.stringify(categoryTree, null, 2);
  const paletteJson = JSON.stringify(paletteMetadata, null, 2);
  return `// THIS FILE IS AUTO-GENERATED. PLEASE DON'T ALTER IT MANUALLY
  // Generated from sheet_definitions/*.json by scripts/generate_sources.mjs
  // Contains metadata for all customization items to avoid DOM queries at runtime

const itemMetadata = ${itemJson};

const aliasMetadata = ${aliasJson};

const categoryTree = ${treeJson};

const paletteMetadata = ${paletteJson};

export { itemMetadata, aliasMetadata, categoryTree, paletteMetadata };

if (typeof window !== "undefined") {
  window.itemMetadata = itemMetadata;
  window.aliasMetadata = aliasMetadata;
  window.categoryTree = categoryTree;
  window.paletteMetadata = paletteMetadata;
}
`;
}

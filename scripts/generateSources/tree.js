import fs from "node:fs";
import path from "node:path";
import debugUtils from "../utils/debug.js";
import {
  categoryTree,
  itemMetadata,
  onlyIfTemplate,
  SHEETS_DIR,
} from "./state.js";

const { debugLog } = debugUtils;

/**
 * Parses category meta JSON and ensures the corresponding category tree path exists with metadata.
 * @param {string} filePath Parent directory containing the meta file.
 * @param {string} fileName Meta filename to parse.
 * @param {{sheetsDir?: string}} [options] Optional parser options.
 * @param {string} [options.sheetsDir] Sheets root used for relative path normalization.
 * @return {Object} The final tree node corresponding to filePath.
 * @throws {SyntaxError} If the category meta file JSON is malformed.
 */
export function parseTree(filePath, fileName, options = {}) {
  const { sheetsDir = SHEETS_DIR } = options;

  const fullPath = path.join(filePath, fileName);
  if (!onlyIfTemplate) debugLog(`Parsing tree ${fullPath}`);

  let meta = null;
  try {
    meta = JSON.parse(fs.readFileSync(fullPath));
  } catch (e) {
    console.error("Error parsing json from category file ", fullPath);
    throw e;
  }

  const { label, priority, required, animations } = meta;

  let current = categoryTree;
  const categoryPath = path
    .relative(sheetsDir, filePath)
    .split(path.sep)
    .filter(Boolean);
  const treeId = filePath.split(path.sep).pop();

  for (const segment of categoryPath) {
    if (!current.children[segment]) {
      current.children[segment] = {
        items: [],
        children: {},
      };

      if (segment === treeId) {
        current.children[segment].label = label;
        current.children[segment].priority = priority || null;
        current.children[segment].required = required || [];
        current.children[segment].animations = animations || [];
      }
    }
    current = current.children[segment];
  }

  return current;
}

/**
 * Recursively sorts category tree children and item lists by priority and display name.
 * @param {{items?: Array<string>, children?: Object<string, Object>, priority?: number, label?: string}} node Tree node to sort.
 * @param {Object<string, Object>} itemMetadata Item metadata map used for item sorting.
 * @return {Object} The same node instance after in-place sorting.
 * @throws {TypeError} If node structure is invalid and sortable collections are not iterable.
 */
export function sortCategoryTree(node, itemMetadata) {
  const sortedChildren = Object.entries(node.children || {}).sort(
    ([keyA, valA], [keyB, valB]) => {
      const a = valA.priority ?? Number.POSITIVE_INFINITY;
      const b = valB.priority ?? Number.POSITIVE_INFINITY;
      if (a !== b) return a - b;
      const labelA = valA.label ?? keyA;
      const labelB = valB.label ?? keyB;
      return labelA.localeCompare(labelB, ["en"]);
    },
  );

  const reordered = {};
  for (const [key, child] of sortedChildren) {
    sortCategoryTree(child, itemMetadata);
    reordered[key] = child;
  }
  node.children = reordered;

  if (node.items) {
    node.items.sort((idA, idB) => {
      const metaA = itemMetadata[idA] || {};
      const metaB = itemMetadata[idB] || {};
      const a = metaA.priority ?? Number.POSITIVE_INFINITY;
      const b = metaB.priority ?? Number.POSITIVE_INFINITY;
      if (a !== b) return a - b;
      const nameA = metaA.name ?? idA;
      const nameB = metaB.name ?? idB;
      return nameA.localeCompare(nameB, ["en"]);
    });
  }

  return node;
}

/**
 * Populates category tree item lists from metadata paths and sorts the tree in place.
 * @return {{items?: Array<string>, children: Object<string, Object>}} The shared category tree after population and sorting.
 */
export function populateAndSortCategoryTree() {
  for (const [itemId, meta] of Object.entries(itemMetadata)) {
    const itemPath = meta.path || ["Other"];

    // Use only category segments; final segment is an item-specific leaf identifier.
    const categoryPath = itemPath.slice(0, -1);

    let current = categoryTree;
    for (const segment of categoryPath) {
      if (!current.children[segment]) {
        current.children[segment] = { items: [], children: {} };
      }
      current = current.children[segment];
    }

    if (!Array.isArray(current.items)) {
      current.items = [];
    }
    current.items.push(itemId);
  }

  return sortCategoryTree(categoryTree, itemMetadata);
}

import fs from "node:fs";
import path from "node:path";
import debugUtils from "../utils/debug.ts";
import {
  categoryTree,
  itemMetadata,
  onlyIfTemplate,
  SHEETS_DIR,
  type GeneratorItem,
  type GeneratorTreeNode,
} from "./state.ts";

const { debugLog } = debugUtils;

type CategoryMeta = {
  label?: string;
  priority?: number | null;
  required?: string[];
  animations?: string[];
};

/**
 * Parses category meta JSON and ensures the corresponding category tree path exists with metadata.
 */
export function parseTree(
  filePath: string,
  fileName: string,
  options: { sheetsDir?: string } = {},
): GeneratorTreeNode {
  const { sheetsDir = SHEETS_DIR } = options;

  const fullPath = path.join(filePath, fileName);
  if (!onlyIfTemplate) debugLog(`Parsing tree ${fullPath}`);

  let meta: CategoryMeta;
  try {
    meta = JSON.parse(
      fs.readFileSync(fullPath) as unknown as string,
    ) as CategoryMeta;
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
    const children = current.children!;
    if (!children[segment]) {
      children[segment] = {
        items: [],
        children: {},
      };

      if (segment === treeId) {
        children[segment].label = label;
        children[segment].priority = priority || null;
        children[segment].required = required || [];
        children[segment].animations = animations || [];
      }
    }
    current = children[segment];
  }

  return current;
}

/**
 * Recursively sorts category tree children and item lists by priority and display name.
 */
export function sortCategoryTree(
  node: GeneratorTreeNode,
  itemMetadataMap: Record<string, GeneratorItem>,
): GeneratorTreeNode {
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

  const reordered: Record<string, GeneratorTreeNode> = {};
  for (const [key, child] of sortedChildren) {
    sortCategoryTree(child, itemMetadataMap);
    reordered[key] = child;
  }
  node.children = reordered;

  if (node.items) {
    node.items.sort((idA, idB) => {
      const metaA = itemMetadataMap[idA] || {};
      const metaB = itemMetadataMap[idB] || {};
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
 */
export function populateAndSortCategoryTree(): GeneratorTreeNode {
  for (const [itemId, meta] of Object.entries(itemMetadata)) {
    const itemPath = meta.path || ["Other"];

    // Use only category segments; final segment is an item-specific leaf identifier.
    const categoryPath = itemPath.slice(0, -1);

    let current = categoryTree;
    for (const segment of categoryPath) {
      const children = current.children!;
      if (!children[segment]) {
        children[segment] = { items: [], children: {} };
      }
      current = children[segment];
    }

    if (!Array.isArray(current.items)) {
      current.items = [];
    }
    current.items.push(itemId);
  }

  return sortCategoryTree(categoryTree, itemMetadata);
}

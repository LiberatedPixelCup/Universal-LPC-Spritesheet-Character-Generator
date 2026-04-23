import path from "path";
import debugUtils from "../utils/debug.js";
import {
  ANIMATION_DEFAULTS,
  BODY_TYPES,
} from "../../sources/state/constants.ts";
import { writeAliases } from "./aliases.mjs";
import { normalizeRecolors } from "./item-helper.mjs";
import {
  itemMetadata,
  onlyIfTemplate,
  parseJson,
  SHEETS_DIR,
} from "./state.mjs";

const { debugLog } = debugUtils;

/**
 * Computes required body types by checking the first layer entries present in the definition.
 * @param {Object} definition Parsed sheet definition JSON.
 * @return {string[]} Ordered list of required body types found in layer_1.
 */
export function getRequiredSexes(definition) {
  const requiredSexes = [];
  for (const sex of BODY_TYPES) {
    if (definition.layer_1[sex]) {
      requiredSexes.push(sex);
    }
  }
  return requiredSexes;
}

/**
 * Builds an item path array relative to the active sheets directory.
 * @param {string} filePath Parent path containing the current sheet file.
 * @param {string} itemId Unique item identifier derived from filename.
 * @param {string} sheetsDir Base sheets directory used for relative path derivation.
 * @return {string[]} Path segments from sheets root to the item.
 */
export function buildTreePath(filePath, itemId, sheetsDir) {
  const treePath = path.relative(sheetsDir, filePath).split(path.sep).filter(Boolean);
  treePath.push(itemId);
  return treePath;
}

/**
 * Collects contiguous layer definitions from layer_1 through layer_9.
 * @param {Object} definition Parsed sheet definition JSON.
 * @return {Object<string, Object>} Layer map keyed by layer name.
 */
export function collectLayers(definition) {
  const layers = {};
  for (let i = 1; i < 10; i++) {
    const layerDef = definition[`layer_${i}`];
    if (layerDef) {
      layers[`layer_${i}`] = layerDef;
    } else {
      break;
    }
  }
  return layers;
}

/**
 * Parses one sheet definition file and writes normalized item metadata into shared state.
 * @param {string} filePath Parent directory path of the target definition file.
 * @param {string} fileName Target definition filename.
 * @param {{sheetsDir?: string}} [options] Optional parser options.
 * @param {string} [options.sheetsDir] Sheets root used for relative path normalization.
 * @return {{itemId: string, definition: Object}} Parsed item context used by downstream credits processing.
 * @throws {SyntaxError} When the sheet JSON file content cannot be parsed.
 * @throws {Error} When the item is ignored.
 */
export function parseItem(filePath, fileName, options = {}) {
  const { sheetsDir = SHEETS_DIR } = options;
  const fullPath = path.join(filePath, fileName);
  const itemId = fileName.replace(".json", "");
  if (!onlyIfTemplate) debugLog(`Parsing ${fullPath}`);

  // Read JSON Definition
  const definition = parseJson(fullPath);

  // Skip Ignored Items
  if (definition.ignore) {
    throw Error(`Skipping ignored item: ${itemId}`);
  }

  const requiredSexes = getRequiredSexes(definition);

  // Build unique itemId from filename (not from path or type_name)
  // This ensures each item has a unique ID even if they share the same type_name
  const treePath = definition.path ?? buildTreePath(filePath, itemId, sheetsDir);

  // Collect layer information (file paths and zPos)
  const layers = collectLayers(definition);

  // Collect recolor information
  const recolors = normalizeRecolors(definition);

  // Collect metadata for this item
  itemMetadata[itemId] = {
    name: definition.name,
    priority: definition.priority || null,
    type_name: definition.type_name,
    required: requiredSexes,
    animations: definition.animations ?? ANIMATION_DEFAULTS,
    tags: definition.tags ?? [],
    required_tags: definition.required_tags ?? [],
    excluded_tags: definition.excluded_tags ?? [],
    path: treePath ?? ["other"],
    replace_in_path: definition.replace_in_path ?? {},
    variants: definition.variants ?? [],
    layers: layers,
    credits: definition.credits ?? [],
    preview_row: definition.preview_row ?? 2,
    preview_column: definition.preview_column ?? 0,
    preview_x_offset: definition.preview_x_offset ?? 0,
    preview_y_offset: definition.preview_y_offset ?? 0,
    matchBodyColor: definition.match_body_color ?? false,
    recolors: recolors ?? [],
  };

  // Process alias definitions for this item (for backward compatibility)
  if (definition.aliases) {
    writeAliases(definition.aliases, itemMetadata[itemId]);
  }

  return {
    itemId,
    definition,
  };
}

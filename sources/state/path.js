import "../install-item-metadata.js";
import { ANIMATIONS } from "./constants.js";
import { getHashParamsforSelections } from "./hash.js";
import { variantToFilename, es6DynamicTemplate } from "../utils/helpers.js";
import { debugLog } from "../utils/debug.js";

// Dependency injection for testability (see setPathDeps / resetPathDeps)
function createDefaultPathDeps() {
  return {
    getHashParamsforSelections,
    variantToFilename,
    es6DynamicTemplate,
    debugLog,
    animations: ANIMATIONS,
    getItemMetadata: (itemId) => window.itemMetadata?.[itemId],
  };
}

let pathDeps = createDefaultPathDeps();

export function setPathDeps(overrides) {
  Object.assign(pathDeps, overrides);
}

export function resetPathDeps() {
  pathDeps = createDefaultPathDeps();
}

export function getPathDeps() {
  return pathDeps;
}

/**
 * Extract base asset name from a nameAndVariant string (e.g. selection id suffix).
 * Both names and variants may contain underscores; this uses catalog variants/recolors
 * to find the longest matching suffix.
 *
 * @param {string} nameAndVariant
 * @param {Array<object>} itemsForType Item metadata entries for this type_name
 * @returns {string}
 */
// This is way too complex because both names and variants can have underscores in them
// Perhaps we should change the naming convention to avoid this ambiguity
// e.g. use double underscore to separate name and variant in item ids
export function getNameWithoutVariant(nameAndVariant, itemsForType) {
  let variant = "";
  const nameAndVariantPath = nameAndVariant.split("_");
  const l = nameAndVariantPath.length;
  const names = itemsForType || [];
  const variants = names
    .flatMap((n) => n.variants || [])
    .map((v) => v.toLowerCase());
  const recolors = names
    .flatMap((n) => n.recolors?.[0]?.variants || [])
    .map((v) => v.toLowerCase());
  let j = l;
  let v = 0;
  while (--j > 0) {
    const part = nameAndVariantPath.slice(j, l).join("_");
    const hasPart = (flatMap, part) => flatMap?.includes(part.toLowerCase());
    if (hasPart(variants, part) || hasPart(recolors, part)) {
      variant = part;
      v = j;
    }
  }
  const name = variant
    ? nameAndVariantPath.slice(0, v).join("_")
    : nameAndVariantPath.slice(0, l - 1).join("_");
  return name;
}

/**
 * Build sprite path from item metadata for a specific animation
 */
export function getSpritePath(
  itemId,
  variant,
  recolors,
  bodyType,
  animName,
  layerNum = 1,
  selections = {},
  meta = null,
) {
  if (!meta) {
    meta = pathDeps.getItemMetadata(itemId);
  }
  if (!meta) return null;

  const layerKey = `layer_${layerNum}`;
  const layer = meta.layers?.[layerKey];
  if (!layer) return null;

  // Get the file path for this body type
  let basePath = layer[bodyType];
  if (!basePath) return null;

  // Replace template variables like ${head}
  if (basePath.includes("${")) {
    basePath = replaceInPath(basePath, selections, meta);
  }

  // If no variant specified, try to extract from itemId
  if (!variant && !recolors) {
    const parts = itemId.split("_");
    variant = parts[parts.length - 1];
  }

  // Determine animation name to use in path
  const animation = pathDeps.animations.find((a) => a.value === animName);
  if (animation?.folderName) {
    animName = animation.folderName;
  }

  // Build full path: spritesheets/ + basePath + animation/ + variant.png
  const fileName = !recolors ? `/${pathDeps.variantToFilename(variant)}` : "";
  return `spritesheets/${basePath}${animName}${fileName}.png`;
}

// Replace template variables like ${head} in a path using current selections
export function replaceInPath(path, selections, meta) {
  if (path.includes("${")) {
    // get params from selections
    // TODO: this could be optimized to avoid recomputing every time
    // or to only do it when relevant selections change
    // or just use the selections directly instead of recomputing the hash params
    const hashParams = pathDeps.getHashParamsforSelections(selections || {});
    const replacements = Object.fromEntries(
      Object.entries(hashParams).map(([typeName, nameAndVariant]) => {
        const name = _getNameWithoutVariant(typeName, nameAndVariant);
        const replacement = meta.replace_in_path[typeName]?.[name];
        if (path.includes(`\${${typeName}}`) && !replacement) {
          pathDeps.debugLog(
            `Warning: No replacement found for ${typeName}="${name}" in path template.`,
          );
        }
        return [typeName, replacement];
      }),
    );

    return pathDeps.es6DynamicTemplate(path, replacements);
  }

  return path;
}

const indexedMetadataCache = new Map();

for (const key of Object.keys(window.itemMetadata || {})) {
  const item = window.itemMetadata[key];
  const indexKey = item.type_name;
  if (indexedMetadataCache.has(indexKey)) {
    const existing = indexedMetadataCache.get(indexKey);
    existing.push(item);
  } else {
    indexedMetadataCache.set(indexKey, [item]);
  }
}

function _getNameWithoutVariant(typeName, nameAndVariant) {
  const itemsForType = indexedMetadataCache.get(typeName) || [];
  return getNameWithoutVariant(nameAndVariant, itemsForType);
}

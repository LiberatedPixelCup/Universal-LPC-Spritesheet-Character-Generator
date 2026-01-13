import { ANIMATIONS } from './constants.js';
import { getHashParamsforSelections } from './hash.js';
import { variantToFilename, es6DynamicTemplate } from '../utils/helpers.js';

/**
 * Build sprite path from item metadata for a specific animation
 */
export function getSpritePath(itemId, variant, bodyType, animName, layerNum = 1, selections = {}, meta = null) {
  if (!meta) {
    meta = window.itemMetadata[itemId];
  }
  if (!meta) return null;

  const layerKey = `layer_${layerNum}`;
  const layer = meta.layers?.[layerKey];
  if (!layer) return null;

  // Get the file path for this body type
  let basePath = layer[bodyType];
  if (!basePath) return null;

  // Replace template variables like ${head}
  if (basePath.includes('${')) {
	basePath = replaceInPath(basePath, selections, meta);
  }

  // If no variant specified, try to extract from itemId
  if (!variant) {
    const parts = itemId.split('_');
    variant = parts[parts.length - 1];
  }

  // Determine animation name to use in path
  const animation = ANIMATIONS.find(a => a.value === animName);
  if (animation?.folderName) {
	animName = animation.folderName;
  }

  // Build full path: spritesheets/ + basePath + animation/ + variant.png
  return `spritesheets/${basePath}${animName}/${variantToFilename(variant)}.png`;
}

// Replace template variables like ${head} in a path using current selections
export function replaceInPath(path, selections, meta) {
	if (path.includes("${")) {
		// get params from selections
		// TODO: this could be optimized to avoid recomputing every time
		// or to only do it when relevant selections change
		// or just use the selections directly instead of recomputing the hash params
		const hashParams = getHashParamsforSelections(selections || {});
		const replacements = Object.fromEntries(
			Object.entries(hashParams).map(([typeName, nameAndVariant]) => {
				const name = getNameWithoutVariant(typeName, nameAndVariant);
				const replacement = meta.replace_in_path[typeName]?.[name];
				if (window.DEBUG) {
					if (path.includes(`\${${typeName}}`) && !replacement) {
						console.log(`Warning: No replacement found for ${typeName}="${name}" in path template.`);
					}
				}
				return [typeName, replacement];
			}),
		);

		return es6DynamicTemplate(path, replacements);
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

// Helper to extract name without variant from a nameAndVariant string
// This is way too complex because both names and variants can have underscores in them
// Perhaps we should change the naming convention to avoid this ambiguity
// e.g. use double underscore to separate name and variant in item ids
function getNameWithoutVariant(typeName, nameAndVariant) {
	let variant = '';
	const nameAndVariantPath = nameAndVariant.split('_');
	const l = nameAndVariantPath.length;
	const names = indexedMetadataCache.get(typeName) || [];
	const variants = names.flatMap(n => n.variants || []).map(v => v.toLowerCase());
	let j = l;
	let v = 0;
	while (--j > 0) {
		const part = nameAndVariantPath.slice(j, l).join('_');
		if (variants?.includes(part.toLowerCase())) {
			variant = part;
			v = j;
		}
	}
	const name = variant ? nameAndVariantPath.slice(0, v).join('_') : nameAndVariantPath.slice(0, l - 1).join('_');
	return name;
}


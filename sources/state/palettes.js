// Palette utilities
import { state, getSelectionGroup } from "./state.js";
import { replaceInPath } from './path.js';

/**
 * Function to get multiple recolor options from selections.
 * @param {string} itemId - The ID of the item to get recolors for
 * @param {Array} selections - The array of selections to filter
 * @returns {Object} An object mapping type_name to recolor
 */
export function getMultiRecolors(itemId, selections) {
    // Implementation for getting multiple recolor options from selections
    const meta = window.itemMetadata[itemId];
    const types = [meta.type_name];
    meta.recolors.forEach(recolor => {
        if (recolor.type_name && !types.includes(recolor.type_name)) {
            types.push(recolor.type_name);
        }
    });

    // Filter Selections to Item ID
    const recolors = {};
    for (const [type, selection] of Object.entries(selections)) {
        const subMeta = window.itemMetadata?.[selection.itemId];
        const typeName = subMeta?.recolors[selection.subId]?.type_name ?? subMeta?.type_name ?? meta.type_name;
        if (!subMeta || !subMeta.type_name || !types.includes(typeName) || !subMeta.recolors?.length) continue;

        // Process Each Item
        if (selection.subId) {
            recolors[typeName] = selection.recolor;
        } else if(selection.recolor) {
            recolors[subMeta.type_name] = selection.recolor;
        }
    }

    // No Results?!
    if (meta.matchBodyColor) {
        const bodyColor = getBodyColor(itemId, selections);
        if (bodyColor) recolors[meta.type_name] = bodyColor;
    }
    return Object.keys(recolors).length > 0 ? recolors : null;
}

/**
 * Function to find body color from selections if match body color enabled
 * @param {string} itemId - The ID of the item to get recolors for
 * @param {Array} selections - The array of selections to filter
 * @returns {string|null} Body color if match body color enabled on itemId, null otherwise
 */
export function getBodyColor(itemId, selections) {
    // Implementation for finding body color from selections if match body color enabled
    const meta = window.itemMetadata[itemId];
    if (!meta || !meta.matchBodyColor) {
        return null;
    }

    // Filter Selections to Item ID
    let bodyColor = null;
    for (const [typeName, selection] of Object.entries(selections)) {
        const subMeta = window.itemMetadata?.[selection.itemId];
        if (subMeta && subMeta.matchBodyColor) {
            bodyColor = selection.recolor;
            break;
        }
    }
    return bodyColor;
}

/**
 * Function to get palette file info
 * @param {string} material - Material name / identifier
 * @param {string|null} base - The source recolor to convert from; if null, uses the default base recolor
 * @param {Array|null} source - If base is custom, source will return the array of colors to convert from; if null, uses the default base recolor
 * @returns {Array[version, recolor, Array<colors>]} Return list of base palette assets including version, color name, and array of hex colors
 */
export function getBasePalette(material, base = null, source = null) {
    // Check Palette Material Exists
    const materialMeta = window.paletteMetadata?.materials[material];
    if (!materialMeta) {
        console.error(`Palettes for ${material} not found`);
        return null;
    }

    // If source provided, used that directly for the color array
    if (source !== null) {
        return [material, base, source];
    }

    // Determine Base Variant
    let [version, recolor] = base ? base.split(".") : [materialMeta.default, materialMeta.base];
    const colors = materialMeta.palettes[version]?.[recolor];
    return [version, recolor, colors];
}

/**
 * Function to get palette file info
 * @param {string} material - Material name / identifier
 * @param {string} targetColor - The target recolor to retrieve
 * @returns {Array} Array of colors for the target palette
 */
export function getTargetPalette(material, targetColor) {
    // Check Palette Material Exists
    let materialMeta = window.paletteMetadata?.materials[material];
    if (!materialMeta) {
        console.error(`Palettes for ${material} not found`);
        return null;
    }

    // Parse Recolor Key
    let [newMat, version, recolor] = parseRecolorKey(targetColor, materialMeta);
    if(newMat !== null) {
        const newMaterialMeta = window.paletteMetadata?.materials[newMat];
        if (newMaterialMeta) {
            material = newMat;
            materialMeta = newMaterialMeta;
        }
    }

    // Get Palette Info
    const colors = materialMeta.palettes[version]?.[recolor];
    if (!colors) {
        console.error(`Palette colors for ${material}.${version}.${recolor} not found`);
        return null;
    }
    return colors;
}

/**
 * Get palette configuration for an item from its metadata
 * @param {string} itemId - Item identifier
 * @param {Object} meta - Item metadata
 * @returns {Object|null} Palette config object with {type, base, palette} or null if item doesn't use palette recoloring
 */
export function getPalettesForItem(itemId, meta) {
  if (!meta || !meta.recolors) return null;

  // Get Specific Palette for Item
  const sources = {};
  for (const palette of meta.recolors) {
    const [version, source, colors] = getBasePalette(palette.material, palette.base ?? null, palette.source ?? null);
    sources[palette.type_name ?? meta.type_name] = {
        material: palette.material,
        version: version || palette.default,
        source,
        colors
    };
  }
  return sources;
}

/**
 * Get palette options for item ID, its meta data, and the selection group it belongs to
 * @param {string} itemId 
 * @param {Object} meta 
 * @returns {Array} Array of palette options for the item
 */
export function getPaletteOptions(itemId, meta) {
    // Initialize Palette Options
    const selectionGroup = getSelectionGroup(itemId);
    const paletteOptions = [];
    const bodyColor = getBodyColor(itemId, state.selections);
    if (meta.recolors && meta.recolors.length > 0) {
        meta.recolors.forEach((color, idx) => {
            const subGroup = idx !== 0 ? color.type_name : selectionGroup;
            const selection = state.selections[subGroup];
            const versions = Object.keys(color.palettes);
            let selectedColor = selection?.recolor;
            if (!selectedColor) {
                if (idx !== 0) {
                    selectedColor = color.matchBodyColor ? bodyColor : null;
                } else {
                    selectedColor = bodyColor ?? null;
                }
            }

            // Get Recolors from Selection
            const [material, version, recolor] = parseRecolorKey(selectedColor, color);
            paletteOptions.push({
                idx,
                label: color.label,
                default: color.default,
                material: color.material,
                type_name: color.type_name ?? null,
                matchBodyColor: color.matchBodyColor ?? false,
                versions,
                selectionColor: selectedColor,
                colors: getTargetPalette(material, `${version}.${recolor}`)
            });
        });
    }
    return paletteOptions;
}

/**
 * Parse the Recolor Key to Extract Material, Version, and Recolor
 * @param {string} recolorKey Recolor Key to parse (either "material.version.recolor" or "version.recolor" or "recolor")
 * @param {Object} palette - Palette metadata object
 * @returns {Array} [material, version, recolor]
 */
export function parseRecolorKey(recolorKey, palette) {
    if (!recolorKey) recolorKey = palette?.base;
    let [recolor, version, material] = recolorKey.split(".").reverse();
    if (!material) {
        material = palette?.material;
    }
    if (!version) {
        version = palette?.default;
    }
    return [material, version, recolor];
}
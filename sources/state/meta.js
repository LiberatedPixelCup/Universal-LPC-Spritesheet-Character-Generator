import { getZPos } from '../canvas/canvas-utils.js';
import { variantToFilename } from '../utils/helpers.js';
import { replaceInPath } from './path.js';

/**
 * Sort Layers by zPos
 * 
 * @param {string} itemId - The ID of the item to get layers for
 * @param {boolean} standardOnly - If true, only include standard animation layers
 * @returns {Array} Sorted array of layers with layerNum and zPos
 */
export function getSortedLayers(itemId, standardOnly = false) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error('Item metadata not found:', itemId);
    return null;
  }
  
  // Build list of layers for itemId
  const layersList = [];
  for (let layerNum = 1; layerNum < 10; layerNum++) {
    const layerKey = `layer_${layerNum}`;
    const layer = meta.layers?.[layerKey];
    if (!layer) break;
    if (standardOnly && layer.custom_animation) continue;

    const zPos = getZPos(itemId, layerNum);

    layersList.push({ layerNum, zPos });
  }

  // Sort by animation first, then by zPos
  layersList.sort((a, b) => {
    return a.zPos - b.zPos;
  });
  return layersList;
}

/**
 * Split Layers by Animation Type, Then Sort by zPos
 * 
 * @param {string} itemId - The ID of the item to get layers for
 * @param {boolean} customOnly - If true, only include custom animation layers
 * @returns {Object} Object with animation names as keys and sorted arrays of layers
 */
export function getSortedLayersByAnim(itemId, customOnly = false) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error('Item metadata not found:', itemId);
    return null;
  }
  
  // Build list of layers for itemId
  const animsList = {};
  for (let layerNum = 1; layerNum < 10; layerNum++) {
    const layerKey = `layer_${layerNum}`;
    const layer = meta.layers?.[layerKey];
    if (!layer) break;
    if (customOnly && !layer.custom_animation) continue;

    const animName = layer.custom_animation || 'standard';
    if (!animsList[animName]) {
      animsList[animName] = [];
    }

    const zPos = getZPos(itemId, layerNum);

    animsList[animName].push({ layerNum, zPos });
  }

  // Sort Each Animation's Layers By zPos
  for (const animName in animsList) {
    animsList[animName] = animsList[animName].sort((a, b) => {
      return a.zPos - b.zPos;
    }).map((layer, index) => {
      return { layerNum: layer.layerNum, animLayerNum: index + 1, zPos: layer.zPos };
    });
  }

  return animsList;
}

/**
 * Get Layers to Load for the given metadata and variant
 * @param {Object} meta - Metadata for the asset
 * @param {string} bodyType - The body type that is currently selected
 * @param {Object} selections - Currently selected assets
 * @param {string|null} variant - Variant name for the asset (optional)
 * @return {Array} Array of layers to load
 */
export function getLayersToLoad(meta, bodyType, selections, variant = null) {
  // Check if this item uses a custom animation
  const layer1 = meta.layers?.layer_1;
  const hasCustomAnimation = layer1?.custom_animation;
  const layer1CustomAnimation = hasCustomAnimation ? layer1.custom_animation : null;

  // Collect all layers for this item
  // Only include layers that match layer_1's custom animation (if any)
  const layersToLoad = [];
  for (let layerNum = 1; layerNum < 10; layerNum++) {
    const layer = meta.layers?.[`layer_${layerNum}`];
    if (!layer) break;

    let layerPath = layer[bodyType];
    if (!layerPath) continue;

    // Filter: only include layers with matching custom animation
    if (layer1CustomAnimation) {
      if (layer.custom_animation !== layer1CustomAnimation) {
        continue; // Skip layers with different custom animations
      }
    }

    // Replace template variables like ${head}
    if (layerPath.includes('${')) {
      layerPath = replaceInPath(layerPath, selections, meta);
    }

    const hasCustomAnim = layer.custom_animation;
    let imagePath;
    const variantFileName = variant !== null ? `${variantToFilename(variant)}` : '';
    if (hasCustomAnim) {
      imagePath = `spritesheets/${layerPath}${variantFileName}.png`;
    } else {
      const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
      imagePath = `spritesheets/${layerPath}${defaultAnim}${variantFileName ? `/${variantFileName}` : ''}.png`;
    }

    layersToLoad.push({
      zPos: layer.zPos ?? 100,
      path: imagePath
    });
  }
  return layersToLoad.sort((a, b) => a.zPos - b.zPos);
}
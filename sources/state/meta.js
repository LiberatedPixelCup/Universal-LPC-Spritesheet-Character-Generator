import { getZPos } from '../canvas/canvas-utils.js';

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
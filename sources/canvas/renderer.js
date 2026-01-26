// Canvas rendering module for Mithril UI
// Simplified renderer that draws character sprites based on selections

import { loadImage, loadImagesInParallel } from "./load-image.js";
import { getSpritePath } from "../state/path.js";
import { getImageToDraw } from './palette-recolor.js';
import { get2DContext, getZPos } from "./canvas-utils.js";
import { variantToFilename } from "../utils/helpers.js";
import { drawFramesToCustomAnimation } from "./draw-frames.js";
import {
  FRAME_SIZE,
  ANIMATION_OFFSETS,
  ANIMATION_CONFIGS,
} from "../state/constants.js";
import { customAnimations, customAnimationBase } from "../custom-animations.js";
import {
  setCurrentCustomAnimations,
  setCustomAnimYPositions,
} from "./preview-animation.js";
import { getSortedLayersByAnim } from "../state/meta.js";

export const SHEET_HEIGHT = 3456; // Full universal sheet height
export const SHEET_WIDTH = 832; // 13 frames * 64px

let canvas = null;
let ctx = null;
let layers = [];
let itemsToDraw = [];
let addedCustomAnimations = new Set();
let customAreaItems = {};

/**
 * Initialize the canvas (creates offscreen canvas)
 */
export function initCanvas() {
  canvas = document.createElement("canvas");
  ctx = get2DContext(canvas);
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
}

export {
  canvas,
  ctx,
  layers,
  addedCustomAnimations,
  itemsToDraw,
  customAreaItems,
};

/**
 * Render character based on selections
 * @param {Object} selections - Selected items
 * @param {string} bodyType - Body type
 * @param {HTMLCanvasElement} targetCanvas - Canvas to render to (defaults to main canvas)
 */
export async function renderCharacter(
  selections,
  bodyType,
  targetCanvas = null
) {
  // Mark start for profiling
  const profiler = window.profiler;
  if (profiler) {
    profiler.mark("renderCharacter:start");
  }

  // Use provided canvas or default to main canvas
  const renderCanvas = targetCanvas || canvas;
  const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });

  if (!renderCanvas || !renderCtx) {
    console.error("Canvas not initialized");
    return;
  }

  // Build list of items to draw
  itemsToDraw = [];
  const customAnimationItems = []; // Track items with custom animations
  addedCustomAnimations = new Set(); // Track which custom animations we've added

  // Import state to access custom uploaded image
  const appState = await import('../state/state.js').then(m => m.state);
  appState.isRenderingCharacter = true;
  m.redraw();

  try {
    // Use provided canvas or default to main canvas
    const renderCanvas = targetCanvas || canvas;
    const renderCtx = get2DContext(renderCanvas);

    if (!renderCanvas || !renderCtx) {
      console.error("Canvas not initialized");
      return;
    }

    // Build list of items to draw
    const itemsToDraw = [];
    const customAnimationItems = []; // Track items with custom animations
    const addedCustomAnimations = new Set(); // Track which custom animations we've added

    for (const [categoryPath, selection] of Object.entries(selections)) {
      const { itemId, variant } = selection;
      const meta = window.itemMetadata[itemId];

      if (!meta) continue;

      // Check if this body type is supported
      if (!meta.required.includes(bodyType)) {
        continue;
      }

      // Process all layers for this item
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        // Check if this layer exists
        const layerKey = `layer_${layerNum}`;
        const layer = meta.layers?.[layerKey];
        if (!layer) break;

        const zPos = getZPos(itemId, layerNum);

        // Check if this layer has a custom animation
        if (layer.custom_animation) {
          const customAnimName = layer.custom_animation;
          addedCustomAnimations.add(customAnimName);

          // Get base path for this body type
          let basePath = layer[bodyType];
          if (!basePath) {
            continue;
          }

          // Custom animations use direct file path
          const spritePath = `spritesheets/${basePath}${variantToFilename(
            variant
          )}.png`;

          customAnimationItems.push({
            itemId,
            variant,
            spritePath,
            zPos,
            layerNum,
            customAnimation: customAnimName,
            isCustom: true,
          });

          continue; // Skip standard animation processing for this layer
        }

        // Process standard animations for this layer
        for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
          // Skip if item doesn't have animations array (custom animations only)
          if (!meta.animations || meta.animations.length === 0) {
            continue;
          }

          // Map folder name to metadata name for checking support
          // e.g., "combat_idle" -> check for "combat" or "1h_slash" in metadata
          let metadataAnimName = animName;
          if (animName === "combat_idle") {
            // combat_idle is supported if item has "combat" in metadata
            if (!meta.animations.includes("combat")) continue;
          } else if (animName === "backslash") {
            // backslash is supported if item has "1h_slash" OR "1h_backslash" in metadata
            if (
              !meta.animations.includes("1h_slash") &&
              !meta.animations.includes("1h_backslash")
            )
              continue;
          } else if (animName === "halfslash") {
            // halfslash is supported if item has "1h_halfslash" in metadata
            if (!meta.animations.includes("1h_halfslash")) continue;
          } else {
            // For all other animations, direct match required
            if (!meta.animations.includes(animName)) continue;
          }

          const spritePath = getSpritePath(
            itemId,
            variant,
            bodyType,
            animName,
            layerNum,
            selections,
            meta
          );

          itemsToDraw.push({
            itemId,
            variant,
            spritePath,
            zPos,
            layerNum,
            animation: animName,
            yPos,
            isCustom: false,
            needsRecolor: itemId === 'body-body' && variant !== 'light' // Flag body variants for recoloring
          });
        }
      }
    }

    // Add custom uploaded image to itemsToDraw if present
    if (appState.customUploadedImage) {
      // Add custom image to be drawn at all standard animation positions
      for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
        itemsToDraw.push({
          itemId: "custom-upload",
          variant: null,
          spritePath: null, // Will draw directly from Image object
          zPos: appState.customImageZPos,
          layerNum: 0,
          animation: animName,
          yPos,
          isCustom: false,
          customImage: appState.customUploadedImage, // Store the Image object
        });
      }
    }

    // Sort standard items by zPos only (lower zPos = drawn first = behind)
    // This ensures shadow (zPos=0) is drawn before body (zPos=10), etc.
    itemsToDraw.sort((a, b) => a.zPos - b.zPos);

    // save layers for external access
    layers = itemsToDraw
      .map((item) => {
        const layer = Object.assign({}, item);
        layer.fileName = item.spritePath.substring("spritesheets/".length);
        delete layer.spritePath;
        return layer;
      })
      .reduce((acc, layer) => {
        const animation = layer.animation;
        const accLayer = acc.find(
          (l) => l.itemId === layer.itemId && l.layerNum === layer.layerNum
        );
        if (!accLayer) {
          layer.supportedAnimations = [animation];
          delete layer.animation;
          acc.push(layer);
        } else {
          accLayer.supportedAnimations.push(animation);
        }
        return acc;
      }, []);

    // Calculate total canvas height needed (standard sheet + custom animations)
    let totalHeight = SHEET_HEIGHT;
    let totalWidth = SHEET_WIDTH;
    let currentCustomAnimations = {};

    if (addedCustomAnimations.size > 0 && customAnimations) {
      for (const customAnimName of addedCustomAnimations) {
        const customAnimDef = customAnimations[customAnimName];
        if (customAnimDef) {
          const animHeight =
            customAnimDef.frameSize * customAnimDef.frames.length;
          const animWidth =
            customAnimDef.frameSize * customAnimDef.frames[0].length;
          totalHeight += animHeight;
          totalWidth = Math.max(totalWidth, animWidth);
        }
        currentCustomAnimations[customAnimName] = customAnimDef;
      }
    }

    // Resize canvas to fit all content
    renderCanvas.width = totalWidth;
    renderCanvas.height = totalHeight;

    // Clear canvas (no transparency background on offscreen canvas)
    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);

    // Store custom animations for animation preview dropdown
    setCurrentCustomAnimations(currentCustomAnimations);

    // Calculate custom animation Y positions first (needed for drawing standard items into custom areas)
    const customAnimYPositions = {};
    if (addedCustomAnimations.size > 0 && customAnimations) {
      let currentY = SHEET_HEIGHT;
      for (const customAnimName of addedCustomAnimations) {
        customAnimYPositions[customAnimName] = currentY;
        const customAnimDef = customAnimations[customAnimName];
        if (customAnimDef) {
          const animHeight =
            customAnimDef.frameSize * customAnimDef.frames.length;
          currentY += animHeight;
        }
      }
    }

    // Store Y positions for external access
    setCustomAnimYPositions(customAnimYPositions);

    // Load all standard animation images in parallel and attach them to their items
    const loadPromises = itemsToDraw.map((item) => {
      if (item.customImage) {
        // Custom image already loaded
        return Promise.resolve({ item, img: item.customImage, success: true });
      } else {
        // Load standard image
        return loadImage(item.spritePath)
          .then((img) => ({ item, img, success: true }))
          .catch((err) => {
            if (window.DEBUG) {
              console.warn(`Failed to load sprite: ${item.spritePath}`);
            }
            return { item, img: null, success: false };
          });
      }
    });

    const loadedItems = await Promise.all(loadPromises);

    // Draw all items in sorted z-order
    for (const { item, img, success } of loadedItems) {
      if (success && img) {
        const imageToDraw = await getImageToDraw(img, item.itemId, item.variant);
        renderCtx.drawImage(imageToDraw, 0, item.yPos);
      }
    }

    // Now handle custom animations (wheelchair, etc.)
    if (addedCustomAnimations.size > 0 && customAnimations) {
      // For each custom animation area, we need to draw layers in zPos order
      for (const customAnimName of addedCustomAnimations) {
        const customAnimDef = customAnimations[customAnimName];
        if (!customAnimDef) continue;

        const offsetY = customAnimYPositions[customAnimName];
        const baseAnim = customAnimationBase
          ? customAnimationBase(customAnimDef)
          : null;

        // Collect all items that need to be drawn in this custom animation area
        customAreaItems[customAnimName] = [];

        // 1. Add custom animation sprite layers (wheelchair background/foreground)
        for (const item of customAnimationItems) {
          if (item.customAnimation === customAnimName) {
            customAreaItems[customAnimName].push({
              type: "custom_sprite",
              zPos: item.zPos,
              spritePath: item.spritePath,
              itemId: item.itemId,
              animation: customAnimName,
            });
          }
        }

        // 2. Add standard items that need to be extracted into this custom animation
        // (e.g., body "sit" frames go into wheelchair custom animation)
        if (baseAnim) {
          for (const item of itemsToDraw) {
            if (item.animation === baseAnim) {
              customAreaItems[customAnimName].push({
                type: "extracted_frames",
                zPos: item.zPos,
                spritePath: item.spritePath,
                itemId: item.itemId,
                animation: item.animation,
                needsRecolor: item.needsRecolor,
                variant: item.variant
              });
            }
          }
        }

        // Sort by zPos to get correct layer order
        customAreaItems[customAnimName].sort((a, b) => a.zPos - b.zPos);

        // Load all custom area images in parallel
        const loadedCustomImages = await loadImagesInParallel(
          customAreaItems[customAnimName]
        );

        // Draw in zPos order
        for (const { item: areaItem, img, success } of loadedCustomImages) {
          if (success && img) {
            const imageToUse = await getImageToDraw(img, areaItem.itemId, areaItem.variant);

            if (areaItem.type === 'custom_sprite') {
              // Draw custom sprite directly (wheelchair background or foreground)
              renderCtx.drawImage(imageToUse, 0, offsetY);
            } else if (areaItem.type === 'extracted_frames') {
              // Extract and draw frames from standard sprite
              drawFramesToCustomAnimation(
                renderCtx,
                customAnimDef,
                offsetY,
                img
              );
            }
          }
        }
      }
    }
  } finally {
    appState.isRenderingCharacter = false;
    m.redraw();

    // Mark end and measure
    if (profiler) {
      profiler.mark("renderCharacter:end");
      profiler.measure(
        "renderCharacter",
        "renderCharacter:start",
        "renderCharacter:end"
      );
    }
  }
}

/**
 * Extract a specific animation from the main canvas
 * Returns a new canvas with just that animation
 */
export function extractAnimationFromCanvas(animationName) {
  if (!canvas) {
    return null;
  }

  const config = ANIMATION_CONFIGS[animationName];
  if (!config) {
    console.error("Unknown animation:", animationName);
    return null;
  }

  const { row, num } = config;
  const srcY = row * FRAME_SIZE;
  const srcHeight = num * FRAME_SIZE;

  // Create new canvas for this animation
  const animCanvas = document.createElement("canvas");
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = srcHeight;
  const animCtx = get2DContext(animCanvas);

  // Copy animation from main canvas
  animCtx.drawImage(
    canvas,
    0,
    srcY,
    SHEET_WIDTH,
    srcHeight,
    0,
    0,
    SHEET_WIDTH,
    srcHeight
  );

  return animCanvas;
}

/**
 * Get current canvas reference (for external use)
 */
export function getCanvas() {
  return canvas;
}

/**
 * Render a single item to a new canvas
 * Returns a canvas with just this one item rendered
 */
export async function renderSingleItem(
  itemId,
  variant,
  bodyType,
  selections,
  singleLayer = null
) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error("Item metadata not found:", itemId);
    return null;
  }

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    console.error("Body type not supported for this item:", bodyType, itemId);
    return null;
  }

  // Check if this is a custom animation item
  const layer1 =
    meta.layers && Object.values(meta.layers).find((l) => l.custom_animation);
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  let itemCanvas, itemCtx;

  if (hasCustomAnimation && customAnimations) {
    // Custom animation item - use custom animation size
    const customAnimName = layer1.custom_animation;
    const customAnimDef = customAnimations[customAnimName];
    if (!customAnimDef) {
      console.error("Custom animation definition not found:", customAnimName);
      return null;
    }

    const animHeight = customAnimDef.frameSize * customAnimDef.frames.length;
    const animWidth = customAnimDef.frameSize * customAnimDef.frames[0].length;

    const customLayers = Object.values(meta.layers).filter(
      (l) => l.custom_animation
    );
    const customAnimationsInItem = customLayers
      .map((l) => l.custom_animation)
      .filter((value, index, array) => array.indexOf(value) === index);
    const numCustomAnims = customAnimationsInItem.length;
    const getYPosForCustomAnim = (name) => {
      const index = customAnimationsInItem.indexOf(name);
      return SHEET_HEIGHT + index * animHeight;
    };

    itemCanvas = document.createElement("canvas");
    itemCanvas.width = animWidth;
    itemCanvas.height = SHEET_HEIGHT + animHeight * numCustomAnims;
    itemCtx = get2DContext(itemCanvas);

    // Render all layers of this custom animation item
    const customSprites = [];
    const animsList = getSortedLayersByAnim(itemId, true);
    for (const animName in animsList) {
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        if (singleLayer !== null && layerNum !== singleLayer) continue;
        const animLayer = animsList[animName].find(
          (l) => l.animLayerNum === layerNum
        );
        const layerKey = `layer_${animLayer.layerNum}`;
        const layer = meta.layers?.[layerKey];
        if (!layer) break;

        const yPos = getYPosForCustomAnim(layer.custom_animation);
        let basePath = layer[bodyType];
        if (!basePath) continue;

        const spritePath = `spritesheets/${basePath}${variantToFilename(
          variant
        )}.png`;
        customSprites.push({ spritePath, zPos: animLayer.zPos, yPos });
      }
    }

    // Sort by zPos
    customSprites.sort((a, b) => a.zPos - b.zPos);

    // Load all layers in parallel
    const loadedSprites = await loadImagesInParallel(customSprites);

    // Draw layers in order
    for (const { item: sprite, img, success } of loadedSprites) {
      if (success && img) {
        const imageToDraw = await getImageToDraw(img, itemId, variant);
        itemCtx.drawImage(imageToDraw, 0, sprite.yPos);
      }
    }
  } else {
    // Standard animation item - use standard sheet size
    itemCanvas = document.createElement("canvas");
    itemCanvas.width = SHEET_WIDTH;
    itemCanvas.height = SHEET_HEIGHT;
    itemCtx = get2DContext(itemCanvas);
  }

  // Build list of sprites to draw for this item
  const spritesToDraw = [];

  for (let layerNum = 1; layerNum < 10; layerNum++) {
    if (singleLayer !== null && layerNum !== singleLayer) continue;
    const layerKey = `layer_${layerNum}`;
    if (!meta.layers?.[layerKey]) break;

    const zPos = getZPos(itemId, layerNum);

    // Add each animation for this layer
    for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
      // Check animation support (same logic as renderCharacter)
      let metadataAnimName = animName;
      if (animName === "combat_idle") {
        if (!meta.animations.includes("combat")) continue;
      } else if (animName === "backslash") {
        if (
          !meta.animations.includes("1h_slash") &&
          !meta.animations.includes("1h_backslash")
        )
          continue;
      } else if (animName === "halfslash") {
        if (!meta.animations.includes("1h_halfslash")) continue;
      } else {
        if (!meta.animations.includes(animName)) continue;
      }

      const spritePath = getSpritePath(
        itemId,
        variant,
        bodyType,
        animName,
        layerNum,
        selections,
        meta
      );

      spritesToDraw.push({
        itemId,
        variant,
        spritePath,
        zPos,
        layerNum,
        animation: animName,
        yPos,
      });
    }

    // Sort by animation first, then by zPos
    spritesToDraw.sort((a, b) => {
      if (a.yPos !== b.yPos) return a.yPos - b.yPos;
      return a.zPos - b.zPos;
    });

    // Load all images in parallel
    const loadedImages = await loadImagesInParallel(spritesToDraw);

    // Draw images in order
    for (const { item: sprite, img, success } of loadedImages) {
      if (success && img) {
        const imageToDraw = await getImageToDraw(img, itemId, variant);
        itemCtx.drawImage(imageToDraw, 0, sprite.yPos);
      }
    }
  }

  return itemCanvas;
}

/**
 * Render a single item for a single animation to a new canvas
 * Returns a canvas with just this one item's one animation rendered
 */
export async function renderSingleItemAnimation(
  itemId,
  variant,
  bodyType,
  animationName,
  selections,
  singleLayer = null
) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error("Item metadata not found:", itemId);
    return null;
  }

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    return null;
  }

  // Check if this is a custom animation item
  const layer1 = meta.layers?.layer_1;
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  if (hasCustomAnimation && customAnimations) {
    // Custom animation item - just return the full item canvas (custom animations are not split by standard animation)
    return await renderSingleItem(itemId, variant, bodyType, selections);
  }

  const config = ANIMATION_CONFIGS[animationName];
  if (!config) {
    console.error("Unknown animation:", animationName);
    return null;
  }

  const { row, num } = config;
  const animYPos = 0;
  const animHeight = num * FRAME_SIZE;

  // Create a new canvas for this animation
  const animCanvas = document.createElement("canvas");
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = animHeight;
  const animCtx = get2DContext(animCanvas);

  // Build list of sprites to draw for this item & animation
  const spritesToDraw = [];

  for (let layerNum = 1; layerNum < 10; layerNum++) {
    if (singleLayer !== null && layerNum !== singleLayer) continue;
    const layerKey = `layer_${layerNum}`;
    if (!meta.layers?.[layerKey]) break;

    const zPos = getZPos(itemId, layerNum);

    // Check animation support
    if (animationName === "combat_idle") {
      if (!meta.animations.includes("combat")) continue;
    } else if (animationName === "backslash") {
      if (
        !meta.animations.includes("1h_slash") &&
        !meta.animations.includes("1h_backslash")
      )
        continue;
    } else if (animationName === "halfslash") {
      if (!meta.animations.includes("1h_halfslash")) continue;
    } else {
      if (!meta.animations.includes(animationName)) continue;
    }

    const spritePath = getSpritePath(
      itemId,
      variant,
      bodyType,
      animationName,
      layerNum,
      selections,
      meta
    );

    spritesToDraw.push({
      spritePath,
      zPos,
      layerNum,
    });
  }

  // Sort by zPos
  spritesToDraw.sort((a, b) => a.zPos - b.zPos);

  // Load all images in parallel
  const loadedImages = await loadImagesInParallel(spritesToDraw);

  // Draw images in order
  for (const { item: sprite, img, success } of loadedImages) {
    if (success && img) {
      const imageToDraw = await getImageToDraw(img, itemId, variant);
      // Draw at y=0 since this canvas is only for this animation
      animCtx.drawImage(
        img,
        0,
        animYPos,
        SHEET_WIDTH,
        animHeight,
        0,
        0,
        SHEET_WIDTH,
        animHeight
      );
    }
  }

  return animCanvas;
}

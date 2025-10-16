// Canvas rendering module for Mithril UI
// Simplified renderer that draws character sprites based on selections

import { state, getHashParamsforSelections } from '../state/state.js';
import { loadImage, loadImagesInParallel } from './load-image.js';
import { es6DynamicTemplate } from '../utils/helpers.js';

const FRAME_SIZE = 64;
const SHEET_HEIGHT = 3456; // Full universal sheet height
const SHEET_WIDTH = 832; // 13 frames * 64px

// Animation offsets (y-positions on spritesheet) - matches chargen.js base_animations
const ANIMATIONS = {
  spellcast: 0,
  thrust: 4 * FRAME_SIZE,
  walk: 8 * FRAME_SIZE,
  slash: 12 * FRAME_SIZE,
  shoot: 16 * FRAME_SIZE,
  hurt: 20 * FRAME_SIZE,
  climb: 21 * FRAME_SIZE,
  idle: 22 * FRAME_SIZE,
  jump: 26 * FRAME_SIZE,
  sit: 30 * FRAME_SIZE,
  emote: 34 * FRAME_SIZE,
  run: 38 * FRAME_SIZE,
  combat_idle: 42 * FRAME_SIZE,
  backslash: 46 * FRAME_SIZE,
  halfslash: 50 * FRAME_SIZE
};

/**
 * Convert variant name to filename format (spaces to underscores)
 * @param {string} variant - Variant name (e.g., "light brown")
 * @returns {string} - Filename format (e.g., "light_brown")
 */
function variantToFilename(variant) {
  return variant.replaceAll(' ', '_');
}

// Map metadata animation names to actual folder names
// Metadata uses "combat", "1h_slash", etc. but folders are named differently
const METADATA_TO_FOLDER = {
  'combat': 'combat_idle',
  '1h_slash': 'backslash',
  '1h_backslash': 'backslash',
  '1h_halfslash': 'halfslash'
};

let canvas = null;
let ctx = null;
let previewCanvas = null;
let previewCtx = null;

// Animation preview state
let animationFrames = [1, 2, 3, 4, 5, 6, 7, 8]; // default for walk
let animRowStart = 8; // default for walk (row number)
let animRowNum = 4; // default for walk (number of rows to stack)
let currentFrameIndex = 0;
let lastFrameTime = Date.now();
let animationFrameId = null;

// Animation definitions with frame cycles
const ANIMATION_CONFIGS = {
  'spellcast': { row: 0, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6] },
  'thrust': { row: 4, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7] },
  'walk': { row: 8, num: 4, cycle: [1, 2, 3, 4, 5, 6, 7, 8] },
  'slash': { row: 12, num: 4, cycle: [0, 1, 2, 3, 4, 5] },
  'shoot': { row: 16, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  'hurt': { row: 20, num: 1, cycle: [0, 1, 2, 3, 4, 5] },
  'climb': { row: 21, num: 1, cycle: [0, 1, 2, 3, 4, 5] },
  'idle': { row: 22, num: 4, cycle: [0, 0, 1] },
  'jump': { row: 26, num: 4, cycle: [0, 1, 2, 3, 4, 1] },
  'sit': { row: 30, num: 4, cycle: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2] },
  'emote': { row: 34, num: 4, cycle: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2] },
  'run': { row: 38, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6, 7] },
  'watering': { row: 4, num: 4, cycle: [0, 1, 4, 4, 4, 4, 5] },
  'combat': { row: 42, num: 4, cycle: [0, 0, 1] },
  '1h_slash': { row: 46, num: 4, cycle: [0, 1, 2, 3, 4, 5, 6] },
  '1h_backslash': { row: 46, num: 4, cycle: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12] },
  '1h_halfslash': { row: 50, num: 4, cycle: [0, 1, 2, 3, 4, 5] }
};

/**
 * Draw a checkered transparency background (like image editors)
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} squareSize - Size of each checker square (default 8px)
 */
function drawTransparencyBackground(context, width, height, squareSize = 8) {
  const lightGray = '#CCCCCC';
  const darkGray = '#999999';

  for (let y = 0; y < height; y += squareSize) {
    for (let x = 0; x < width; x += squareSize) {
      // Alternate colors in a checkerboard pattern
      const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
      const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
      const isLight = isEvenRow === isEvenCol;

      context.fillStyle = isLight ? lightGray : darkGray;
      context.fillRect(x, y, squareSize, squareSize);
    }
  }
}

/**
 * Initialize the canvas (creates offscreen canvas)
 */
export function initCanvas() {
  canvas = document.createElement('canvas');
  ctx = canvas.getContext('2d');
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
}

/**
 * Copy offscreen canvas to a preview canvas with optional transparency grid
 * @param {HTMLCanvasElement} previewCanvasElement - The preview canvas to copy to
 * @param {boolean} showTransparencyGrid - Whether to draw transparency grid background
 * @param {number} zoomLevel - Zoom level to apply (optional, will use CSS zoom)
 */
export function copyToPreviewCanvas(previewCanvasElement, showTransparencyGrid = false, zoomLevel = 1) {
  if (!canvas || !previewCanvasElement) {
    console.error('Canvas not initialized');
    return;
  }

  const previewCtx = previewCanvasElement.getContext('2d');

  // Match preview canvas size to offscreen canvas
  previewCanvasElement.width = canvas.width;
  previewCanvasElement.height = canvas.height;

  // Clear preview canvas
  previewCtx.clearRect(0, 0, previewCanvasElement.width, previewCanvasElement.height);

  // Optionally draw transparency grid
  if (showTransparencyGrid) {
    drawTransparencyBackground(previewCtx, previewCanvasElement.width, previewCanvasElement.height);
  }

  // Copy offscreen canvas to preview
  previewCtx.drawImage(canvas, 0, 0);

  // Apply zoom via CSS
  if (zoomLevel !== 1) {
    previewCanvasElement.style.zoom = zoomLevel.toString();
  }
}

/**
 * Initialize the preview canvas
 */
export function initPreviewCanvas(previewCanvasElement) {
  previewCanvas = previewCanvasElement;
  previewCtx = previewCanvas.getContext('2d');
  previewCanvas.width = 4 * FRAME_SIZE; // 256px
  previewCanvas.height = FRAME_SIZE; // 64px
}

/**
 * Set preview canvas zoom level
 * @param {number} zoomLevel - Zoom level (0.5 to 2)
 */
export function setPreviewCanvasZoom(zoomLevel) {
  if (previewCanvas) {
    previewCanvas.style.zoom = zoomLevel.toString();
  }
}

/**
 * Set which animation to preview
 */
export function setPreviewAnimation(animationName) {
  const config = ANIMATION_CONFIGS[animationName];
  if (!config) {
    console.error('Unknown animation:', animationName);
    return;
  }

  animationFrames = config.cycle;
  animRowStart = config.row;
  animRowNum = config.num;
  currentFrameIndex = 0;

  return animationFrames; // Return for display
}

/**
 * Get list of available animations for dropdown
 */
export function getAnimationList() {
  return [
    { value: 'spellcast', label: 'Spellcast' },
    { value: 'thrust', label: 'Thrust' },
    { value: 'walk', label: 'Walk' },
    { value: 'slash', label: 'Slash' },
    { value: 'shoot', label: 'Shoot' },
    { value: 'hurt', label: 'Hurt' },
    { value: 'climb', label: 'Climb' },
    { value: 'idle', label: 'Idle' },
    { value: 'jump', label: 'Jump' },
    { value: 'sit', label: 'Sit' },
    { value: 'emote', label: 'Emote' },
    { value: 'run', label: 'Run' },
    { value: 'watering', label: 'Watering' },
    { value: 'combat', label: 'Combat Idle' },
    { value: '1h_slash', label: '1-Handed Slash' },
    { value: '1h_backslash', label: '1-Handed Backslash' },
    { value: '1h_halfslash', label: '1-Handed Halfslash' }
  ];
}

/**
 * Start the preview animation loop
 */
export function startPreviewAnimation() {
  if (animationFrameId !== null) {
    return; // Already running
  }

  function nextFrame() {
    const fpsInterval = 1000 / 8; // 8 FPS
    const now = Date.now();
    const elapsed = now - lastFrameTime;

    if (elapsed > fpsInterval) {
      lastFrameTime = now - (elapsed % fpsInterval);

      if (previewCtx && canvas) {
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        // Draw transparency grid if enabled
        if (state.showTransparencyGrid) {
          drawTransparencyBackground(previewCtx, previewCanvas.width, previewCanvas.height);
        }

        currentFrameIndex = (currentFrameIndex + 1) % animationFrames.length;
        const currentFrame = animationFrames[currentFrameIndex];

        // Draw stacked rows from main canvas to preview
        for (let i = 0; i < animRowNum; i++) {
          previewCtx.drawImage(
            canvas,
            currentFrame * FRAME_SIZE,           // source x
            (animRowStart + i) * FRAME_SIZE,     // source y
            FRAME_SIZE,                          // source width
            FRAME_SIZE,                          // source height
            i * FRAME_SIZE,                      // dest x (spread horizontally)
            0,                                   // dest y
            FRAME_SIZE,                          // dest width
            FRAME_SIZE                           // dest height
          );
        }
      }
    }

    animationFrameId = requestAnimationFrame(nextFrame);
  }

  nextFrame();
}

/**
 * Stop the preview animation loop
 */
export function stopPreviewAnimation() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Build sprite path from item metadata for a specific animation
 */
function getSpritePath(itemId, variant, bodyType, animation, layerNum = 1, selections = {}, meta = null) {
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
	// get params from selections
	// TODO: this could be optimized to avoid recomputing every time
	// or to only do it when relevant selections change
	// or just use the selections directly instead of recomputing the hash params
	const hashParams = getHashParamsforSelections(selections);
    const replacements = Object.fromEntries(
		Object.entries(hashParams).map(([typeName, nameAndVariant]) => {
			// TODO: this works for head, eye color, and faces but probably not for everything
			const name = nameAndVariant.substr(0, nameAndVariant.lastIndexOf('_')); // Extract name before variant
			const replacement = meta.replace_in_path[typeName]?.[name];
			return [typeName, replacement];
		})
	);
	basePath = es6DynamicTemplate(basePath, replacements);
  }

  // If no variant specified, try to extract from itemId
  if (!variant) {
    const parts = itemId.split('_');
    variant = parts[parts.length - 1];
  }

  // Build full path: spritesheets/ + basePath + animation/ + variant.png
  return `spritesheets/${basePath}${animation}/${variantToFilename(variant)}.png`;
}

/**
 * Get zPos for a layer
 */
function getZPos(itemId, layerNum = 1) {
  const meta = window.itemMetadata[itemId];
  if (!meta) return 100;

  const layerKey = `layer_${layerNum}`;
  const layer = meta.layers?.[layerKey];

  return layer?.zPos ?? 100;
}

/**
 * Draw a single frame from source to destination
 * If source is smaller than destination, center it without scaling
 * @param {CanvasRenderingContext2D} destCtx - Destination context
 * @param {{x: number, y: number}} destPos - Destination position
 * @param {number} destFrameSize - Destination frame size
 * @param {CanvasImageSource} src - Source image
 * @param {{x: number, y: number}} srcPos - Source position
 * @param {number} srcFrameSize - Source frame size
 */
function drawFrameToFrame(destCtx, destPos, destFrameSize, src, srcPos, srcFrameSize) {
  if (srcFrameSize === destFrameSize) {
    // Same size - direct copy
    destCtx.drawImage(
      src,
      srcPos.x, srcPos.y, srcFrameSize, srcFrameSize,
      destPos.x, destPos.y, destFrameSize, destFrameSize
    );
  } else {
    // Different sizes - center the source frame in the destination without scaling
    // For example: 64x64 source centered in 128x128 dest = offset by 32px
    const offset = (destFrameSize - srcFrameSize) / 2;
    destCtx.drawImage(
      src,
      srcPos.x, srcPos.y, srcFrameSize, srcFrameSize,  // source rect (64x64)
      destPos.x + offset, destPos.y + offset, srcFrameSize, srcFrameSize  // dest rect (centered, not scaled)
    );
  }
}

/**
 * Extract frames from a standard sprite sheet and redraw them into a custom animation layout
 * @param {CanvasRenderingContext2D} customAnimationContext - Destination context
 * @param {object} customAnimationDefinition - Custom animation definition from custom-animations.js
 * @param {number} offsetY - Y offset to draw at
 * @param {CanvasImageSource} src - Source sprite sheet image
 */
function drawFramesToCustomAnimation(customAnimationContext, customAnimationDefinition, offsetY, src) {
  const frameSize = customAnimationDefinition.frameSize;
  const animationRowsLayout = window.animationRowsLayout;

  // Check if this is a single-animation sprite (e.g., sit.png) or full universal sheet
  // Single animation sprites are typically 192px or 832px wide and 256px tall
  const isSingleAnimation = src.height <= 256;

  for (let i = 0; i < customAnimationDefinition.frames.length; ++i) {
    const frames = customAnimationDefinition.frames[i];
    for (let j = 0; j < frames.length; ++j) {
      const frameSpec = frames[j]; // e.g., "sit-n,2"
      const [srcRowName, srcColumnStr] = frameSpec.split(",");
      const srcColumn = parseInt(srcColumnStr);

      let srcRow;
      if (isSingleAnimation) {
        // For single animation sprites, rows are 0-3 (n, w, s, e)
        // Extract direction from srcRowName (e.g., "sit-n" -> "n")
        const direction = srcRowName.split("-")[1];
        const directionMap = { 'n': 0, 'w': 1, 's': 2, 'e': 3 };
        srcRow = directionMap[direction] || 0;
      } else {
        // For universal sheet, use animationRowsLayout
        srcRow = animationRowsLayout ? animationRowsLayout[srcRowName] : i;
      }

      const srcX = FRAME_SIZE * srcColumn;
      const srcY = FRAME_SIZE * srcRow;
      const destX = frameSize * j;
      const destY = frameSize * i + offsetY;

      drawFrameToFrame(
        customAnimationContext,
        { x: destX, y: destY },  // dest position
        frameSize,  // dest frame size
        src,
        { x: srcX, y: srcY },  // source position
        FRAME_SIZE  // source frame size (64px)
      );
    }
  }
}

/**
 * Render character based on selections
 * @param {Object} selections - Selected items
 * @param {string} bodyType - Body type
 * @param {HTMLCanvasElement} targetCanvas - Canvas to render to (defaults to main canvas)
 */
export async function renderCharacter(selections, bodyType, targetCanvas = null) {
  // Mark start for profiling
  const profiler = window.profiler;
  if (profiler) {
    profiler.mark('renderCharacter:start');
  }

  // Use provided canvas or default to main canvas
  const renderCanvas = targetCanvas || canvas;
  const renderCtx = renderCanvas.getContext('2d');

  if (!renderCanvas || !renderCtx) {
    console.error('Canvas not initialized');
    return;
  }

  // Build list of items to draw
  const itemsToDraw = [];
  const customAnimationItems = []; // Track items with custom animations
  const addedCustomAnimations = new Set(); // Track which custom animations we've added

  // Import state to access custom uploaded image
  const appState = await import('../state/state.js').then(m => m.state);

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
        const spritePath = `spritesheets/${basePath}${variantToFilename(variant)}.png`;

        customAnimationItems.push({
          itemId,
          variant,
          spritePath,
          zPos,
          layerNum,
          customAnimation: customAnimName,
          isCustom: true
        });

        continue; // Skip standard animation processing for this layer
      }

      // Process standard animations for this layer
      for (const [animName, yPos] of Object.entries(ANIMATIONS)) {
        // Skip if item doesn't have animations array (custom animations only)
        if (!meta.animations || meta.animations.length === 0) {
          continue;
        }

        // Map folder name to metadata name for checking support
        // e.g., "combat_idle" -> check for "combat" or "1h_slash" in metadata
        let metadataAnimName = animName;
        if (animName === 'combat_idle') {
          // combat_idle is supported if item has "combat" OR "1h_slash" in metadata
          if (!meta.animations.includes('combat') && !meta.animations.includes('1h_slash')) {
            continue;
          }
        } else if (animName === 'backslash') {
          // backslash is supported if item has "1h_slash" OR "1h_backslash" in metadata
          if (!meta.animations.includes('1h_slash') && !meta.animations.includes('1h_backslash')) {
            continue;
          }
        } else if (animName === 'halfslash') {
          // halfslash is supported if item has "1h_halfslash" in metadata
          if (!meta.animations.includes('1h_halfslash')) {
            continue;
          }
        } else {
          // For all other animations, direct match required
          if (!meta.animations.includes(animName)) continue;
        }

        const spritePath = getSpritePath(itemId, variant, bodyType, animName, layerNum, selections, meta);

        itemsToDraw.push({
          itemId,
          variant,
          spritePath,
          zPos,
          layerNum,
          animation: animName,
          yPos,
          isCustom: false
        });
      }
    }
  }

  // Add custom uploaded image to itemsToDraw if present
  if (appState.customUploadedImage) {
    // Add custom image to be drawn at all standard animation positions
    for (const [animName, yPos] of Object.entries(ANIMATIONS)) {
      itemsToDraw.push({
        itemId: 'custom-upload',
        variant: null,
        spritePath: null, // Will draw directly from Image object
        zPos: appState.customImageZPos,
        layerNum: 0,
        animation: animName,
        yPos,
        isCustom: false,
        customImage: appState.customUploadedImage // Store the Image object
      });
    }
  }

  // Sort standard items by zPos only (lower zPos = drawn first = behind)
  // This ensures shadow (zPos=0) is drawn before body (zPos=10), etc.
  itemsToDraw.sort((a, b) => a.zPos - b.zPos);

  // Calculate total canvas height needed (standard sheet + custom animations)
  let totalHeight = SHEET_HEIGHT;
  let totalWidth = SHEET_WIDTH;

  if (addedCustomAnimations.size > 0 && window.customAnimations) {
    for (const customAnimName of addedCustomAnimations) {
      const customAnimDef = window.customAnimations[customAnimName];
      if (customAnimDef) {
        const animHeight = customAnimDef.frameSize * customAnimDef.frames.length;
        const animWidth = customAnimDef.frameSize * customAnimDef.frames[0].length;
        totalHeight += animHeight;
        totalWidth = Math.max(totalWidth, animWidth);
      }
    }
  }

  // Resize canvas to fit all content
  renderCanvas.width = totalWidth;
  renderCanvas.height = totalHeight;

  // Clear canvas (no transparency background on offscreen canvas)
  renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);

  // Calculate custom animation Y positions first (needed for drawing standard items into custom areas)
  const customAnimYPositions = {};
  if (addedCustomAnimations.size > 0 && window.customAnimations) {
    let currentY = SHEET_HEIGHT;
    for (const customAnimName of addedCustomAnimations) {
      customAnimYPositions[customAnimName] = currentY;
      const customAnimDef = window.customAnimations[customAnimName];
      if (customAnimDef) {
        const animHeight = customAnimDef.frameSize * customAnimDef.frames.length;
        currentY += animHeight;
      }
    }
  }

  // Load all standard animation images in parallel and attach them to their items
  const loadPromises = itemsToDraw.map(item => {
    if (item.customImage) {
      // Custom image already loaded
      return Promise.resolve({ item, img: item.customImage, success: true });
    } else {
      // Load standard image
      return loadImage(item.spritePath)
        .then(img => ({ item, img, success: true }))
        .catch(err => {
          console.warn(`Failed to load sprite: ${item.spritePath}`);
          return { item, img: null, success: false };
        });
    }
  });

  const loadedItems = await Promise.all(loadPromises);

  // Draw all items in sorted z-order
  for (const { item, img, success } of loadedItems) {
    if (success && img) {
      renderCtx.drawImage(img, 0, item.yPos);
    }
  }

  // Now handle custom animations (wheelchair, etc.)
  if (addedCustomAnimations.size > 0 && window.customAnimations) {
    // For each custom animation area, we need to draw layers in zPos order
    for (const customAnimName of addedCustomAnimations) {
      const customAnimDef = window.customAnimations[customAnimName];
      if (!customAnimDef) continue;

      const offsetY = customAnimYPositions[customAnimName];
      const baseAnim = window.customAnimationBase ? window.customAnimationBase(customAnimDef) : null;

      // Collect all items that need to be drawn in this custom animation area
      const customAreaItems = [];

      // 1. Add custom animation sprite layers (wheelchair background/foreground)
      for (const item of customAnimationItems) {
        if (item.customAnimation === customAnimName) {
          customAreaItems.push({
            type: 'custom_sprite',
            zPos: item.zPos,
            spritePath: item.spritePath,
            itemId: item.itemId
          });
        }
      }

      // 2. Add standard items that need to be extracted into this custom animation
      // (e.g., body "sit" frames go into wheelchair custom animation)
      if (baseAnim) {
        for (const item of itemsToDraw) {
          if (item.animation === baseAnim) {
            customAreaItems.push({
              type: 'extracted_frames',
              zPos: item.zPos,
              spritePath: item.spritePath,
              itemId: item.itemId,
              animation: item.animation
            });
          }
        }
      }

      // Sort by zPos to get correct layer order
      customAreaItems.sort((a, b) => a.zPos - b.zPos);

      // Load all custom area images in parallel
      const loadedCustomImages = await loadImagesInParallel(customAreaItems);

      // Draw in zPos order
      for (const { item: areaItem, img, success } of loadedCustomImages) {
        if (success && img) {
          if (areaItem.type === 'custom_sprite') {
            // Draw custom sprite directly (wheelchair background or foreground)
            renderCtx.drawImage(img, 0, offsetY);
          } else if (areaItem.type === 'extracted_frames') {
            // Extract and draw frames from standard sprite
            drawFramesToCustomAnimation(renderCtx, customAnimDef, offsetY, img);
          }
        }
      }
    }
  }

  // Mark end and measure
  if (profiler) {
    profiler.mark('renderCharacter:end');
    profiler.measure('renderCharacter', 'renderCharacter:start', 'renderCharacter:end');
  }
}

/**
 * Download canvas as PNG (exports the offscreen canvas directly)
 */
export function downloadAsPNG(filename = 'character-spritesheet.png') {
  if (!canvas) {
    console.error('Canvas not initialized');
    return;
  }

  // Export offscreen canvas directly
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Get canvas as blob for ZIP export
 */
export function getCanvasBlob() {
  if (!canvas) {
    console.error('Canvas not initialized');
    return Promise.reject(new Error('Canvas not initialized'));
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Export current state as JSON string
 */
export function exportStateAsJSON(selections, bodyType) {
  const state = {
    version: '1.0',
    bodyType: bodyType,
    selections: selections
  };
  return JSON.stringify(state, null, 2);
}

/**
 * Import state from JSON string
 */
export function importStateFromJSON(jsonString) {
  try {
    const state = JSON.parse(jsonString);
    if (!state.version || !state.bodyType || !state.selections) {
      throw new Error('Invalid JSON format');
    }
    return {
      bodyType: state.bodyType,
      selections: state.selections
    };
  } catch (err) {
    console.error('Failed to parse JSON:', err);
    throw err;
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
    console.error('Unknown animation:', animationName);
    return null;
  }

  const { row, num } = config;
  const srcY = row * FRAME_SIZE;
  const srcHeight = num * FRAME_SIZE;

  // Create new canvas for this animation
  const animCanvas = document.createElement('canvas');
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = srcHeight;
  const animCtx = animCanvas.getContext('2d');

  // Copy animation from main canvas
  animCtx.drawImage(canvas, 0, srcY, SHEET_WIDTH, srcHeight, 0, 0, SHEET_WIDTH, srcHeight);

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
export async function renderSingleItem(itemId, variant, bodyType, selections) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error('Item metadata not found:', itemId);
    return null;
  }

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    console.error('Body type not supported for this item:', bodyType, itemId);
    return null;
  }

  // Check if this is a custom animation item
  const layer1 = meta.layers?.layer_1;
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  let itemCanvas, itemCtx;

  if (hasCustomAnimation && window.customAnimations) {
    // Custom animation item - use custom animation size
    const customAnimName = layer1.custom_animation;
    const customAnimDef = window.customAnimations[customAnimName];
    if (!customAnimDef) {
      console.error('Custom animation definition not found:', customAnimName);
      return null;
    }

    const animHeight = customAnimDef.frameSize * customAnimDef.frames.length;
    const animWidth = customAnimDef.frameSize * customAnimDef.frames[0].length;

    itemCanvas = document.createElement('canvas');
    itemCanvas.width = animWidth;
    itemCanvas.height = animHeight;
    itemCtx = itemCanvas.getContext('2d');

    // Render all layers of this custom animation item
    const customSprites = [];
    for (let layerNum = 1; layerNum < 10; layerNum++) {
      const layerKey = `layer_${layerNum}`;
      const layer = meta.layers?.[layerKey];
      if (!layer) break;

      const zPos = getZPos(itemId, layerNum);
      let basePath = layer[bodyType];
      if (!basePath) continue;

      const spritePath = `spritesheets/${basePath}${variantToFilename(variant)}.png`;
      customSprites.push({ spritePath, zPos });
    }

    // Sort by zPos
    customSprites.sort((a, b) => a.zPos - b.zPos);

    // Load all layers in parallel
    const loadedSprites = await loadImagesInParallel(customSprites);

    // Draw layers in order
    for (const { item: sprite, img, success } of loadedSprites) {
      if (success && img) {
        itemCtx.drawImage(img, 0, 0);
      }
    }
  } else {
    // Standard animation item - use standard sheet size
    itemCanvas = document.createElement('canvas');
    itemCanvas.width = SHEET_WIDTH;
    itemCanvas.height = SHEET_HEIGHT;
    itemCtx = itemCanvas.getContext('2d');

    // Build list of sprites to draw for this item
    const spritesToDraw = [];

    for (let layerNum = 1; layerNum < 10; layerNum++) {
      const layerKey = `layer_${layerNum}`;
      if (!meta.layers?.[layerKey]) break;

      const zPos = getZPos(itemId, layerNum);

      // Add each animation for this layer
      for (const [animName, yPos] of Object.entries(ANIMATIONS)) {
        // Check animation support (same logic as renderCharacter)
        let metadataAnimName = animName;
        if (animName === 'combat_idle') {
          if (!meta.animations.includes('combat') && !meta.animations.includes('1h_slash')) {
            continue;
          }
        } else if (animName === 'backslash') {
          if (!meta.animations.includes('1h_slash') && !meta.animations.includes('1h_backslash')) {
            continue;
          }
        } else if (animName === 'halfslash') {
          if (!meta.animations.includes('1h_halfslash')) {
            continue;
          }
        } else {
          if (!meta.animations.includes(animName)) continue;
        }

        const spritePath = getSpritePath(itemId, variant, bodyType, animName, layerNum, selections, meta);

        spritesToDraw.push({
          itemId,
          variant,
          spritePath,
          zPos,
          layerNum,
          animation: animName,
          yPos
        });
      }
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
        itemCtx.drawImage(img, 0, sprite.yPos);
      }
    }
  }

  return itemCanvas;
}

/**
 * Render a single item for a single animation to a new canvas
 * Returns a canvas with just this one item's one animation rendered
 */
export async function renderSingleItemAnimation(itemId, variant, bodyType, animationName, selections) {
  const meta = window.itemMetadata[itemId];
  if (!meta) {
    console.error('Item metadata not found:', itemId);
    return null;
  }

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    return null;
  }

  // Check if this is a custom animation item
  const layer1 = meta.layers?.layer_1;
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  if (hasCustomAnimation && window.customAnimations) {
    // Custom animation item - just return the full item canvas (custom animations are not split by standard animation)
    return await renderSingleItem(itemId, variant, bodyType, selections);
  }

  const config = ANIMATION_CONFIGS[animationName];
  if (!config) {
    console.error('Unknown animation:', animationName);
    return null;
  }

  const { row, num } = config;
  const animYPos = row * FRAME_SIZE;
  const animHeight = num * FRAME_SIZE;

  // Create a new canvas for this animation
  const animCanvas = document.createElement('canvas');
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = animHeight;
  const animCtx = animCanvas.getContext('2d');

  // Build list of sprites to draw for this item & animation
  const spritesToDraw = [];

  for (let layerNum = 1; layerNum < 10; layerNum++) {
    const layerKey = `layer_${layerNum}`;
    if (!meta.layers?.[layerKey]) break;

    const zPos = getZPos(itemId, layerNum);

    // Check animation support
    if (animationName === 'combat_idle') {
      if (!meta.animations.includes('combat') && !meta.animations.includes('1h_slash')) {
        continue;
      }
    } else if (animationName === 'backslash') {
      if (!meta.animations.includes('1h_slash') && !meta.animations.includes('1h_backslash')) {
        continue;
      }
    } else if (animationName === 'halfslash') {
      if (!meta.animations.includes('1h_halfslash')) {
        continue;
      }
    } else {
      if (!meta.animations.includes(animationName)) continue;
    }

    const spritePath = getSpritePath(itemId, variant, bodyType, animationName, layerNum, selections, meta);

    spritesToDraw.push({
      spritePath,
      zPos,
      layerNum
    });
  }

  // Sort by zPos
  spritesToDraw.sort((a, b) => a.zPos - b.zPos);

  // Load all images in parallel
  const loadedImages = await loadImagesInParallel(spritesToDraw);

  // Draw images in order
  for (const { item: sprite, img, success } of loadedImages) {
    if (success && img) {
      // Draw at y=0 since this canvas is only for this animation
      animCtx.drawImage(img, 0, animYPos, SHEET_WIDTH, animHeight, 0, 0, SHEET_WIDTH, animHeight);
    }
  }

  return animCanvas;
}

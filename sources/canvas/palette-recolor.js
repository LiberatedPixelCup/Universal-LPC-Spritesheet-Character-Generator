// Runtime palette swapping for LPC sprites
// Recolors body sprites on-demand without caching

import {
  recolorImageWebGL,
  isWebGLAvailable,
} from "./webgl-palette-recolor.js";
import { debugLog, debugWarn } from "../utils/debug.ts";
import { get2DContext } from "./canvas-utils.ts";
import { getItemLite } from "../state/catalog.ts";
import { state } from "../state/state.ts";
import { getLayersToLoad } from "../state/meta.ts";
import { getPalettesFromMeta, getTargetPalette } from "../state/palettes.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../state/constants.ts";

// Configuration flags
let config = {
  forceCPU: false, // Set to true to force CPU mode even if WebGL is available
  useWebGL: isWebGLAvailable(),
};

// Check WebGL availability once at module load
const USE_WEBGL = config.useWebGL && !config.forceCPU;

// Log which method will be used
if (USE_WEBGL) {
  debugLog("🎨 Palette recoloring: WebGL GPU-accelerated mode enabled");
  debugLog("💡 To check stats, run: window.getPaletteRecolorStats()");
  debugLog('💡 To force CPU mode, run: window.setPaletteRecolorMode("cpu")');
} else if (config.forceCPU) {
  debugLog("🎨 Palette recoloring: CPU mode (forced by configuration)");
} else {
  debugLog("🎨 Palette recoloring: CPU mode (WebGL not available)");
}

/**
 * Convert hex color string to RGB object
 * @param {string} hex - Hex color (e.g., "#271920")
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Build color mapping from source palette to target palette
 * Returns array of {source, target} pairs for tolerance-based matching
 * @param {string[]} sourcePalette - Array of hex colors
 * @param {string[]} targetPalette - Array of hex colors
 * @returns {Array<{source: {r: number, g: number, b: number}, target: {r: number, g: number, b: number}}>}
 */
function buildColorMap(sourcePalette, targetPalette) {
  const colorPairs = [];

  for (let i = 0; i < sourcePalette.length; i++) {
    const sourceRgb = hexToRgb(sourcePalette[i]);
    const targetRgb = hexToRgb(targetPalette[i]);

    if (sourceRgb && targetRgb) {
      colorPairs.push({ source: sourceRgb, target: targetRgb });
    }
  }

  return colorPairs;
}

/**
 * Find matching color in palette with tolerance (like WebGL shader)
 * @param {number} r - Red value
 * @param {number} g - Green value
 * @param {number} b - Blue value
 * @param {Array} colorPairs - Array of source/target color pairs
 * @param {number} tolerance - Color matching tolerance (default 1, matching WebGL's ~0.004 * 255)
 * @returns {{r: number, g: number, b: number}|null} Target color or null if no match
 */
function findMatchingColor(r, g, b, colorPairs, tolerance = 1) {
  for (const pair of colorPairs) {
    const dr = Math.abs(r - pair.source.r);
    const dg = Math.abs(g - pair.source.g);
    const db = Math.abs(b - pair.source.b);

    if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
      return pair.target;
    }
  }
  return null;
}

/**
 * Recolor an image using palette mapping (CPU implementation).
 * Accepts a list of (source, target) palette mappings; all mappings are
 * flattened into a single list of color pairs, then each pixel is tested
 * against every pair in one pass.
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Source image
 * @param {Array<{source: string[], target: string[]}>} paletteMappings
 * @returns {HTMLCanvasElement} Recolored canvas
 */
function recolorImageCPU(sourceImage, paletteMappings) {
  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = get2DContext(canvas);

  // Draw source image
  ctx.drawImage(sourceImage, 0, 0);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Flatten all mappings into a single color pair list
  const colorPairs = [];
  for (const { source, target } of paletteMappings) {
    const pairs = buildColorMap(source, target);
    for (const p of pairs) colorPairs.push(p);
  }

  // Recolor pixels with tolerance matching (like WebGL)
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    // Skip transparent pixels
    if (a === 0) continue;

    // Find matching color with tolerance
    const newColor = findMatchingColor(r, g, b, colorPairs);

    if (newColor) {
      pixels[i] = newColor.r;
      pixels[i + 1] = newColor.g;
      pixels[i + 2] = newColor.b;
      // Keep alpha unchanged
    }
  }

  // Write back
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

// Track recolor stats for debugging
let recolorStats = { webgl: 0, cpu: 0, fallback: 0 };

/**
 * Get recolor statistics
 * @returns {Object} Stats object with webgl, cpu, and fallback counts
 */
export function getRecolorStats() {
  return { ...recolorStats };
}

/**
 * Reset recolor statistics
 */
export function resetRecolorStats() {
  recolorStats = { webgl: 0, cpu: 0, fallback: 0 };
}

/**
 * Set palette recolor mode
 * @param {string} mode - "webgl" or "cpu"
 */
export function setPaletteRecolorMode(mode) {
  if (mode === "cpu") {
    config.forceCPU = true;
    debugLog("🎨 Switched to CPU mode (forced)");
  } else if (mode === "webgl") {
    if (config.useWebGL) {
      config.forceCPU = false;
      debugLog("🎨 Switched to WebGL mode");
    } else {
      debugWarn("⚠️ WebGL not available on this browser");
    }
  } else {
    console.error('Invalid mode. Use "webgl" or "cpu"');
  }
}

/**
 * Get current palette recolor configuration
 * @returns {Object} Current config
 */
export function getPaletteRecolorConfig() {
  return {
    ...config,
    activeMode: !config.forceCPU && config.useWebGL ? "webgl" : "cpu",
  };
}

/**
 * Recolor an image using one or more palette mappings in a single pass.
 * Automatically uses WebGL if available, falls back to CPU.
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Source image
 * @param {Array<{source: string[], target: string[]}>} paletteMappings
 * @returns {HTMLCanvasElement} Recolored canvas
 */
export function recolorImage(sourceImage, paletteMappings) {
  const shouldUseWebGL = config.useWebGL && !config.forceCPU;

  if (shouldUseWebGL) {
    try {
      recolorStats.webgl++;
      return recolorImageWebGL(sourceImage, paletteMappings);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("⚠️ WebGL recoloring failed, falling back to CPU:", error);
      recolorStats.fallback++;
      return recolorImageCPU(sourceImage, paletteMappings);
    }
  }
  recolorStats.cpu++;
  return recolorImageCPU(sourceImage, paletteMappings);
}

/**
 * Load palette JSON file
 * @param {string} url - URL to palette JSON
 * @returns {Promise<Object>} Palette data
 */
export async function loadPalette(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load palette: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Bounded LRU cache of recolored canvases, keyed by (spritePath, recolors).
 * A JS Map preserves insertion order; `get → delete → set` moves an entry to
 * the end (most-recently-used), and eviction always drops the head.
 *
 * We store the in-flight Promise rather than the resolved canvas so that
 * concurrent callers for the same key (e.g. main render + a tree preview)
 * share one recolor operation instead of starting duplicates.
 */
const RECOLOR_CACHE_CAP = 250;
const recolorCache = new Map();

/**
 * Get image to draw - applies recoloring if needed based on palette configuration.
 * Async because palette loading is lazy (loads on first use). When `spritePath`
 * is supplied, the recolored result is memoized so repeated renders for the
 * same (spritePath, recolors) skip the entire recolor pipeline.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} img - Source image
 * @param {string} itemId - Item identifier
 * @param {Object} recolors - Recolor names
 * @param {string|null} [spritePath] - Source sprite URL (enables caching when set)
 * @returns {Promise<HTMLImageElement|HTMLCanvasElement>} Image or recolored canvas to draw
 */
export async function getImageToDraw(img, itemId, recolors, spritePath = null) {
  if (!recolors) {
    return img; // No recolor specified, return original image
  }
  const meta = getItemLite(itemId).unwrapOr(null);
  const paletteConfig = getPalettesFromMeta(meta).unwrapOr(null);
  if (!paletteConfig) {
    return img; // Item doesn't use palette recoloring
  }

  const cacheKey = spritePath
    ? `${spritePath}|${JSON.stringify(recolors)}`
    : null;
  if (cacheKey) {
    const hit = recolorCache.get(cacheKey);
    if (hit) {
      // LRU touch
      recolorCache.delete(cacheKey);
      recolorCache.set(cacheKey, hit);
      return hit;
    }
  }

  const promise = recolorWithPalette(img, recolors, paletteConfig);

  if (cacheKey) {
    recolorCache.set(cacheKey, promise);
    // On rejection, drop the entry so retries aren't poisoned by a stale failure.
    promise.catch(() => {
      if (recolorCache.get(cacheKey) === promise) {
        recolorCache.delete(cacheKey);
      }
    });
    while (recolorCache.size > RECOLOR_CACHE_CAP) {
      const oldestKey = recolorCache.keys().next().value;
      recolorCache.delete(oldestKey);
    }
  }

  try {
    return await promise;
  } catch (err) {
    console.error(
      `Failed to recolor ${paletteConfig[meta.type_name].material} color ${JSON.stringify(recolors)}:`,
      err,
    );
    return img; // Fallback to original on error
  }
}

/**
 * Clear the recolor cache. Mainly for tests; callable at runtime too.
 */
export function clearRecolorCache() {
  recolorCache.clear();
}

/**
 * Recolor an image using a specified palette type
 * Automatically loads the palette on first use (lazy loading)
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Base source image
 * @param {Object} targetColors - Target color names (e.g., { primary: "amber", secondary: "bronze", accent: "fur_copper" })
 * @param {Object} sourcePalettes - Original palettes to source data from
 * @returns {Promise<HTMLCanvasElement>} Recolored canvas
 */
export async function recolorWithPalette(
  sourceImage,
  targetColors,
  sourcePalettes,
) {
  // Gather all (source, target) palette mappings so they can be applied
  // in a single shader pass.
  const mappings = [];
  for (const [typeName, palette] of Object.entries(sourcePalettes)) {
    const targetPalette = getTargetPalette(
      palette.material,
      targetColors[typeName],
    ).unwrapOr(null);
    if (!targetPalette) {
      throw new Error(
        `Unknown target palette color: ${JSON.stringify(targetColors)}`,
      );
    }
    mappings.push({ source: palette.colors, target: targetPalette });
  }

  return mappings.length > 0
    ? recolorImage(sourceImage, mappings)
    : sourceImage;
}

/**
 * Draw Preview for Recolorable Asset
 * @param {string} itemId - Item identifier
 * @param {Object} meta - Metadata for the asset
 * @param {Object} canvas - Canvas dom
 * @param {Object} selectedColors - Selected colors for recoloring
 * @param {number|null} [renderId] - Optional render identifier used to detect and skip stale renders
 * @returns {number} Numeric status code (0 if no render was performed or the render is stale)
 */
export async function drawRecolorPreview(
  itemId,
  meta,
  canvas,
  selectedColors,
  renderId = null,
) {
  if (!canvas || !canvas.isConnected) {
    return 0;
  }

  const isStaleRender = () => {
    if (!canvas.isConnected) {
      return true;
    }
    if (typeof renderId === "number" && canvas._recolorRenderId !== renderId) {
      return true;
    }
    return false;
  };

  // Skip if canvas is not connected or renderId doesn't match (stale render)
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || isStaleRender()) {
    return 0;
  }

  // Only show the idle preview for the asset
  const compactDisplay = state.compactDisplay;
  const previewRow = meta.preview_row ?? 2;
  const previewCol = meta.preview_column ?? 0;
  const previewXOffset = meta.preview_x_offset ?? 0;
  const previewYOffset = meta.preview_y_offset ?? 0;
  const layersToLoad = getLayersToLoad(meta, state.bodyType, state.selections);

  // Load and draw all layers
  let imagesLoaded = 0;
  const loadedLayers = await Promise.all(
    layersToLoad.map((layer) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ img, layer });
        img.onerror = () => {
          debugWarn(`Failed to load image for layer ${layer.path}`);
          resolve({ img: null, layer });
        };
        img.src = layer.path;
      });
    }),
  );
  if (isStaleRender()) {
    return 0;
  }

  canvas.loadedLayers = loadedLayers;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Draw each layer in zPos order
  imagesLoaded = 0;
  for (const { img, layer } of loadedLayers) {
    if (isStaleRender()) {
      return 0;
    }

    if (img) {
      const imageToDraw = await getImageToDraw(
        img,
        itemId,
        selectedColors,
        layer.path,
      );
      const size = compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE;
      const srcX = previewCol * FRAME_SIZE + previewXOffset;
      const srcY = previewRow * FRAME_SIZE + previewYOffset;
      ctx.drawImage(
        imageToDraw,
        srcX,
        srcY,
        FRAME_SIZE,
        FRAME_SIZE,
        0,
        0,
        size,
        size,
      );
      imagesLoaded++;
    }
  }
  return imagesLoaded;
}

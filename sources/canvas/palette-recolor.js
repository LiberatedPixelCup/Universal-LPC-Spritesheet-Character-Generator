// Runtime palette swapping for LPC sprites
// Recolors body sprites on-demand without caching

import {
  recolorImageWebGL,
  isWebGLAvailable,
} from "./webgl-palette-recolor.js";
import { getDebugParam } from "../main.js";
import { get2DContext } from "./canvas-utils.js";
import { getBasePalette, getMultiPalettes, getPaletteFile, getPaletteFiles } from '../state/palettes.js';

// Configuration flags
let config = {
  forceCPU: false, // Set to true to force CPU mode even if WebGL is available
  useWebGL: isWebGLAvailable(),
};

// Check WebGL availability once at module load
const USE_WEBGL = config.useWebGL && !config.forceCPU;

// Log which method will be used
const DEBUG = getDebugParam();
if (DEBUG) {
  if (USE_WEBGL) {
    console.log("🎨 Palette recoloring: WebGL GPU-accelerated mode enabled");
    console.log("💡 To check stats, run: window.getPaletteRecolorStats()");
    console.log(
      '💡 To force CPU mode, run: window.setPaletteRecolorMode("cpu")'
    );
  } else if (config.forceCPU) {
    console.log("🎨 Palette recoloring: CPU mode (forced by configuration)");
  } else {
    console.log("🎨 Palette recoloring: CPU mode (WebGL not available)");
  }
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
 * Pack RGB values into single integer for fast lookup
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {number} Packed integer
 */
function packRgb(r, g, b) {
  return (r << 16) | (g << 8) | b;
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
 * Recolor an image using palette mapping (CPU implementation)
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Source image
 * @param {string[]} sourcePalette - Array of hex colors (source)
 * @param {string[]} targetPalette - Array of hex colors (target)
 * @returns {HTMLCanvasElement} Recolored canvas
 */
function recolorImageCPU(sourceImage, sourcePalette, targetPalette) {
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

  // Build color mapping
  const colorPairs = buildColorMap(sourcePalette, targetPalette);

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
    console.log("🎨 Switched to CPU mode (forced)");
  } else if (mode === "webgl") {
    if (config.useWebGL) {
      config.forceCPU = false;
      console.log("🎨 Switched to WebGL mode");
    } else {
      console.warn("⚠️ WebGL not available on this browser");
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
 * Recolor an image using palette mapping
 * Automatically uses WebGL if available, falls back to CPU
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Source image
 * @param {string[]} sourcePalette - Array of hex colors (source)
 * @param {string[]} targetPalette - Array of hex colors (target)
 * @returns {HTMLCanvasElement} Recolored canvas
 */
export function recolorImage(sourceImage, sourcePalette, targetPalette) {
  const shouldUseWebGL = config.useWebGL && !config.forceCPU;

  if (shouldUseWebGL) {
    try {
      recolorStats.webgl++;
      return recolorImageWebGL(sourceImage, sourcePalette, targetPalette);
    } catch (error) {
      console.warn("⚠️ WebGL recoloring failed, falling back to CPU:", error);
      recolorStats.fallback++;
      return recolorImageCPU(sourceImage, sourcePalette, targetPalette);
    }
  }
  recolorStats.cpu++;
  return recolorImageCPU(sourceImage, sourcePalette, targetPalette);
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

// Module state for loaded palettes
// Palettes are loaded on-demand based on item metadata
const loadedPalettes = {};

/**
 * Get image to draw - applies recoloring if needed based on palette configuration
 * Async because palette loading is lazy (loads on first use)
 * @param {HTMLImageElement|HTMLCanvasElement} img - Source image
 * @param {string} itemId - Item identifier
 * @param {string} color - Color name
 * @returns {Promise<HTMLImageElement|HTMLCanvasElement>} Image or recolored canvas to draw
 */
export async function getImageToDraw(img, itemId, color) {
  const meta = window.itemMetadata?.[itemId];
  const paletteConfig = getPaletteForItem(itemId, meta);

  // Only recolor if item uses a palette and color is not the source color
  if (paletteConfig && color !== paletteConfig.sourceColor) {
    try {
      return await recolorWithPalette(img, color, paletteConfig.type);
    } catch (err) {
      console.warn(
        `Failed to recolor ${paletteConfig.type} color ${color}:`,
        err
      );
      return img; // Fallback to original on error
    }
  }
  return img; // Return original if no recoloring needed
}

/**
 * Get palette configuration for an item from its metadata
 * @param {string} itemId - Item identifier
 * @param {Object} meta - Item metadata
 * @returns {Object|null} Palette config object with {type, base, palette} or null if item doesn't use palette recoloring
 */
export function getPaletteForItem(itemId, meta) {
  if (!meta || !meta.recolors) return null;

	// Return the recolors config from item metadata
  const palettes = getMultiPalettes(meta.recolors);

  // Gather All Palettes If Exists
  const results = [];
  for (const palette of palettes) {
    results.push({
      type: palette.type,
      sourceColor: getBasePalette(palette.type, palette.base ?? null), // TO DO: This should be the colors, not simply the palette name, maybe?!
      file: getPaletteFiles(palette.type, palette.palettes)
    });
  }

	return results;
}

/**
 * Lazy-load a palette on first request
 * @param {string} paletteType - Palette type & variant (e.g., 'body.ulpc', 'hair.lpcr')
 * @returns {Promise<Object>} Palette data
 */
async function ensurePaletteLoaded(paletteType) {
  if (!loadedPalettes[paletteType]) {
    const paletteFile = getPaletteFile(paletteType);
    if (!paletteFile) {
      throw new Error(
        `Unknown palette type: ${paletteType} (no file mapping found)`
      );
    }

    try {
      loadedPalettes[paletteType] = await loadPalette(paletteFile);
      if (DEBUG) {
        console.log(
          `Loaded ${paletteType} palette with ${
            Object.keys(loadedPalettes[paletteType]).length
          } colors`
        );
      }
    } catch (err) {
      throw new Error(
        `Failed to load ${paletteType} palette from ${paletteFile}: ${err.message}`
      );
    }
  }

  return loadedPalettes[paletteType];
}

/**
 * Recolor an image using a specified palette type
 * Automatically loads the palette on first use (lazy loading)
 * @param {HTMLImageElement|HTMLCanvasElement} sourceImage - Base source image
 * @param {string} targetColor - Target color name (e.g., "amber", "bronze", "fur_copper")
 * @param {string} paletteType - Palette type to use (e.g., "body", "hair", "cloth")
 * @returns {Promise<HTMLCanvasElement>} Recolored canvas
 */
export async function recolorWithPalette(
  sourceImage,
  targetColor,
  paletteType
) {
  // Lazy-load palette on first use
  const palette = await ensurePaletteLoaded(paletteType);

  const sourcePalette = palette.source || palette.light;
  const targetPalette = palette[targetColor];

  if (!targetPalette) {
    throw new Error(`Unknown ${paletteType} color: ${targetColor}`);
  }

  return recolorImage(sourceImage, sourcePalette, targetPalette);
}

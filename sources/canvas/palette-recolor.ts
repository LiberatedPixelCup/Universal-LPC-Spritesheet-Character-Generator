// Runtime palette swapping for LPC sprites
// Recolors body sprites on-demand without caching

import { ok, err, type Result } from "neverthrow";
import {
  recolorImageWebGL,
  isWebGLAvailable,
  type PaletteMapping,
} from "./webgl-palette-recolor.ts";
import { debugLog, debugWarn } from "../utils/debug.ts";
import { get2DContext } from "./canvas-utils.ts";
import { getItemLite } from "../state/catalog.ts";
import type { ItemMerged } from "../state/catalog.ts";
import { state } from "../state/state.ts";
import { getLayersToLoad } from "../state/meta.ts";
import { getPalettesFromMeta, getTargetPalette } from "../state/palettes.ts";
import type { PaletteForItem } from "../state/palettes.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../state/constants.ts";

// Configuration flags
const config = {
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

type Rgb = { r: number; g: number; b: number };
type ColorPair = { source: Rgb; target: Rgb };

/** Convert hex color string to RGB object. */
function hexToRgb(hex: string): Rgb | null {
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
 * Build color mapping from source palette to target palette.
 * Returns array of {source, target} pairs for tolerance-based matching.
 */
function buildColorMap(
  sourcePalette: string[],
  targetPalette: string[],
): ColorPair[] {
  const colorPairs: ColorPair[] = [];

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
 * Find matching color in palette with tolerance (like WebGL shader).
 * `tolerance` default 1, matching WebGL's ~0.004 * 255.
 */
function findMatchingColor(
  r: number,
  g: number,
  b: number,
  colorPairs: ColorPair[],
  tolerance: number = 1,
): Rgb | null {
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
 */
function recolorImageCPU(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  paletteMappings: PaletteMapping[],
): HTMLCanvasElement {
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
  const colorPairs: ColorPair[] = [];
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

export type RecolorStats = { webgl: number; cpu: number; fallback: number };
export type RecolorMode = "webgl" | "cpu";
export type RecolorConfig = {
  forceCPU: boolean;
  useWebGL: boolean;
  activeMode: RecolorMode;
};

// Track recolor stats for debugging
let recolorStats: RecolorStats = { webgl: 0, cpu: 0, fallback: 0 };

/** Get recolor statistics. */
export function getRecolorStats(): RecolorStats {
  return { ...recolorStats };
}

/** Reset recolor statistics. */
export function resetRecolorStats(): void {
  recolorStats = { webgl: 0, cpu: 0, fallback: 0 };
}

/**
 * Set palette recolor mode.
 * Runtime guard preserved: main.js attaches this to `window` and the dev
 * console may pass arbitrary strings.
 */
export function setPaletteRecolorMode(mode: RecolorMode): void {
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

/** Get current palette recolor configuration. */
export function getPaletteRecolorConfig(): RecolorConfig {
  return {
    ...config,
    activeMode: !config.forceCPU && config.useWebGL ? "webgl" : "cpu",
  };
}

/**
 * Recolor an image using one or more palette mappings in a single pass.
 * Automatically uses WebGL if available, falls back to CPU.
 */
export function recolorImage(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  paletteMappings: PaletteMapping[],
): HTMLCanvasElement {
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

export type LoadPaletteError =
  | { kind: "fetch-failed"; status: number; statusText: string }
  | { kind: "parse-failed"; cause: unknown };

/** Load palette JSON file. */
export async function loadPalette(
  url: string,
): Promise<Result<unknown, LoadPaletteError>> {
  const response = await fetch(url);
  if (!response.ok) {
    return err({
      kind: "fetch-failed",
      status: response.status,
      statusText: response.statusText,
    });
  }
  try {
    return ok(await response.json());
  } catch (cause) {
    return err({ kind: "parse-failed", cause });
  }
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
const recolorCache = new Map<
  string,
  Promise<HTMLImageElement | HTMLCanvasElement>
>();

/**
 * Get image to draw - applies recoloring if needed based on palette configuration.
 * Async because palette loading is lazy (loads on first use). When `spritePath`
 * is supplied, the recolored result is memoized so repeated renders for the
 * same (spritePath, recolors) skip the entire recolor pipeline.
 */
export async function getImageToDraw(
  img: HTMLImageElement | HTMLCanvasElement,
  itemId: string,
  recolors: Record<string, string> | null | undefined,
  spritePath: string | null = null,
): Promise<HTMLImageElement | HTMLCanvasElement> {
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
      if (oldestKey === undefined) break;
      recolorCache.delete(oldestKey);
    }
  }

  try {
    return await promise;
  } catch (e) {
    console.error(
      `Failed to recolor ${paletteConfig[meta!.type_name]?.material} color ${JSON.stringify(recolors)}:`,
      e,
    );
    return img; // Fallback to original on error
  }
}

/** Clear the recolor cache. Mainly for tests; callable at runtime too. */
export function clearRecolorCache(): void {
  recolorCache.clear();
}

/**
 * Recolor an image using a specified palette type.
 * Automatically loads the palette on first use (lazy loading).
 */
export async function recolorWithPalette(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetColors: Record<string, string>,
  sourcePalettes: Record<string, PaletteForItem>,
): Promise<HTMLCanvasElement | HTMLImageElement> {
  // Gather all (source, target) palette mappings so they can be applied
  // in a single shader pass.
  const mappings: PaletteMapping[] = [];
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
 * `drawRecolorPreview` callers (currently `ItemWithRecolors.js` and
 * `PaletteSelectModal.js`, both JS) stash a render-id and the loaded layers
 * on the DOM canvas element as a soft contract. Type those slots so this
 * module can read/write them without ad-hoc casts at each call site.
 */
type PreviewCanvas = HTMLCanvasElement & {
  _recolorRenderId?: number;
  loadedLayers?: Array<{
    img: HTMLImageElement | null;
    layer: { path: string };
  }>;
};

/**
 * Draw preview for recolorable asset.
 * Returns count of images drawn, or 0 when the render is skipped (canvas
 * detached, or `renderId` no longer matches `canvas._recolorRenderId`).
 */
export async function drawRecolorPreview(
  itemId: string,
  meta: ItemMerged,
  canvas: HTMLCanvasElement,
  selectedColors: Record<string, string>,
  renderId: number | null = null,
): Promise<number> {
  const previewCanvas = canvas as PreviewCanvas;
  if (!previewCanvas || !previewCanvas.isConnected) {
    return 0;
  }

  const isStaleRender = (): boolean => {
    if (!previewCanvas.isConnected) {
      return true;
    }
    if (
      typeof renderId === "number" &&
      previewCanvas._recolorRenderId !== renderId
    ) {
      return true;
    }
    return false;
  };

  // Skip if canvas is not connected or renderId doesn't match (stale render)
  const ctx = previewCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || isStaleRender()) {
    return 0;
  }

  // Only show the idle preview for the asset
  const compactDisplay = state.compactDisplay;
  const previewRow = meta.preview_row ?? 2;
  const previewCol = (meta as { preview_column?: number }).preview_column ?? 0;
  const previewXOffset =
    (meta as { preview_x_offset?: number }).preview_x_offset ?? 0;
  const previewYOffset =
    (meta as { preview_y_offset?: number }).preview_y_offset ?? 0;
  const layersToLoad = getLayersToLoad(meta, state.bodyType, state.selections);

  // Load and draw all layers
  let imagesLoaded = 0;
  const loadedLayers = await Promise.all(
    layersToLoad.map((layer) => {
      return new Promise<{
        img: HTMLImageElement | null;
        layer: { path: string };
      }>((resolve) => {
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

  previewCanvas.loadedLayers = loadedLayers;
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
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

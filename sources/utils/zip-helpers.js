import {
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  STANDARD_ANIMATION_FRAMES_PER_ROW,
} from "../state/constants.js";
import { drawFramesToCustomAnimation } from "../canvas/draw-frames.js";
import { customAnimationSize } from "../custom-animations.js";
import {
  canvasToBlob,
  get2DContext,
  hasContentInRegion,
} from "../canvas/canvas-utils.js";
import { debugLog, debugWarn } from "../utils/debug.js";
import { getAllCredits, creditsToTxt, creditsToCsv } from "./credits.js";
import { exportStateAsJSON } from "../state/json.js";

/**
 * Maps direction names to row indices on a custom-animation grid (LPC order:
 * up, left, down, right).
 */
export const CUSTOM_ANIM_DIRECTION_TO_ROW = Object.freeze({
  up: 0,
  left: 1,
  down: 2,
  right: 3,
});

function createFrameCanvasPool(poolSize, frameWidth, frameHeight) {
  const canvasPool = [];
  for (let i = 0; i < poolSize; i++) {
    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = frameWidth;
    frameCanvas.height = frameHeight;
    const frameCtx = get2DContext(frameCanvas, true);
    if (frameCtx) {
      canvasPool.push({ canvas: frameCanvas, ctx: frameCtx });
    }
  }
  return canvasPool;
}

function blitFrameFromSheet(destCtx, sourceCanvas, sourceX, sourceY, size) {
  destCtx.clearRect(0, 0, size, size);
  destCtx.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    size,
    size,
    0,
    0,
    size,
    size,
  );
}

/**
 * @param {HTMLCanvasElement} src
 * @param {DOMRect | { x: number; y: number; width: number; height: number } | undefined} srcRect
 */
function normalizeAnimationSrcRect(src, srcRect) {
  return srcRect
    ? {
        x: srcRect.x,
        y: srcRect.y,
        width: srcRect.width,
        height: srcRect.height,
      }
    : {
        x: 0,
        y: 0,
        width: src.width,
        height: src.height,
      };
}

/**
 * @param {HTMLCanvasElement} src
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function animationSubregionHasContent(src, x, y, width, height) {
  const fromSubregion =
    x !== 0 || y !== 0 || width !== src.width || height !== src.height;
  if (fromSubregion) {
    const srcCtx = get2DContext(src, true);
    if (!hasContentInRegion(srcCtx, x, y, width, height)) {
      return false;
    }
  }
  return true;
}

/**
 * Draws the slice from `src` onto `animCanvas` (must already match width/height).
 */
function drawAnimationSliceOntoCanvas(src, x, y, width, height, animCanvas) {
  const animCtx = get2DContext(animCanvas, true);
  if (!animCtx) {
    throw new Error("Failed to get canvas context");
  }
  animCtx.drawImage(src, x, y, width, height, 0, 0, width, height);
}

export function newAnimationFromSheet(src, srcRect) {
  const { x, y, width, height } = normalizeAnimationSrcRect(src, srcRect);
  if (!animationSubregionHasContent(src, x, y, width, height)) {
    return null;
  }

  const animCanvas = document.createElement("canvas");
  animCanvas.width = width;
  animCanvas.height = height;
  drawAnimationSliceOntoCanvas(src, x, y, width, height, animCanvas);

  return animCanvas;
}

/**
 * @param {{ phase: (name: string, fn: () => void | Promise<void>) => Promise<void> } | null | undefined} profiler
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
async function runZipProfilerPhase(profiler, name, fn) {
  if (profiler && typeof profiler.phase === "function") {
    return profiler.phase(name, fn);
  }
  return fn();
}

/**
 * @param {{ incrementCounter?: (n: string, d?: number) => void; addCounter?: (n: string, a: number) => void } | null | undefined} profiler
 * @param {Blob} blob
 */
function zipProfilerNotePngEncode(profiler, blob) {
  if (!profiler || !blob) return;
  if (typeof profiler.incrementCounter === "function") {
    profiler.incrementCounter("pngEncodeCount");
  }
  if (typeof profiler.addCounter === "function") {
    profiler.addCounter("totalPngBytes", blob.size);
  }
}

/**
 * @param {{ incrementCounter?: (n: string, d?: number) => void } | null | undefined} profiler
 */
function zipProfilerNoteDrawAndSlice(profiler) {
  if (!profiler || typeof profiler.incrementCounter !== "function") return;
  profiler.incrementCounter("drawAndSliceCount");
}

/**
 * @param {{ incrementCounter?: (n: string, d?: number) => void } | null | undefined} profiler
 */
function zipProfilerNoteZipEntry(profiler) {
  if (!profiler || typeof profiler.incrementCounter !== "function") return;
  profiler.incrementCounter("zipFileEntryCount");
}

/**
 * @param {{
 *   profiler?: {
 *     phase: (name: string, fn: () => void | Promise<void>) => Promise<void>;
 *     incrementCounter?: (name: string, delta?: number) => void;
 *     addCounter?: (name: string, amount: number) => void;
 *   };
 * }} [options]
 */
export async function addAnimationToZipFolder(
  folder,
  fileName,
  srcCanvas,
  srcRect,
  options = {},
) {
  const profiler = options.profiler ?? null;
  if (srcCanvas) {
    let animCanvas;
    /** @type {Blob | undefined} */
    let blob;
    await runZipProfilerPhase(profiler, "drawAndSlice", async () => {
      animCanvas = newAnimationFromSheet(srcCanvas, srcRect);
    });
    if (animCanvas) {
      zipProfilerNoteDrawAndSlice(profiler);
      await runZipProfilerPhase(profiler, "pngEncode", async () => {
        blob = await canvasToBlob(animCanvas);
      });
      if (blob) {
        zipProfilerNotePngEncode(profiler, blob);
      }
    }
    if (animCanvas) {
      if (blob) {
        const zipEntryName = fileName.endsWith(".png")
          ? fileName
          : `${fileName}.png`;
        debugLog(
          `Adding to ZIP: `,
          `${folder.root}${zipEntryName}`,
          "size: ",
          blob.size,
        );
        await runZipProfilerPhase(profiler, "zipFile", async () => {
          folder.file(zipEntryName, blob);
        });
        zipProfilerNoteZipEntry(profiler);
      }
      return animCanvas;
    }
  }
}

/**
 * Renders the full custom animation layout from drawable `src` (e.g. a layer
 * sprite) onto a new canvas sized to that animation via `customAnimationSize`.
 */
export function newStandardAnimationForCustomAnimation(src, custAnim) {
  const custCanvas = document.createElement("canvas");
  const { width: custWidth, height: custHeight } =
    customAnimationSize(custAnim);
  custCanvas.width = custWidth;
  custCanvas.height = custHeight;
  const custCtx = get2DContext(custCanvas, true);
  drawFramesToCustomAnimation(custCtx, custAnim, 0, src, null);
  return custCanvas;
}

/**
 * Encodes the standard-animation slice for a custom animation as PNG and adds
 * it to a JSZip subfolder under the given filename.
 *
 * @param {{
 *   profiler?: {
 *     phase: (name: string, fn: () => void | Promise<void>) => Promise<void>;
 *     incrementCounter?: (name: string, delta?: number) => void;
 *     addCounter?: (name: string, amount: number) => void;
 *   };
 * }} [options]
 */
export async function addStandardAnimationToZipCustomFolder(
  custAnimFolder,
  itemFileName,
  src,
  custAnim,
  options = {},
) {
  const profiler = options.profiler ?? null;
  /** @type {HTMLCanvasElement | undefined} */
  let custCanvas;
  await runZipProfilerPhase(profiler, "drawAndSlice", async () => {
    custCanvas = newStandardAnimationForCustomAnimation(src, custAnim);
  });
  if (!custCanvas) {
    return undefined;
  }
  zipProfilerNoteDrawAndSlice(profiler);
  let custBlob;
  await runZipProfilerPhase(profiler, "pngEncode", async () => {
    custBlob = await canvasToBlob(custCanvas);
  });
  if (custBlob) {
    zipProfilerNotePngEncode(profiler, custBlob);
  }
  await runZipProfilerPhase(profiler, "zipFile", async () => {
    custAnimFolder.file(itemFileName, custBlob);
  });
  zipProfilerNoteZipEntry(profiler);
  return custCanvas;
}

/**
 * Splits a built-in LPC animation canvas (rows = directions, 13 frames per row)
 * into per-frame canvases. Skips frames that are fully transparent in the sheet.
 */
export function extractFramesFromAnimation(
  animationCanvas,
  animationName,
  directions = ["up", "down", "left", "right"],
) {
  const frames = {};
  const config = ANIMATION_CONFIGS[animationName];
  if (!config) return frames;

  const frameWidth = FRAME_SIZE;
  const frameHeight = FRAME_SIZE;
  const framesPerRow = STANDARD_ANIMATION_FRAMES_PER_ROW;

  const sourceCtx = get2DContext(animationCanvas, true);
  if (!sourceCtx) {
    console.error("Failed to get animation canvas context");
    return frames;
  }

  const canvasPool = createFrameCanvasPool(
    directions.length * framesPerRow,
    frameWidth,
    frameHeight,
  );

  let poolIndex = 0;

  for (
    let dirIndex = 0;
    dirIndex < directions.length && dirIndex < config.num;
    dirIndex++
  ) {
    const direction = directions[dirIndex];
    frames[direction] = [];

    const sourceY = dirIndex * frameHeight;

    const rowImageData = sourceCtx.getImageData(
      0,
      sourceY,
      animationCanvas.width,
      frameHeight,
    );

    for (let frameIndex = 0; frameIndex < framesPerRow; frameIndex++) {
      const sourceX = frameIndex * frameWidth;

      const hasContent = checkFrameContentFromImageData(
        rowImageData,
        sourceX,
        frameWidth,
        frameHeight,
      );

      if (hasContent && poolIndex < canvasPool.length) {
        const { canvas: frameCanvas, ctx: frameCtx } = canvasPool[poolIndex++];

        blitFrameFromSheet(
          frameCtx,
          animationCanvas,
          sourceX,
          sourceY,
          frameWidth,
        );

        frames[direction].push({
          canvas: frameCanvas,
          frameNumber: frameIndex + 1,
        });
      }
    }
  }

  return frames;
}

/**
 * Returns whether a horizontal slice of pre-fetched row `ImageData` has any
 * non-transparent pixel in the frame column starting at `startX`.
 */
export function checkFrameContentFromImageData(
  imageData,
  startX,
  frameWidth,
  frameHeight,
) {
  const data = imageData.data;
  const imageWidth = imageData.width;

  for (let y = 0; y < frameHeight; y++) {
    for (let x = startX; x < startX + frameWidth && x < imageWidth; x++) {
      const pixelIndex = (y * imageWidth + x) * 4;
      const alpha = data[pixelIndex + 3];
      if (alpha > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Splits a custom-animation canvas using that animation's `frameSize` and
 * `frames` layout; emits one small canvas per frame per direction (all frames
 * included, including fully transparent ones).
 */
export function extractFramesFromCustomAnimation(
  animationCanvas,
  customAnimationDef,
  directions = ["up", "down", "left", "right"],
) {
  const frames = {};
  const frameSize = customAnimationDef.frameSize;
  const animationFrames = customAnimationDef.frames;

  debugLog(`Extracting frames from custom animation:`, {
    frameSize,
    animationFrames,
    canvasSize: {
      width: animationCanvas.width,
      height: animationCanvas.height,
    },
  });

  const sourceCtx = get2DContext(animationCanvas, true);
  if (!sourceCtx) {
    console.error("Failed to get custom animation canvas context");
    return frames;
  }

  const maxFrames = Math.max(...animationFrames.map((row) => row.length));
  const canvasPool = createFrameCanvasPool(
    directions.length * maxFrames,
    frameSize,
    frameSize,
  );

  let poolIndex = 0;

  for (const direction of directions) {
    const dirIndex = CUSTOM_ANIM_DIRECTION_TO_ROW[direction];
    if (dirIndex >= animationFrames.length) {
      debugLog(
        `Skipping direction ${direction} (index ${dirIndex}) - not enough rows in animation frames`,
      );
      continue;
    }

    frames[direction] = [];
    const frameRow = animationFrames[dirIndex];
    const sourceY = dirIndex * frameSize;

    debugLog(`Processing direction ${direction} (row ${dirIndex}):`, frameRow);

    try {
      sourceCtx.getImageData(0, sourceY, animationCanvas.width, frameSize);
    } catch (e) {
      debugWarn(`Failed to get image data for row ${dirIndex}:`, e);
      continue;
    }

    for (let frameIndex = 0; frameIndex < frameRow.length; frameIndex++) {
      const sourceX = frameIndex * frameSize;

      if (poolIndex >= canvasPool.length) break;

      const { canvas: frameCanvas, ctx: frameCtx } = canvasPool[poolIndex++];

      blitFrameFromSheet(
        frameCtx,
        animationCanvas,
        sourceX,
        sourceY,
        frameSize,
      );

      frames[direction].push({
        canvas: frameCanvas,
        frameNumber: frameIndex + 1,
      });

      debugLog(`Added frame ${frameIndex + 1} for direction ${direction}`);
    }
  }

  return frames;
}

/** ISO-like filename token for ZIP names (no colons). */
export function zipExportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
}

/** @returns {boolean} */
export function guardZipExportEnvironment() {
  if (!window.canvasRenderer || !window.JSZip) {
    alert("JSZip library not loaded");
    return false;
  }
  return true;
}

/**
 * Writes `character.json` at zip root and `credits.txt` / `credits.csv` under `creditsFolder`.
 */
export function addCharacterJsonAndCredits(zip, creditsFolder, state, layers) {
  zip.file("character.json", exportStateAsJSON(state, layers));
  const allCredits = getAllCredits(state.selections, state.bodyType);
  creditsFolder.file("credits.txt", creditsToTxt(allCredits));
  creditsFolder.file("credits.csv", creditsToCsv(allCredits));
}

/**
 * Runs the `generateZip` profiler phase, `generateAsync({ type: "blob" })`, and `logReport()`.
 */
export async function zipGenerateBlobWithProfiler(profiler, zip) {
  let zipBlob;
  await profiler.phase("generateZip", async () => {
    zipBlob = await zip.generateAsync({ type: "blob" });
  });
  profiler.logReport();
  if (
    typeof window !== "undefined" &&
    profiler &&
    typeof profiler.toMetadata === "function"
  ) {
    const meta = profiler.toMetadata();
    window.__lastZipExportProfile = meta;
    window.__zipExportProfiles = window.__zipExportProfiles || {};
    window.__zipExportProfiles[meta.exportKind] = meta;
  }
  return zipBlob;
}

export function downloadZipBlob(zipBlob, filename) {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

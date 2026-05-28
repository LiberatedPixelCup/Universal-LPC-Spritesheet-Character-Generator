import { ok, err, type Result } from "neverthrow";
import {
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  STANDARD_ANIMATION_FRAMES_PER_ROW,
  DIRECTIONS,
} from "../state/constants.ts";
import { drawFramesToCustomAnimation } from "../canvas/draw-frames.ts";
import {
  customAnimationSize,
  type CustomAnimationDefinition,
} from "../custom-animations.ts";
import {
  canvasToBlob,
  get2DContext,
  hasContentInRegion,
} from "../canvas/canvas-utils.ts";
import { debugLog, debugWarn } from "../utils/debug.ts";
import { getAllCredits, creditsToTxt, creditsToCsv } from "./credits.ts";
import { exportStateAsJSON, serializeLayersForJson } from "../state/json.ts";
import type { ZipExportProfiler } from "../performance-profiler.ts";
import type { State } from "../state/state.ts";
import type { DrawCall } from "../canvas/renderer.ts";
import type { CatalogReader } from "../state/catalog.ts";

/**
 * Subset of the JSZip folder API consumed by these helpers and downstream
 * `zip.ts`. `window.JSZip` is provided by the runtime bundle. Pinning the
 * shape here lets the consumer reuse it via a single import.
 */
export type ZipFolder = {
  /** Present on JSZip folder instances; used in debug logging. */
  root?: string;
  folder: (name: string) => ZipFolder;
  file: (name: string, data: Blob | string) => void;
  generateAsync: (options: { type: "blob" }) => Promise<Blob>;
};

type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Maps direction names to row indices on a custom-animation grid (LPC order:
 * up, left, down, right). Should match DIRECTIONS from constants.ts.
 */
export const CUSTOM_ANIM_DIRECTION_TO_ROW: Readonly<Record<string, number>> =
  Object.freeze(
    DIRECTIONS.reduce<Record<string, number>>((acc, dir, index) => {
      acc[dir] = index;
      return acc;
    }, {}),
  );

type FrameCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

function createFrameCanvasPool(
  poolSize: number,
  frameWidth: number,
  frameHeight: number,
): FrameCanvas[] {
  const canvasPool: FrameCanvas[] = [];
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

function blitFrameFromSheet(
  destCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  size: number,
): void {
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

function normalizeAnimationSrcRect(
  src: HTMLCanvasElement,
  srcRect: DOMRect | RectLike | undefined,
): RectLike {
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

function animationSubregionHasContent(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
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

/** Draws the slice from `src` onto `animCanvas` (must already match width/height). */
function drawAnimationSliceOntoCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  animCanvas: HTMLCanvasElement,
): void {
  const animCtx = get2DContext(animCanvas, true);
  if (!animCtx) {
    throw new Error("Failed to get canvas context");
  }
  animCtx.drawImage(src, x, y, width, height, 0, 0, width, height);
}

/** Why a slice operation produced no canvas (vs. the caller misusing the API). */
export type AnimationSliceError = { kind: "empty-subregion" };

/**
 * Carve a subregion out of `src` onto a fresh canvas. Errs with
 * `empty-subregion` when the region has no non-transparent pixels (callers
 * route this to "skip the export" without conflating it with a load error).
 * Use {@link addCanvasToZip} for the "encode the whole source" case.
 */
export function newAnimationFromSheet(
  src: HTMLCanvasElement,
  srcRect: DOMRect | RectLike,
): Result<HTMLCanvasElement, AnimationSliceError> {
  const { x, y, width, height } = normalizeAnimationSrcRect(src, srcRect);
  if (!animationSubregionHasContent(src, x, y, width, height)) {
    return err({ kind: "empty-subregion" });
  }

  const animCanvas = document.createElement("canvas");
  animCanvas.width = width;
  animCanvas.height = height;
  drawAnimationSliceOntoCanvas(src, x, y, width, height, animCanvas);

  return ok(animCanvas);
}

/** Subset of `ZipExportProfiler` used by this module's instrumentation hooks. */
type ZipHelpersProfiler = Pick<
  ZipExportProfiler,
  "phase" | "incrementCounter" | "addCounter"
>;

async function runZipProfilerPhase(
  profiler: ZipHelpersProfiler | null | undefined,
  name: string,
  fn: () => void | Promise<void>,
): Promise<void> {
  if (profiler && typeof profiler.phase === "function") {
    return profiler.phase(name, fn);
  }
  await fn();
}

function zipProfilerNotePngEncode(
  profiler: ZipHelpersProfiler | null | undefined,
  blob: Blob | undefined,
): void {
  if (!profiler || !blob) return;
  if (typeof profiler.incrementCounter === "function") {
    profiler.incrementCounter("pngEncodeCount");
  }
  if (typeof profiler.addCounter === "function") {
    profiler.addCounter("totalPngBytes", blob.size);
  }
}

function zipProfilerNoteDrawAndSlice(
  profiler: ZipHelpersProfiler | null | undefined,
): void {
  if (!profiler || typeof profiler.incrementCounter !== "function") return;
  profiler.incrementCounter("drawAndSliceCount");
}

function zipProfilerNoteZipEntry(
  profiler: ZipHelpersProfiler | null | undefined,
): void {
  if (!profiler || typeof profiler.incrementCounter !== "function") return;
  profiler.incrementCounter("zipFileEntryCount");
}

type ZipPhaseOptions = { profiler?: ZipHelpersProfiler };

function ensureZipEntryName(fileName: string): string {
  return fileName.endsWith(".png") ? fileName : `${fileName}.png`;
}

async function encodeAndAddToZip(
  folder: ZipFolder,
  fileName: string,
  canvas: HTMLCanvasElement,
  profiler: ZipHelpersProfiler | null,
): Promise<void> {
  let blob: Blob | undefined;
  await runZipProfilerPhase(profiler, "pngEncode", async () => {
    blob = await canvasToBlob(canvas);
  });
  if (!blob) return;
  zipProfilerNotePngEncode(profiler, blob);

  const zipEntryName = ensureZipEntryName(fileName);
  debugLog(
    `Adding to ZIP: `,
    `${folder.root ?? ""}${zipEntryName}`,
    "size: ",
    blob.size,
  );
  const sealedBlob: Blob = blob;
  await runZipProfilerPhase(profiler, "zipFile", async () => {
    folder.file(zipEntryName, sealedBlob);
  });
  zipProfilerNoteZipEntry(profiler);
}

/** Why an "add to zip" operation produced no entry. */
export type ZipAddError = { kind: "missing-src" } | { kind: "empty-subregion" };

/**
 * Carve a subregion out of `srcCanvas` and add it as a PNG entry under
 * `fileName`. Errs with `empty-subregion` when the subregion is fully
 * transparent (no entry written), or `missing-src` when `srcCanvas` is
 * falsy. Returns the new sliced canvas on success.
 */
export async function addAnimationSliceToZip(
  folder: ZipFolder,
  fileName: string,
  srcCanvas: HTMLCanvasElement,
  srcRect: DOMRect | RectLike,
  options: ZipPhaseOptions = {},
): Promise<Result<HTMLCanvasElement, ZipAddError>> {
  if (!srcCanvas) return err({ kind: "missing-src" });

  const profiler = options.profiler ?? null;
  let sliceResult: Result<HTMLCanvasElement, AnimationSliceError> | undefined;
  await runZipProfilerPhase(profiler, "drawAndSlice", async () => {
    sliceResult = newAnimationFromSheet(srcCanvas, srcRect);
  });
  // `runZipProfilerPhase` runs `fn` synchronously enough for `sliceResult`
  // to be set before this line; the `!` documents that contract.
  const sliced = sliceResult!;
  if (sliced.isErr()) return err(sliced.error);

  zipProfilerNoteDrawAndSlice(profiler);
  await encodeAndAddToZip(folder, fileName, sliced.value, profiler);
  return ok(sliced.value);
}

/**
 * Add the whole `srcCanvas` as a PNG entry under `fileName`. No slicing, no
 * subregion-content check. Errs with `missing-src` when `srcCanvas` is
 * falsy.
 */
export async function addCanvasToZip(
  folder: ZipFolder,
  fileName: string,
  srcCanvas: HTMLCanvasElement,
  options: ZipPhaseOptions = {},
): Promise<Result<HTMLCanvasElement, ZipAddError>> {
  if (!srcCanvas) return err({ kind: "missing-src" });

  const profiler = options.profiler ?? null;
  await encodeAndAddToZip(folder, fileName, srcCanvas, profiler);
  return ok(srcCanvas);
}

/**
 * Renders the full custom animation layout from drawable `src` (e.g. a layer
 * sprite) onto a new canvas sized to that animation via `customAnimationSize`.
 */
export function newStandardAnimationForCustomAnimation(
  src: HTMLCanvasElement | HTMLImageElement,
  custAnim: CustomAnimationDefinition,
): HTMLCanvasElement {
  const custCanvas = document.createElement("canvas");
  const { width: custWidth, height: custHeight } =
    customAnimationSize(custAnim);
  custCanvas.width = custWidth;
  custCanvas.height = custHeight;
  const custCtx = get2DContext(custCanvas, true);
  if (!custCtx) {
    throw new Error("Failed to get canvas context");
  }
  drawFramesToCustomAnimation(custCtx, custAnim, 0, src);
  return custCanvas;
}

/**
 * Encodes the standard-animation slice for a custom animation as PNG and adds
 * it to a JSZip subfolder under the given filename.
 */
export async function addStandardAnimationToZipCustomFolder(
  custAnimFolder: ZipFolder,
  itemFileName: string,
  src: HTMLCanvasElement | HTMLImageElement,
  custAnim: CustomAnimationDefinition,
  options: ZipPhaseOptions = {},
): Promise<HTMLCanvasElement | undefined> {
  const profiler = options.profiler ?? null;
  let custCanvas: HTMLCanvasElement | undefined;
  await runZipProfilerPhase(profiler, "drawAndSlice", async () => {
    custCanvas = newStandardAnimationForCustomAnimation(src, custAnim);
  });
  if (!custCanvas) {
    return undefined;
  }
  zipProfilerNoteDrawAndSlice(profiler);
  let custBlob: Blob | undefined;
  await runZipProfilerPhase(profiler, "pngEncode", async () => {
    custBlob = await canvasToBlob(custCanvas as HTMLCanvasElement);
  });
  if (custBlob) {
    zipProfilerNotePngEncode(profiler, custBlob);
  }
  await runZipProfilerPhase(profiler, "zipFile", async () => {
    if (custBlob) custAnimFolder.file(itemFileName, custBlob);
  });
  zipProfilerNoteZipEntry(profiler);
  return custCanvas;
}

export type ExtractedFrames = Record<
  string,
  Array<{ canvas: HTMLCanvasElement; frameNumber: number }>
>;

/**
 * Splits a built-in LPC animation canvas (rows = directions, 13 frames per row)
 * into per-frame canvases. Skips frames that are fully transparent in the sheet.
 */
export function extractFramesFromAnimation(
  animationCanvas: HTMLCanvasElement,
  animationName: string,
  directions: readonly string[] = DIRECTIONS,
): ExtractedFrames {
  const frames: ExtractedFrames = {};
  const config = (
    ANIMATION_CONFIGS as Record<
      string,
      { row: number; num: number; cycle: number[] }
    >
  )[animationName];
  if (!config) return frames;

  const frameWidth = FRAME_SIZE;
  const frameHeight = FRAME_SIZE;
  const framesPerRow = STANDARD_ANIMATION_FRAMES_PER_ROW;

  const sourceCtx = get2DContext(animationCanvas, true);
  if (!sourceCtx) return frames;

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
  imageData: ImageData,
  startX: number,
  frameWidth: number,
  frameHeight: number,
): boolean {
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
  animationCanvas: HTMLCanvasElement,
  customAnimationDef: CustomAnimationDefinition,
  directions: readonly string[] = DIRECTIONS,
): ExtractedFrames {
  const frames: ExtractedFrames = {};
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
  if (!sourceCtx) return frames;

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
export function zipExportTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
}

/** Globals required for ZIP export at runtime. */
type WindowWithZipDeps = Window & {
  canvasRenderer?: unknown;
  JSZip?: new () => ZipFolder;
};

export function guardZipExportEnvironment(): boolean {
  const w = window as WindowWithZipDeps;
  if (!w.canvasRenderer || !w.JSZip) {
    alert("JSZip library not loaded");
    return false;
  }
  return true;
}

/**
 * Writes `character.json` at zip root and `credits.txt` / `credits.csv` under `creditsFolder`.
 */
export function addCharacterJsonAndCredits(
  catalog: CatalogReader,
  zip: ZipFolder,
  creditsFolder: ZipFolder,
  state: State,
  drawCalls: readonly DrawCall[],
): void {
  zip.file(
    "character.json",
    exportStateAsJSON(catalog, state, serializeLayersForJson(drawCalls)),
  );
  const allCredits = getAllCredits(catalog, state.selections, state.bodyType);
  creditsFolder.file("credits.txt", creditsToTxt(allCredits));
  creditsFolder.file("credits.csv", creditsToCsv(allCredits));
}

/** Exposes a snapshot of the last completed export's profile for debugging. */
type WindowWithProfileSnapshot = Window & {
  __lastZipExportProfile?: ReturnType<ZipExportProfiler["toMetadata"]>;
  __zipExportProfiles?: Record<
    string,
    ReturnType<ZipExportProfiler["toMetadata"]>
  >;
};

/** Runs the `generateZip` profiler phase, `generateAsync({ type: "blob" })`, and `logReport()`. */
export async function zipGenerateBlobWithProfiler(
  profiler: ZipExportProfiler,
  zip: ZipFolder,
): Promise<Blob> {
  let zipBlob: Blob | undefined;
  await profiler.phase("generateZip", async () => {
    zipBlob = await zip.generateAsync({ type: "blob" });
  });
  profiler.logReport();
  if (
    typeof window !== "undefined" &&
    typeof profiler.toMetadata === "function"
  ) {
    const meta = profiler.toMetadata();
    const w = window as WindowWithProfileSnapshot;
    w.__lastZipExportProfile = meta;
    w.__zipExportProfiles = w.__zipExportProfiles || {};
    w.__zipExportProfiles[meta.exportKind] = meta;
  }
  // `zipBlob` is set inside the profiler.phase callback above.
  return zipBlob as Blob;
}

export function downloadZipBlob(zipBlob: Blob, filename: string): void {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

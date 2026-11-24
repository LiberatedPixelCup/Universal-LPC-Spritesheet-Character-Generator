// Canvas utility functions

import type { CatalogReader } from "../state/catalog.ts";
import { debugWarn } from "../utils/debug.ts";

/**
 * Encode a canvas as a PNG Blob (rejects if toBlob yields null or throws).
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      reject(new Error(`Canvas to Blob conversion failed: ${msg}`));
    }
  });
}

/**
 * Get 2D context with image smoothing disabled for crisp pixel rendering.
 * Throws if the canvas cannot produce a 2D context (e.g. it has already
 * been claimed by a different context type like WebGL — a canvas can
 * only ever have one context kind).
 */
export function get2DContext(
  canvas: HTMLCanvasElement,
  willReadFrequently: boolean = false,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently });
  if (!ctx) {
    throw new Error(
      "Failed to get 2D context (canvas may already have a different context type)",
    );
  }
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Whether a rectangular region has any non-zero channel (including alpha) in its ImageData.
 */
export function hasContentInRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  try {
    const imageData = ctx.getImageData(x, y, width, height);
    return imageData.data.some((pixel) => pixel !== 0);
  } catch (e) {
    debugWarn("Error checking region content:", e);
    return false;
  }
}

export function getZPos(
  catalog: CatalogReader,
  itemId: string,
  layerNum: number = 1,
): number {
  const result = catalog.getItemMerged(itemId);
  if (result.isErr()) return 100;

  const layerKey = `layer_${layerNum}`;
  const layer = result.value.layers[layerKey];
  return layer?.zPos ?? 100;
}

const checkerboardTiles = new Map<number, HTMLCanvasElement>();

function getCheckerboardTile(squareSize: number): HTMLCanvasElement {
  const cached = checkerboardTiles.get(squareSize);
  if (cached) return cached;
  const tile = document.createElement("canvas");
  tile.width = squareSize * 2;
  tile.height = squareSize * 2;
  const tileCtx = get2DContext(tile);
  tileCtx.fillStyle = "#CCCCCC";
  tileCtx.fillRect(0, 0, squareSize, squareSize);
  tileCtx.fillRect(squareSize, squareSize, squareSize, squareSize);
  tileCtx.fillStyle = "#999999";
  tileCtx.fillRect(squareSize, 0, squareSize, squareSize);
  tileCtx.fillRect(0, squareSize, squareSize, squareSize);
  checkerboardTiles.set(squareSize, tile);
  return tile;
}

/**
 * Draw a checkered transparency background (like image editors).
 */
export function drawTransparencyBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  squareSize: number = 8,
): void {
  const pattern = context.createPattern(
    getCheckerboardTile(squareSize),
    "repeat",
  );
  if (pattern) {
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
    return;
  }

  const lightGray = "#CCCCCC";
  const darkGray = "#999999";
  for (let y = 0; y < height; y += squareSize) {
    for (let x = 0; x < width; x += squareSize) {
      const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
      const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
      context.fillStyle = isEvenRow === isEvenCol ? lightGray : darkGray;
      context.fillRect(x, y, squareSize, squareSize);
    }
  }
}

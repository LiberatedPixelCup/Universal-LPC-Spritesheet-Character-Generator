/** Shared canvas helpers for palette-recolor browser specs. */
import { expect } from "chai";

export type Rgb = { r: number; g: number; b: number };
export type Rgba = Rgb & { a: number };

/** Image sources the compositor and recolor cache return. */
export type PixelSource = HTMLCanvasElement | HTMLImageElement | ImageBitmap;

function require2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable");
  }
  return ctx;
}

export function solidCanvas(
  r: number,
  g: number,
  b: number,
  w = 4,
  h = 4,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = require2dContext(c);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Two-color 4x4 canvas: left half color A, right half color B. */
export function splitCanvas(a: Rgb, b: Rgb): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 4;
  const ctx = require2dContext(c);
  ctx.fillStyle = `rgb(${a.r},${a.g},${a.b})`;
  ctx.fillRect(0, 0, 2, 4);
  ctx.fillStyle = `rgb(${b.r},${b.g},${b.b})`;
  ctx.fillRect(2, 0, 2, 4);
  return c;
}

/** Blit an ImageBitmap (or pass through a canvas) so tests can use getImageData. */
export function as2dCanvas(source: PixelSource): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) {
    return source;
  }
  const c = document.createElement("canvas");
  c.width = source.width;
  c.height = source.height;
  require2dContext(c).drawImage(source, 0, 0);
  return c;
}

export function readPixel(source: PixelSource, x: number, y: number): Rgba {
  const canvas = as2dCanvas(source);
  const data = require2dContext(canvas).getImageData(x, y, 1, 1).data;
  return { r: data[0], g: data[1], b: data[2], a: data[3] };
}

/**
 * Compositor path: `drawImage` the snapshot onto a dest canvas, then assert
 * dest has an opaque remapped pixel. Matches `renderer.ts`, not a readback
 * of the snapshot itself.
 */
export function drawSnapshotToDest(snapshot: PixelSource): HTMLCanvasElement {
  const dest = document.createElement("canvas");
  dest.width = snapshot.width;
  dest.height = snapshot.height;
  require2dContext(dest).drawImage(snapshot, 0, 0);
  return dest;
}

export function assertOpaqueRemap(
  dest: PixelSource,
  rgb: Rgb,
  x = 0,
  y = 0,
): void {
  expect(readPixel(dest, x, y)).to.deep.include({
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: 255,
  });
}

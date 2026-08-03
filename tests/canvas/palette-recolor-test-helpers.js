/** Shared canvas helpers for palette-recolor browser specs. */

export function solidCanvas(r, g, b, w = 4, h = 4) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Two-color 4x4 canvas: left half color A, right half color B. */
export function splitCanvas(a, b) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 4;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${a.r},${a.g},${a.b})`;
  ctx.fillRect(0, 0, 2, 4);
  ctx.fillStyle = `rgb(${b.r},${b.g},${b.b})`;
  ctx.fillRect(2, 0, 2, 4);
  return c;
}

export function readPixel(canvas, x, y) {
  const data = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
  return { r: data[0], g: data[1], b: data[2], a: data[3] };
}

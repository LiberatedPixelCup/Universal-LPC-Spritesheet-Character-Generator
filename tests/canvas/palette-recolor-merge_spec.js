/**
 * Tests for the single-pass multi-palette merge — `recolorImage` now accepts
 * an array of `{source, target}` mappings and applies them all in one pass.
 *
 * Exercised via `recolorImage` (CPU path forced). The WebGL path and CPU path
 * share the same semantics; pixel-level correctness of the CPU implementation
 * is sufficient to guard the packing logic against regressions.
 */
import { expect } from "chai";
import { describe, it, before, after } from "mocha-globals";
import {
  recolorImage,
  recolorWithPalette,
  setPaletteRecolorMode,
  getPaletteRecolorConfig,
} from "../../sources/canvas/palette-recolor.ts";
import { getPaletteMetadata } from "../../sources/state/catalog.ts";

function solidCanvas(r, g, b, w = 4, h = 4) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

/** Two-color 4x4 canvas: left half color A, right half color B. */
function splitCanvas(a, b) {
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

function readPixel(canvas, x, y) {
  const data = canvas.getContext("2d").getImageData(x, y, 1, 1).data;
  return { r: data[0], g: data[1], b: data[2], a: data[3] };
}

describe("canvas/palette-recolor.ts single-pass merge (CPU path)", () => {
  let previousMode;

  before(() => {
    previousMode = getPaletteRecolorConfig().activeMode;
    setPaletteRecolorMode("cpu");
  });

  after(() => {
    if (previousMode === "webgl") setPaletteRecolorMode("webgl");
  });

  it("applies a single-mapping array (backward-compat shape)", () => {
    const img = solidCanvas(255, 0, 0);
    const mappings = [{ source: ["#FF0000"], target: ["#0000FF"] }];

    const out = recolorImage(img, mappings);

    const pixel = readPixel(out, 0, 0);
    expect(pixel.r).to.equal(0);
    expect(pixel.g).to.equal(0);
    expect(pixel.b).to.equal(255);
    expect(pixel.a).to.equal(255);
  });

  it("applies two palette mappings in one pass (no chaining)", () => {
    // Source image: red on the left, green on the right.
    const img = splitCanvas({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 });
    const mappings = [
      { source: ["#FF0000"], target: ["#0000FF"] }, // red → blue
      { source: ["#00FF00"], target: ["#FFFF00"] }, // green → yellow
    ];

    const out = recolorImage(img, mappings);

    const left = readPixel(out, 0, 0);
    const right = readPixel(out, 3, 0);
    expect(left).to.deep.include({ r: 0, g: 0, b: 255 });
    expect(right).to.deep.include({ r: 255, g: 255, b: 0 });
  });

  it("leaves non-matching pixels unchanged", () => {
    const img = solidCanvas(128, 64, 32);
    const mappings = [{ source: ["#FF0000"], target: ["#0000FF"] }];

    const out = recolorImage(img, mappings);

    const pixel = readPixel(out, 0, 0);
    expect(pixel.r).to.equal(128);
    expect(pixel.g).to.equal(64);
    expect(pixel.b).to.equal(32);
  });

  it("preserves alpha on transparent pixels (no recolor on alpha=0)", () => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    // Leave all pixels transparent.
    const mappings = [{ source: ["#000000"], target: ["#FF00FF"] }];

    const out = recolorImage(c, mappings);

    const pixel = readPixel(out, 0, 0);
    expect(pixel.a).to.equal(0);
  });

  it("handles an empty mappings array by leaving pixels unchanged", () => {
    const img = solidCanvas(200, 100, 50);

    const out = recolorImage(img, []);

    const pixel = readPixel(out, 0, 0);
    expect(pixel.r).to.equal(200);
    expect(pixel.g).to.equal(100);
    expect(pixel.b).to.equal(50);
  });

  it("preserves the first match in palette order when entries collide", () => {
    // If two mappings in the concatenated list match the same source pixel,
    // the shader/CPU returns on the FIRST match. This guards against someone
    // inadvertently changing the early-return semantics.
    const img = solidCanvas(255, 0, 0);
    const mappings = [
      { source: ["#FF0000"], target: ["#0000FF"] }, // first: red → blue
      { source: ["#FF0000"], target: ["#00FF00"] }, // second (ignored): red → green
    ];

    const out = recolorImage(img, mappings);

    const pixel = readPixel(out, 0, 0);
    expect(pixel).to.deep.include({ r: 0, g: 0, b: 255 });
  });

  it("falls back to the item source key when target color is missing", async () => {
    const paletteMeta = getPaletteMetadata().unwrapOr(null);
    expect(paletteMeta).to.not.equal(null);

    const bodyMaterial = paletteMeta.materials.body;
    const version = bodyMaterial.default;
    const variants = Object.keys(bodyMaterial.palettes[version] ?? {});
    const sourceVariant = variants.find((v) => v !== bodyMaterial.base);
    expect(sourceVariant).to.not.equal(undefined);

    const sourceColors = bodyMaterial.palettes[version][sourceVariant];
    const srcHex = sourceColors[0];
    const srcRgb = {
      r: parseInt(srcHex.slice(1, 3), 16),
      g: parseInt(srcHex.slice(3, 5), 16),
      b: parseInt(srcHex.slice(5, 7), 16),
    };
    const img = solidCanvas(srcRgb.r, srcRgb.g, srcRgb.b);

    const out = await recolorWithPalette(
      img,
      {},
      {
        body: {
          material: "body",
          version,
          source: sourceVariant,
          colors: sourceColors,
        },
      },
    );

    const pixel = readPixel(out, 0, 0);
    expect(pixel).to.deep.include(srcRgb);
  });
});

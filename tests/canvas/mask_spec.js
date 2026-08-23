import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import { applyTransparencyMaskToCanvas } from "../../sources/canvas/mask.ts";

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("applyTransparencyMaskToCanvas", () => {
  let canvas, ctx;

  beforeEach(() => {
    canvas = createCanvas(100, 100);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  });

  it("should make pixels with RGB (255, 44, 230) fully transparent", () => {
    // Fill the canvas with a specific color
    ctx.fillStyle = "rgb(255, 44, 230)";
    ctx.fillRect(0, 0, 100, 100);

    // Apply the transparency mask
    applyTransparencyMaskToCanvas(canvas, ctx);

    // Get the image data and check if the alpha channel is 0 for the specified color
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pix = imgData.data;

    for (let i = 0; i < pix.length; i += 4) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      const a = pix[i + 3];

      if (r === 255 && g === 44 && b === 230) {
        expect(a).to.equal(0);
      }
    }
  });

  it("leaves already-transparent mask-colored pixels unchanged", () => {
    const imgData = ctx.createImageData(1, 1);
    imgData.data[0] = 255;
    imgData.data[1] = 44;
    imgData.data[2] = 230;
    imgData.data[3] = 0;
    ctx.putImageData(imgData, 0, 0);

    const before = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    applyTransparencyMaskToCanvas(canvas, ctx);
    const after = Array.from(ctx.getImageData(0, 0, 1, 1).data);
    expect(after).to.deep.equal(before);
    expect(after[3]).to.equal(0);
  });

  it("should not modify pixels that do not match RGB (255, 44, 230)", () => {
    // Fill the canvas with a different color
    ctx.fillStyle = "rgb(0, 0, 0)";
    ctx.fillRect(0, 0, 100, 100);

    // Apply the transparency mask
    applyTransparencyMaskToCanvas(canvas, ctx);

    // Get the image data and check if the alpha channel remains unchanged
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pix = imgData.data;

    for (let i = 0; i < pix.length; i += 4) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      const a = pix[i + 3];

      if (!(r === 255 && g === 44 && b === 230)) {
        expect(a).to.equal(255); // Default alpha value for fully opaque pixels
      }
    }
  });
});

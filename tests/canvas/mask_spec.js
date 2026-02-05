import { expect } from "chai";
import sinon from "sinon";
import { applyTransparencyMaskToCanvas } from "../../sources/canvas/mask.js";

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

  it("should log an error if canvas is not initialized", () => {
    const consoleErrorStub = sinon.stub(console, "error");
    applyTransparencyMaskToCanvas(null, ctx);
    expect(consoleErrorStub.calledOnceWith("Canvas not initialized")).to.be.true;
    consoleErrorStub.restore();
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
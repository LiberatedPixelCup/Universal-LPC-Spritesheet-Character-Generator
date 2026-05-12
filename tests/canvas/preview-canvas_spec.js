/**
 * Tests for `preview-canvas.ts`'s exported functions.
 *
 * Primary purpose: lock in that `primeSpritesheetPreviewCanvasElement` and
 * `copyToPreviewCanvas` accept a real `HTMLCanvasElement` directly. If the
 *
 * Secondary: smoke-test the basic priming/copy behavior end-to-end against a
 * real offscreen canvas created by `initCanvas()`.
 */
import { expect } from "chai";
import { describe, it, afterEach } from "mocha-globals";
import {
  primeSpritesheetPreviewCanvasElement,
  copyToPreviewCanvas,
} from "../../sources/canvas/preview-canvas.ts";
import {
  initCanvas,
  resetOffscreenCanvasStateForTests,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "../../sources/canvas/renderer.ts";

describe("canvas/preview-canvas.ts", () => {
  afterEach(() => {
    resetOffscreenCanvasStateForTests();
  });

  describe("primeSpritesheetPreviewCanvasElement", () => {
    it("accepts a real HTMLCanvasElement without throwing", () => {
      const previewCanvas = document.createElement("canvas");
      expect(() =>
        primeSpritesheetPreviewCanvasElement(previewCanvas),
      ).to.not.throw();
    });

    it("sizes to the default sheet dimensions before initCanvas()", () => {
      const previewCanvas = document.createElement("canvas");
      primeSpritesheetPreviewCanvasElement(previewCanvas);
      expect(previewCanvas.width).to.equal(SHEET_WIDTH);
      expect(previewCanvas.height).to.equal(SHEET_HEIGHT);
    });

    it("sizes to the offscreen renderer canvas once initialized", () => {
      initCanvas();
      const previewCanvas = document.createElement("canvas");
      primeSpritesheetPreviewCanvasElement(previewCanvas);
      expect(previewCanvas.width).to.equal(SHEET_WIDTH);
      expect(previewCanvas.height).to.equal(SHEET_HEIGHT);
    });
  });

  describe("copyToPreviewCanvas", () => {
    it("accepts a real HTMLCanvasElement without throwing (no offscreen yet)", () => {
      const previewCanvas = document.createElement("canvas");
      expect(() => copyToPreviewCanvas(previewCanvas)).to.not.throw();
    });

    it("accepts a real HTMLCanvasElement without throwing (after initCanvas)", () => {
      initCanvas();
      const previewCanvas = document.createElement("canvas");
      expect(() =>
        copyToPreviewCanvas(previewCanvas, false, false, 1),
      ).to.not.throw();
    });

    it("matches preview canvas size to offscreen canvas size", () => {
      initCanvas();
      const previewCanvas = document.createElement("canvas");
      copyToPreviewCanvas(previewCanvas);
      expect(previewCanvas.width).to.equal(SHEET_WIDTH);
      expect(previewCanvas.height).to.equal(SHEET_HEIGHT);
    });

    it("applies CSS zoom when zoomLevel !== 1", () => {
      initCanvas();
      const previewCanvas = document.createElement("canvas");
      copyToPreviewCanvas(previewCanvas, false, false, 1.5);
      expect(previewCanvas.style.zoom).to.equal("1.5");
    });
  });
});

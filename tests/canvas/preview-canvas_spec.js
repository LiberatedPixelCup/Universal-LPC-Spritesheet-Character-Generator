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
  initPreviewCanvas,
  setPreviewCanvasZoom,
  resetPreviewCanvasForTests,
} from "../../sources/canvas/preview-canvas.ts";
import {
  initCanvas,
  resetOffscreenCanvasStateForTests,
  getCanvas,
  SHEET_HEIGHT,
  SHEET_WIDTH,
} from "../../sources/canvas/renderer.ts";
import {
  setCurrentCustomAnimations,
  setPreviewAnimation,
} from "../../sources/canvas/preview-animation.ts";
import { customAnimations } from "../../sources/custom-animations.ts";

describe("canvas/preview-canvas.ts", () => {
  afterEach(() => {
    resetOffscreenCanvasStateForTests();
    resetPreviewCanvasForTests();
    setCurrentCustomAnimations({});
    setPreviewAnimation("walk");
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

    it("draws a transparency grid under the offscreen copy", () => {
      initCanvas();
      const offscreen = getCanvas()._unsafeUnwrap();
      const offCtx = offscreen.getContext("2d");
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      const previewEl = document.createElement("canvas");
      copyToPreviewCanvas(previewEl, true, false, 1);
      const pixel = previewEl.getContext("2d").getImageData(0, 0, 1, 1).data;
      expect(pixel[3]).to.equal(255);
    });

    it("keys magenta out of the preview without mutating the offscreen canvas", () => {
      initCanvas();
      const offscreen = getCanvas()._unsafeUnwrap();
      const offCtx = offscreen.getContext("2d");
      offCtx.fillStyle = "rgb(255, 44, 230)";
      offCtx.fillRect(0, 0, 4, 4);
      const previewEl = document.createElement("canvas");
      copyToPreviewCanvas(previewEl, false, true, 1);
      const previewPixel = previewEl
        .getContext("2d")
        .getImageData(0, 0, 1, 1).data;
      expect(previewPixel[3]).to.equal(0);
      const offPixel = offCtx.getImageData(0, 0, 1, 1).data;
      expect([
        offPixel[0],
        offPixel[1],
        offPixel[2],
        offPixel[3],
      ]).to.deep.equal([255, 44, 230, 255]);
    });
  });

  describe("setPreviewCanvasZoom / initPreviewCanvas", () => {
    it("is a no-op when the preview canvas has not been initialized", () => {
      const el = document.createElement("canvas");
      expect(() => setPreviewCanvasZoom(2)).to.not.throw();
      expect(el.style.zoom).to.equal("");
    });

    it("sets CSS zoom on the initialized preview canvas", () => {
      const el = document.createElement("canvas");
      initPreviewCanvas(el);
      setPreviewCanvasZoom(1.25);
      expect(el.style.zoom).to.equal("1.25");
    });

    it("sizes the preview to a custom animation frame size", () => {
      setCurrentCustomAnimations({
        wheelchair: customAnimations.wheelchair,
      });
      setPreviewAnimation("wheelchair");
      const el = document.createElement("canvas");
      initPreviewCanvas(el);
      expect(el.width).to.equal(4 * customAnimations.wheelchair.frameSize);
      expect(el.height).to.equal(customAnimations.wheelchair.frameSize);
    });
  });
});

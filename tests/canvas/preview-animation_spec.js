import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import sinon from "sinon";
import {
  activeCustomAnimation,
  getCustomAnimations,
  repaintStaticPreviewFrameForTests,
  setCurrentCustomAnimations,
  setCustomAnimYPositions,
  setPreviewAnimation,
  startPreviewAnimation,
  stopPreviewAnimation,
} from "../../sources/canvas/preview-animation.ts";
import { initPreviewCanvas } from "../../sources/canvas/preview-canvas.ts";
import {
  initCanvas,
  resetOffscreenCanvasStateForTests,
  canvas as rendererCanvas,
} from "../../sources/canvas/renderer.ts";
import { ANIMATION_CONFIGS } from "../../sources/state/constants.ts";
import { customAnimations } from "../../sources/custom-animations.ts";
import { createState } from "../../sources/state/state.ts";

let state;

describe("canvas/preview-animation.ts", () => {
  let previewEl;
  let errorStub;

  beforeEach(() => {
    state = createState();
    window.__DISABLE_PREVIEW_ANIMATION__ = false;
    stopPreviewAnimation();
    setCurrentCustomAnimations({});
    setCustomAnimYPositions({});
    previewEl = document.createElement("canvas");
    document.body.appendChild(previewEl);
    initCanvas();
    initPreviewCanvas(previewEl);
    errorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    stopPreviewAnimation();
    window.__DISABLE_PREVIEW_ANIMATION__ = false;
    setCurrentCustomAnimations({});
    setCustomAnimYPositions({});
    setPreviewAnimation("walk");
    resetOffscreenCanvasStateForTests();
    if (previewEl?.parentNode) {
      previewEl.parentNode.removeChild(previewEl);
    }
    previewEl = null;
    errorStub.restore();
  });

  describe("setPreviewAnimation", () => {
    it("returns the walk cycle and clears activeCustomAnimation", () => {
      setPreviewAnimation("wheelchair");
      const frames = setPreviewAnimation("walk");
      expect(frames).to.deep.equal(ANIMATION_CONFIGS.walk.cycle);
      expect(activeCustomAnimation).to.equal(null);
    });

    it("returns an empty array for an unknown animation", () => {
      const frames = setPreviewAnimation("not-an-animation");
      expect(frames).to.deep.equal([]);
      expect(errorStub.calledOnce).to.be.true;
    });

    it("sets wheelchair as the active custom animation and returns first-row columns", () => {
      const frames = setPreviewAnimation("wheelchair");
      expect(activeCustomAnimation).to.equal("wheelchair");
      expect(frames).to.deep.equal([2, 2]);
    });

    it("drops frame 0 from walk_128 when skipFirstFrameInPreview is set", () => {
      const frames = setPreviewAnimation("walk_128");
      expect(activeCustomAnimation).to.equal("walk_128");
      expect(frames).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe("startPreviewAnimation / stopPreviewAnimation", () => {
    it("paints once and does not start rAF when preview animation is disabled", () => {
      window.__DISABLE_PREVIEW_ANIMATION__ = true;
      setPreviewAnimation("walk");
      startPreviewAnimation(state);
      expect(stopPreviewAnimation()).to.equal(false);
    });

    it("starts a loop that stopPreviewAnimation can cancel", () => {
      setPreviewAnimation("walk");
      startPreviewAnimation(state);
      expect(stopPreviewAnimation()).to.equal(true);
      expect(stopPreviewAnimation()).to.equal(false);
    });
  });

  describe("custom animation bookkeeping", () => {
    it("round-trips setCurrentCustomAnimations and setCustomAnimYPositions", () => {
      setCurrentCustomAnimations({ wheelchair: customAnimations.wheelchair });
      expect(getCustomAnimations()).to.deep.equal({
        wheelchair: customAnimations.wheelchair,
      });
      setCustomAnimYPositions({ wheelchair: 128 });
      setCurrentCustomAnimations({});
      expect(getCustomAnimations()).to.deep.equal({});
    });
  });

  describe("repaintStaticPreviewFrameForTests", () => {
    it("is a no-op unless the disable flag is set", () => {
      window.__DISABLE_PREVIEW_ANIMATION__ = false;
      expect(() => repaintStaticPreviewFrameForTests(state)).to.not.throw();
    });

    it("paints when the disable flag is set", () => {
      window.__DISABLE_PREVIEW_ANIMATION__ = true;
      setPreviewAnimation("walk");
      expect(() => repaintStaticPreviewFrameForTests(state)).to.not.throw();
    });

    it("draws a transparency grid when showTransparencyGrid is on", () => {
      window.__DISABLE_PREVIEW_ANIMATION__ = true;
      state.showTransparencyGrid = true;
      state.applyTransparencyMask = false;
      setPreviewAnimation("walk");
      const ctx = previewEl.getContext("2d");
      ctx.clearRect(0, 0, previewEl.width, previewEl.height);
      repaintStaticPreviewFrameForTests(state);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      expect(pixel[3]).to.equal(255);
    });

    it("keys magenta out of the preview when applyTransparencyMask is on", () => {
      window.__DISABLE_PREVIEW_ANIMATION__ = true;
      state.showTransparencyGrid = false;
      state.applyTransparencyMask = true;
      setPreviewAnimation("walk");
      if (!rendererCanvas) {
        throw new Error("renderer canvas missing");
      }
      const offCtx = rendererCanvas.getContext("2d");
      offCtx.fillStyle = "rgb(255, 44, 230)";
      const walkY = ANIMATION_CONFIGS.walk.row * 64;
      offCtx.fillRect(64, walkY, 64, 64);
      repaintStaticPreviewFrameForTests(state);
      const pixel = previewEl.getContext("2d").getImageData(64, 0, 1, 1).data;
      expect(pixel[3]).to.equal(0);
    });
  });
});

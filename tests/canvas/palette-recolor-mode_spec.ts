/**
 * Palette recolor mode routing, stats, and CPU fallback when WebGL init fails.
 */
import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} from "mocha-globals";
import {
  recolorImage,
  setPaletteRecolorMode,
  getPaletteRecolorConfig,
  getRecolorStats,
  resetRecolorStats,
  type RecolorMode,
} from "../../sources/canvas/palette-recolor.ts";
import {
  isWebGLAvailable,
  resetSharedWebGLForTests,
} from "../../sources/canvas/webgl-palette-recolor.ts";
import { solidCanvas, readPixel } from "./palette-recolor-test-helpers.ts";

describe("canvas/palette-recolor WebGL mode / stats / fallback", () => {
  let previousMode: RecolorMode;
  let sandbox: SinonSandbox | null;

  before(() => {
    previousMode = getPaletteRecolorConfig().activeMode;
  });

  after(() => {
    if (previousMode === "webgl") {
      setPaletteRecolorMode("webgl");
    } else {
      setPaletteRecolorMode("cpu");
    }
    resetSharedWebGLForTests();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetRecolorStats();
  });

  afterEach(() => {
    if (sandbox) {
      sandbox.restore();
      sandbox = null;
    }
    resetSharedWebGLForTests();
  });

  it("increments cpu stats when forced to CPU mode", async () => {
    setPaletteRecolorMode("cpu");
    const img = solidCanvas(255, 0, 0);
    const out = await recolorImage(img, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);

    expect(getRecolorStats().cpu).to.be.at.least(1);
    expect(getRecolorStats().webgl).to.equal(0);
    expect(readPixel(out, 0, 0)).to.deep.include({ r: 0, g: 0, b: 255 });
  });

  it("resetRecolorStats clears counters", async () => {
    setPaletteRecolorMode("cpu");
    await recolorImage(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    expect(getRecolorStats().cpu).to.be.at.least(1);

    resetRecolorStats();
    expect(getRecolorStats()).to.deep.equal({
      webgl: 0,
      cpu: 0,
      fallback: 0,
    });
  });

  it("falls back to CPU with correct pixels when WebGL init fails", async function (this: {
    skip: () => void;
  }) {
    // Need WebGL mode selected at the config level. If the browser never had
    // WebGL, `setPaletteRecolorMode("webgl")` keeps forceCPU true — still
    // exercise fallback by temporarily enabling useWebGL via mode after stub.
    const config = getPaletteRecolorConfig();
    if (!config.useWebGL && !isWebGLAvailable()) {
      // Probe said no WebGL at module load. Still test the catch path by
      // forcing WebGL mode attempt after stubbing context creation.
      // `setPaletteRecolorMode("webgl")` refuses when useWebGL is false, so
      // skip — fallback only runs when shouldUseWebGL is true.
      this.skip();
    }

    setPaletteRecolorMode("webgl");
    resetSharedWebGLForTests();

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    sandbox!
      .stub(HTMLCanvasElement.prototype, "getContext")
      .callsFake(function (
        this: HTMLCanvasElement,
        type: string,
        attrs?: CanvasRenderingContext2DSettings,
      ) {
        if (type === "webgl" || type === "experimental-webgl") {
          return null;
        }
        return originalGetContext.call(this, type, attrs);
      } as (...args: never[]) => unknown);

    const warnSpy = sandbox!.spy(console, "warn");
    const img = solidCanvas(255, 0, 0);
    const out = await recolorImage(img, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);

    expect(getRecolorStats().fallback).to.be.at.least(1);
    expect(warnSpy.called).to.equal(true);
    expect(readPixel(out, 0, 0)).to.deep.include({
      r: 0,
      g: 0,
      b: 255,
      a: 255,
    });
  });
});

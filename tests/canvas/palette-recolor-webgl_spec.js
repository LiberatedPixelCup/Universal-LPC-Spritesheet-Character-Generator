/**
 * WebGL palette recolor + CPU fallback coverage.
 *
 * Always-run: mode/stats routing and fallback when WebGL init fails.
 * Gated: WebGL↔CPU pixel parity (skipped when `isWebGLAvailable()` is false).
 */
import { expect } from "chai";
import sinon from "sinon";
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
} from "../../sources/canvas/palette-recolor.ts";
import {
  recolorImageWebGL,
  isWebGLAvailable,
  resetSharedWebGLForTests,
} from "../../sources/canvas/webgl-palette-recolor.ts";
import {
  solidCanvas,
  splitCanvas,
  readPixel,
} from "./palette-recolor-test-helpers.js";

describe("canvas/palette-recolor WebGL mode / stats / fallback", () => {
  let previousMode;
  let sandbox;

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

  it("increments cpu stats when forced to CPU mode", () => {
    setPaletteRecolorMode("cpu");
    const img = solidCanvas(255, 0, 0);
    const out = recolorImage(img, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);

    expect(getRecolorStats().cpu).to.be.at.least(1);
    expect(getRecolorStats().webgl).to.equal(0);
    expect(readPixel(out, 0, 0)).to.deep.include({ r: 0, g: 0, b: 255 });
  });

  it("resetRecolorStats clears counters", () => {
    setPaletteRecolorMode("cpu");
    recolorImage(solidCanvas(255, 0, 0), [
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

  it("falls back to CPU with correct pixels when WebGL init fails", function () {
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
    sandbox
      .stub(HTMLCanvasElement.prototype, "getContext")
      .callsFake(function (type, attrs) {
        if (type === "webgl" || type === "experimental-webgl") {
          return null;
        }
        return originalGetContext.call(this, type, attrs);
      });

    const warnSpy = sandbox.spy(console, "warn");
    const img = solidCanvas(255, 0, 0);
    const out = recolorImage(img, [
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

describe("canvas/webgl-palette-recolor.ts pixel parity", function () {
  let previousMode;

  before(function () {
    if (!isWebGLAvailable()) {
      this.skip();
    }
    previousMode = getPaletteRecolorConfig().activeMode;
  });

  after(function () {
    if (!isWebGLAvailable()) return;
    if (previousMode === "cpu") {
      setPaletteRecolorMode("cpu");
    } else {
      setPaletteRecolorMode("webgl");
    }
    resetSharedWebGLForTests();
  });

  beforeEach(function () {
    if (!isWebGLAvailable()) {
      this.skip();
    }
    resetRecolorStats();
    resetSharedWebGLForTests();
    setPaletteRecolorMode("webgl");
  });

  it("recolorImageWebGL returns same-size canvas and remaps solid red→blue", () => {
    const img = solidCanvas(255, 0, 0);
    const out = recolorImageWebGL(img, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    expect(out.width).to.equal(img.width);
    expect(out.height).to.equal(img.height);
    expect(readPixel(out, 0, 0)).to.deep.include({
      r: 0,
      g: 0,
      b: 255,
      a: 255,
    });
  });

  it("increments webgl stats on successful recolorImage in WebGL mode", () => {
    const img = solidCanvas(255, 0, 0);
    recolorImage(img, [{ source: ["#FF0000"], target: ["#0000FF"] }]);
    expect(getRecolorStats().webgl).to.be.at.least(1);
    expect(getRecolorStats().fallback).to.equal(0);
  });

  function assertWebGlCpuParity(img, mappings) {
    setPaletteRecolorMode("cpu");
    const cpuOut = recolorImage(img, mappings);
    setPaletteRecolorMode("webgl");
    resetSharedWebGLForTests();
    const glOut = recolorImage(img, mappings);

    expect(glOut.width).to.equal(cpuOut.width);
    expect(glOut.height).to.equal(cpuOut.height);

    const cpuData = cpuOut
      .getContext("2d")
      .getImageData(0, 0, cpuOut.width, cpuOut.height).data;
    const glData = glOut
      .getContext("2d")
      .getImageData(0, 0, glOut.width, glOut.height).data;
    expect(Array.from(glData)).to.deep.equal(Array.from(cpuData));
  }

  it("matches CPU for a single mapping", () => {
    assertWebGlCpuParity(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
  });

  it("matches CPU for dual-region two mappings", () => {
    assertWebGlCpuParity(
      splitCanvas({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }),
      [
        { source: ["#FF0000"], target: ["#0000FF"] },
        { source: ["#00FF00"], target: ["#FFFF00"] },
      ],
    );
  });

  it("matches CPU when first match wins on colliding sources", () => {
    assertWebGlCpuParity(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
      { source: ["#FF0000"], target: ["#00FF00"] },
    ]);
  });

  it("matches CPU for non-matching pixels", () => {
    assertWebGlCpuParity(solidCanvas(128, 64, 32), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
  });

  it("matches CPU for empty mappings", () => {
    assertWebGlCpuParity(solidCanvas(200, 100, 50), []);
  });

  it("matches CPU for fully transparent source", () => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    assertWebGlCpuParity(c, [{ source: ["#000000"], target: ["#FF00FF"] }]);
  });
});

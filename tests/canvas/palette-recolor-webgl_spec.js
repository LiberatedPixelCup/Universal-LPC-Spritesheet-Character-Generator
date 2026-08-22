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
  getImageToDraw,
  clearRecolorCache,
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
  as2dCanvas,
  drawSnapshotToDest,
  assertOpaqueRemap,
} from "./palette-recolor-test-helpers.js";
import { createCatalog } from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { SHEET_WIDTH } from "../../sources/canvas/renderer.ts";

const RECOLOR_ITEM_ID = "body";

const itemMetadata = {
  [RECOLOR_ITEM_ID]: {
    name: "Body",
    type_name: "body",
    recolors: [
      {
        material: "body",
        default: "ulpc",
        base: "ulpc.light",
      },
    ],
  },
};

const paletteMetadata = {
  versions: {},
  materials: {
    body: {
      default: "ulpc",
      base: "light",
      palettes: {
        ulpc: {
          light: ["#FF0000"],
          olive: ["#00FF00"],
          bronze: ["#0000FF"],
        },
      },
    },
  },
};

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

    const cpuCanvas = as2dCanvas(cpuOut);
    const glCanvas = as2dCanvas(glOut);
    const cpuData = cpuCanvas
      .getContext("2d")
      .getImageData(0, 0, cpuCanvas.width, cpuCanvas.height).data;
    const glData = glCanvas
      .getContext("2d")
      .getImageData(0, 0, glCanvas.width, glCanvas.height).data;
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

  it("reuses image and palette textures across successive recolors", () => {
    const createSpy = sinon.spy(
      WebGLRenderingContext.prototype,
      "createTexture",
    );
    try {
      const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
      recolorImageWebGL(red, [{ source: ["#FF0000"], target: ["#0000FF"] }]);
      const afterFirst = createSpy.callCount;
      expect(afterFirst).to.be.at.least(2);
      recolorImageWebGL(red, [{ source: ["#FF0000"], target: ["#00FF00"] }]);
      expect(createSpy.callCount).to.equal(afterFirst);
    } finally {
      createSpy.restore();
    }
  });

  it("throws when WebGL cannot allocate a texture", () => {
    const stub = sinon
      .stub(WebGLRenderingContext.prototype, "createTexture")
      .returns(null);
    try {
      expect(() =>
        recolorImageWebGL(solidCanvas(255, 0, 0), [
          { source: ["#FF0000"], target: ["#0000FF"] },
        ]),
      ).to.throw(/Failed to allocate WebGL texture/);
    } finally {
      stub.restore();
    }
  });

  it("same-size successive recolors are not blank", () => {
    const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    const second = recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#00FF00"] },
    ]);

    expect(first.width).to.equal(SHEET_WIDTH);
    expect(first.height).to.equal(64);
    expect(second.width).to.equal(SHEET_WIDTH);
    expect(second.height).to.equal(64);

    const firstDest = drawSnapshotToDest(first);
    const secondDest = drawSnapshotToDest(second);
    assertOpaqueRemap(firstDest, { r: 0, g: 0, b: 255 });
    assertOpaqueRemap(secondDest, { r: 0, g: 255, b: 0 });
  });

  it("held snapshot stays drawable after a later same-size recolor", () => {
    const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    recolorImageWebGL(red, [{ source: ["#FF0000"], target: ["#00FF00"] }]);

    const dest = drawSnapshotToDest(first);
    assertOpaqueRemap(dest, { r: 0, g: 0, b: 255 });
  });

  it("getImageToDraw palette change keeps both results opaque and different", async () => {
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const path = "spritesheets/body/bodies/male/walk.png";

    const olive = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      path,
    );
    const bronze = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "bronze" },
      path,
    );

    const oliveDest = drawSnapshotToDest(olive);
    const bronzeDest = drawSnapshotToDest(bronze);
    assertOpaqueRemap(oliveDest, { r: 0, g: 255, b: 0 });
    assertOpaqueRemap(bronzeDest, { r: 0, g: 0, b: 255 });
  });
});

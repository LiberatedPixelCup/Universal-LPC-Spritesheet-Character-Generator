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
  bindWebGLLiveSnapshotHandler,
} from "../../sources/canvas/palette-recolor.ts";
import {
  recolorImageWebGL,
  isWebGLAvailable,
  resetSharedWebGLForTests,
  setWebGLLiveSnapshotHandler,
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

  it("falls back to CPU with correct pixels when WebGL init fails", async function () {
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

  it("recolorImageWebGL returns same-size canvas and remaps solid red→blue", async () => {
    const img = solidCanvas(255, 0, 0);
    const out = await recolorImageWebGL(img, [
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

  it("increments webgl stats on successful recolorImage in WebGL mode", async () => {
    const img = solidCanvas(255, 0, 0);
    await recolorImage(img, [{ source: ["#FF0000"], target: ["#0000FF"] }]);
    expect(getRecolorStats().webgl).to.be.at.least(1);
    expect(getRecolorStats().fallback).to.equal(0);
  });

  async function assertWebGlCpuParity(img, mappings) {
    setPaletteRecolorMode("cpu");
    const cpuOut = await recolorImage(img, mappings);
    setPaletteRecolorMode("webgl");
    resetSharedWebGLForTests();
    const glOut = await recolorImage(img, mappings);

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

  it("matches CPU for a single mapping", async () => {
    await assertWebGlCpuParity(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
  });

  it("matches CPU for dual-region two mappings", async () => {
    await assertWebGlCpuParity(
      splitCanvas({ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }),
      [
        { source: ["#FF0000"], target: ["#0000FF"] },
        { source: ["#00FF00"], target: ["#FFFF00"] },
      ],
    );
  });

  it("matches CPU when first match wins on colliding sources", async () => {
    await assertWebGlCpuParity(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
      { source: ["#FF0000"], target: ["#00FF00"] },
    ]);
  });

  it("matches CPU for non-matching pixels", async () => {
    await assertWebGlCpuParity(solidCanvas(128, 64, 32), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
  });

  it("matches CPU for empty mappings", async () => {
    await assertWebGlCpuParity(solidCanvas(200, 100, 50), []);
  });

  it("matches CPU for fully transparent source", async () => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    await assertWebGlCpuParity(c, [
      { source: ["#000000"], target: ["#FF00FF"] },
    ]);
  });

  it("reuses image and palette textures across successive recolors", async () => {
    const createSpy = sinon.spy(
      WebGLRenderingContext.prototype,
      "createTexture",
    );
    try {
      const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
      await recolorImageWebGL(red, [
        { source: ["#FF0000"], target: ["#0000FF"] },
      ]);
      const afterFirst = createSpy.callCount;
      expect(afterFirst).to.be.at.least(2);
      await recolorImageWebGL(red, [
        { source: ["#FF0000"], target: ["#00FF00"] },
      ]);
      expect(createSpy.callCount).to.equal(afterFirst);
    } finally {
      createSpy.restore();
    }
  });

  it("throws when WebGL cannot allocate a texture", async () => {
    const stub = sinon
      .stub(WebGLRenderingContext.prototype, "createTexture")
      .returns(null);
    try {
      let thrown = null;
      try {
        await recolorImageWebGL(solidCanvas(255, 0, 0), [
          { source: ["#FF0000"], target: ["#0000FF"] },
        ]);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).to.not.equal(null);
      expect(thrown.message).to.match(/Failed to allocate WebGL texture/);
    } finally {
      stub.restore();
    }
  });

  it("same-size successive recolors are not blank", async () => {
    const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    const second = await recolorImageWebGL(red, [
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

  it("held snapshot stays drawable after a later same-size recolor", async () => {
    const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#00FF00"] },
    ]);

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
    const oliveDest = drawSnapshotToDest(olive);
    const bronze = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "bronze" },
      path,
    );
    const bronzeDest = drawSnapshotToDest(bronze);
    assertOpaqueRemap(oliveDest, { r: 0, g: 255, b: 0 });
    assertOpaqueRemap(bronzeDest, { r: 0, g: 0, b: 255 });

    const oliveHit = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      path,
    );
    assertOpaqueRemap(drawSnapshotToDest(oliveHit), { r: 0, g: 255, b: 0 });
  });

  it("getImageToDraw defers the WebGL snapshot until the next cacheable miss", async function () {
    if (typeof createImageBitmap !== "function") {
      this.skip();
    }
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const bitmapSpy = sinon.spy(globalThis, "createImageBitmap");
    try {
      const olive = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      expect(olive).to.be.instanceOf(HTMLCanvasElement);
      expect(bitmapSpy.called).to.equal(false);
      assertOpaqueRemap(drawSnapshotToDest(olive), { r: 0, g: 255, b: 0 });

      const bronze = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "bronze" },
        "spritesheets/body/bodies/male/walk.png",
      );
      expect(bitmapSpy.called).to.equal(true);
      assertOpaqueRemap(drawSnapshotToDest(bronze), { r: 0, g: 0, b: 255 });

      const oliveHit = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      expect(oliveHit).to.be.instanceOf(ImageBitmap);
      assertOpaqueRemap(drawSnapshotToDest(oliveHit), { r: 0, g: 255, b: 0 });
    } finally {
      bitmapSpy.restore();
      clearRecolorCache();
    }
  });

  it("getImageToDraw returns the source when every mapping is skipped", async () => {
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const out = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "source" },
      "spritesheets/body/bodies/male/walk.png",
    );
    expect(out).to.equal(img);
  });

  it("getImageToDraw falls back to CPU when a live WebGL draw throws", async () => {
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    const drawStub = sinon
      .stub(WebGLRenderingContext.prototype, "drawArrays")
      .throws(new Error("drawArrays forced failure"));
    const warnSpy = sinon.spy(console, "warn");
    try {
      const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
      const out = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      expect(getRecolorStats().fallback).to.be.at.least(1);
      expect(warnSpy.called).to.equal(true);
      assertOpaqueRemap(drawSnapshotToDest(out), { r: 0, g: 255, b: 0 });
    } finally {
      drawStub.restore();
      warnSpy.restore();
      clearRecolorCache();
    }
  });

  it("closes a copy-on-write snapshot after clearRecolorCache", async function () {
    if (typeof ImageBitmap === "undefined") {
      this.skip();
    }
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    const closeSpy = sinon.spy(ImageBitmap.prototype, "close");
    try {
      const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      clearRecolorCache();
      await recolorImageWebGL(img, [
        { source: ["#FF0000"], target: ["#0000FF"] },
      ]);
      expect(closeSpy.called).to.equal(true);
    } finally {
      closeSpy.restore();
      clearRecolorCache();
    }
  });

  it("closes a live snapshot when no cache key is pending", async function () {
    if (typeof ImageBitmap === "undefined") {
      this.skip();
    }
    const catalog = createCatalog();
    seedCatalog(catalog, itemMetadata, { paletteMetadata });
    clearRecolorCache();
    setWebGLLiveSnapshotHandler(null);
    const closeSpy = sinon.spy(ImageBitmap.prototype, "close");
    try {
      const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      await recolorImageWebGL(img, [
        { source: ["#FF0000"], target: ["#0000FF"] },
      ]);
      expect(closeSpy.called).to.equal(true);
    } finally {
      closeSpy.restore();
      bindWebGLLiveSnapshotHandler();
      clearRecolorCache();
    }
  });

  it("snapshots with createImageBitmap when available", async function () {
    if (typeof createImageBitmap !== "function") {
      this.skip();
    }
    const out = await recolorImageWebGL(solidCanvas(255, 0, 0), [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    expect(out).to.be.instanceOf(ImageBitmap);
    assertOpaqueRemap(drawSnapshotToDest(out), { r: 0, g: 0, b: 255 });
  });

  it("copies to a 2D canvas when createImageBitmap is missing", async () => {
    const original = globalThis.createImageBitmap;
    globalThis.createImageBitmap = undefined;
    try {
      resetSharedWebGLForTests();
      const out = await recolorImageWebGL(solidCanvas(255, 0, 0), [
        { source: ["#FF0000"], target: ["#0000FF"] },
      ]);
      expect(out).to.be.instanceOf(HTMLCanvasElement);
      assertOpaqueRemap(drawSnapshotToDest(out), { r: 0, g: 0, b: 255 });
    } finally {
      globalThis.createImageBitmap = original;
    }
  });

  it("copies to a 2D canvas when createImageBitmap throws", async function () {
    if (typeof createImageBitmap !== "function") {
      this.skip();
    }
    const original = globalThis.createImageBitmap;
    globalThis.createImageBitmap = () => {
      throw new Error("createImageBitmap forced failure");
    };
    try {
      resetSharedWebGLForTests();
      const out = await recolorImageWebGL(solidCanvas(255, 0, 0), [
        { source: ["#FF0000"], target: ["#0000FF"] },
      ]);
      expect(out).to.be.instanceOf(HTMLCanvasElement);
      assertOpaqueRemap(drawSnapshotToDest(out), { r: 0, g: 0, b: 255 });
    } finally {
      globalThis.createImageBitmap = original;
    }
  });
});

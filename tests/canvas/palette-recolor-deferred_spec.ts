/**
 * Deferred WebGL snapshot / idle LRU fill for palette recolor.
 */
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  getImageToDraw,
  getRecolorCacheStats,
  clearRecolorCache,
  setPaletteRecolorMode,
  beginDeferredRecolorSnapshots,
  endDeferredRecolorSnapshots,
  flushDeferredRecolorCache,
} from "../../sources/canvas/palette-recolor.ts";
import { isWebGLAvailable } from "../../sources/canvas/webgl-palette-recolor.ts";
import {
  solidCanvas,
  drawSnapshotToDest,
  assertOpaqueRemap,
} from "./palette-recolor-test-helpers.ts";
import {
  RECOLOR_ITEM_ID,
  seedRecolorCatalog,
} from "./palette-recolor-fixtures.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import { SHEET_WIDTH } from "../../sources/canvas/renderer.ts";

type SkipThis = { skip: () => void };

function skipIfNoWebGL(test: SkipThis, alsoNeedBitmap = false): void {
  if (!isWebGLAvailable()) {
    test.skip();
  }
  if (alsoNeedBitmap && typeof createImageBitmap !== "function") {
    test.skip();
  }
}

describe("canvas/palette-recolor deferred LRU fill", () => {
  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedRecolorCatalog(catalogWriter);
    clearRecolorCache();
  });

  afterEach(() => {
    clearRecolorCache();
  });

  it("flushDeferredRecolorCache is a no-op when nothing is pending", async () => {
    const first = flushDeferredRecolorCache();
    const second = flushDeferredRecolorCache();
    expect(first).to.equal(second);
    await first;
    expect(getRecolorCacheStats()).to.deep.equal({
      skipped: 0,
      cacheHits: 0,
      misses: 0,
    });
  });

  it("skips WebGL snapshots during the defer window and fills the LRU on flush", async function (this: SkipThis) {
    skipIfNoWebGL(this, true);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const bitmapSpy = sinon.spy(globalThis, "createImageBitmap");
    try {
      beginDeferredRecolorSnapshots();
      const olive = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      const oliveDest = drawSnapshotToDest(olive);
      const bronze = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "bronze" },
        "spritesheets/body/bodies/male/walk.png",
      );
      const bronzeDest = drawSnapshotToDest(bronze);
      expect(bitmapSpy.called).to.equal(false);
      assertOpaqueRemap(oliveDest, { r: 0, g: 255, b: 0 });
      assertOpaqueRemap(bronzeDest, { r: 0, g: 0, b: 255 });

      await flushDeferredRecolorCache();
      expect(bitmapSpy.called).to.equal(true);

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
    }
  });

  it("returns the source during defer when every mapping is skipped", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    beginDeferredRecolorSnapshots();
    const out = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "source" },
      "spritesheets/body/bodies/male/walk.png",
    );
    expect(out).to.equal(img);
    await flushDeferredRecolorCache();
  });

  it("forgets a deferred in-flight miss after clearRecolorCache", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    beginDeferredRecolorSnapshots();
    const pending = getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/body/bodies/male/walk.png",
    );
    clearRecolorCache();
    const result = await pending;
    expect(result).to.be.instanceOf(HTMLCanvasElement);
    assertOpaqueRemap(drawSnapshotToDest(result), { r: 0, g: 255, b: 0 });
  });

  it("shares one in-flight miss for the same key while snapshots are deferred", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const path = "spritesheets/body/bodies/male/walk.png";
    beginDeferredRecolorSnapshots();
    const [a, b] = await Promise.all([
      getImageToDraw(catalog, img, RECOLOR_ITEM_ID, { body: "olive" }, path),
      getImageToDraw(catalog, img, RECOLOR_ITEM_ID, { body: "olive" }, path),
    ]);
    expect(a).to.equal(b);
    expect(getRecolorCacheStats()).to.deep.equal({
      skipped: 0,
      cacheHits: 1,
      misses: 1,
    });
    await flushDeferredRecolorCache();
  });

  it("reuses an in-flight flush instead of starting a second fill", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    beginDeferredRecolorSnapshots();
    await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/body/bodies/male/walk.png",
    );
    const first = flushDeferredRecolorCache();
    const second = flushDeferredRecolorCache();
    expect(first).to.equal(second);
    await first;
  });

  it("snapshots a leftover live canvas when there are no deferred jobs", async function (this: SkipThis) {
    skipIfNoWebGL(this, true);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const path = "spritesheets/body/bodies/male/walk.png";
    await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      path,
    );
    await flushDeferredRecolorCache();
    const hit = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      path,
    );
    expect(hit).to.be.instanceOf(ImageBitmap);
    assertOpaqueRemap(drawSnapshotToDest(hit), { r: 0, g: 255, b: 0 });
  });

  it("fills the LRU from requestIdleCallback after endDeferredRecolorSnapshots", async function (this: SkipThis) {
    skipIfNoWebGL(this, true);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const path = "spritesheets/body/bodies/male/walk.png";
    let idleCb: IdleRequestCallback | undefined;
    const originalRic = globalThis.requestIdleCallback;
    const originalCancel = globalThis.cancelIdleCallback;
    globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
      idleCb = cb;
      return 1;
    }) as typeof requestIdleCallback;
    globalThis.cancelIdleCallback = (() => {}) as typeof cancelIdleCallback;
    try {
      beginDeferredRecolorSnapshots();
      const olive = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      drawSnapshotToDest(olive);
      endDeferredRecolorSnapshots();
      expect(idleCb).to.be.a("function");
      idleCb!({} as IdleDeadline);
      await flushDeferredRecolorCache();
      const hit = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      expect(hit).to.be.instanceOf(ImageBitmap);
    } finally {
      globalThis.requestIdleCallback = originalRic;
      globalThis.cancelIdleCallback = originalCancel;
    }
  });

  it("fills the LRU via setTimeout when requestIdleCallback is missing", async function (this: SkipThis) {
    skipIfNoWebGL(this, true);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const path = "spritesheets/body/bodies/male/walk.png";
    const originalRic = globalThis.requestIdleCallback;
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    try {
      beginDeferredRecolorSnapshots();
      const olive = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      drawSnapshotToDest(olive);
      endDeferredRecolorSnapshots();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await flushDeferredRecolorCache();
      const hit = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      expect(hit).to.be.instanceOf(ImageBitmap);
    } finally {
      globalThis.requestIdleCallback = originalRic;
    }
  });

  it("cancels a pending idle fill on clearRecolorCache", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const originalRic = globalThis.requestIdleCallback;
    const originalCancel = globalThis.cancelIdleCallback;
    let cancelled = false;
    globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
      return originalRic ? originalRic(cb) : setTimeout(cb, 0);
    }) as typeof requestIdleCallback;
    globalThis.cancelIdleCallback = ((id: number) => {
      cancelled = true;
      originalCancel?.(id);
    }) as typeof cancelIdleCallback;
    try {
      beginDeferredRecolorSnapshots();
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      endDeferredRecolorSnapshots();
      clearRecolorCache();
      expect(cancelled).to.equal(true);
    } finally {
      globalThis.requestIdleCallback = originalRic;
      globalThis.cancelIdleCallback = originalCancel;
    }
  });

  it("beginDeferredRecolorSnapshots cancels a pending timeout fill", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const originalRic = globalThis.requestIdleCallback;
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    try {
      beginDeferredRecolorSnapshots();
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      endDeferredRecolorSnapshots();
      beginDeferredRecolorSnapshots();
      await flushDeferredRecolorCache();
    } finally {
      globalThis.requestIdleCallback = originalRic;
    }
  });

  it("cancels a pending setTimeout fill on clearRecolorCache", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const originalRic = globalThis.requestIdleCallback;
    Reflect.deleteProperty(globalThis, "requestIdleCallback");
    try {
      beginDeferredRecolorSnapshots();
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      endDeferredRecolorSnapshots();
      clearRecolorCache();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getRecolorCacheStats().misses).to.equal(0);
    } finally {
      globalThis.requestIdleCallback = originalRic;
    }
  });

  it("ignores a stale idle callback after the generation changes", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const originalRic = globalThis.requestIdleCallback;
    const originalCancel = globalThis.cancelIdleCallback;
    let idleCb: IdleRequestCallback | undefined;
    globalThis.requestIdleCallback = ((cb: IdleRequestCallback) => {
      idleCb = cb;
      return 1;
    }) as typeof requestIdleCallback;
    Reflect.deleteProperty(globalThis, "cancelIdleCallback");
    try {
      beginDeferredRecolorSnapshots();
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/body/bodies/male/walk.png",
      );
      endDeferredRecolorSnapshots();
      clearRecolorCache();
      expect(idleCb).to.be.a("function");
      idleCb!({} as IdleDeadline);
      await flushDeferredRecolorCache();
      expect(getRecolorCacheStats().misses).to.equal(0);
    } finally {
      globalThis.requestIdleCallback = originalRic;
      globalThis.cancelIdleCallback = originalCancel;
    }
  });

  it("aborts an in-flight fill when the generation changes", async function (this: SkipThis) {
    skipIfNoWebGL(this);
    setPaletteRecolorMode("webgl");
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    beginDeferredRecolorSnapshots();
    await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/body/bodies/male/walk.png",
    );
    drawSnapshotToDest(
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "bronze" },
        "spritesheets/body/bodies/male/walk.png",
      ),
    );
    const filling = flushDeferredRecolorCache();
    clearRecolorCache();
    await filling;
    expect(getRecolorCacheStats().misses).to.equal(0);
  });

  it("evicts the oldest LRU snapshot when idle fill exceeds the cap", async function (this: SkipThis) {
    if (!isWebGLAvailable() || typeof ImageBitmap === "undefined") {
      this.skip();
    }
    setPaletteRecolorMode("webgl");
    const closeSpy = sinon.spy(ImageBitmap.prototype, "close");
    try {
      const img = solidCanvas(255, 0, 0);
      for (let i = 0; i < 250; i++) {
        await getImageToDraw(
          catalog,
          img,
          RECOLOR_ITEM_ID,
          { body: "olive" },
          `spritesheets/evict-defer/${i}.png`,
        );
      }
      beginDeferredRecolorSnapshots();
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/evict-defer/250.png",
      );
      await flushDeferredRecolorCache();
      expect(closeSpy.called).to.equal(true);
    } finally {
      closeSpy.restore();
    }
  });
});

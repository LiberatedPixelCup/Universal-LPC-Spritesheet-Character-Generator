/**
 * Tests for the bounded LRU recolor cache inside `getImageToDraw`.
 *
 * Invariants guarded:
 * - Same (spritePath, recolors) returns the same cached reference.
 * - Different recolors / paths stay distinct after the compositor draws
 *   (WebGL may return the live shared canvas until the next miss).
 * - `spritePath = null` bypasses cache (custom uploads, etc.).
 * - `!recolors` short-circuits before cache (raw image returned).
 * - `clearRecolorCache()` empties the cache.
 * - Concurrent callers for the same key share one in-flight Promise.
 */
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach } from "mocha-globals";
import {
  getImageToDraw,
  clearRecolorCache,
  getRecolorCacheStats,
  setPaletteRecolorMode,
  beginDeferredRecolorSnapshots,
  endDeferredRecolorSnapshots,
  flushDeferredRecolorCache,
} from "../../sources/canvas/palette-recolor.ts";
import { isWebGLAvailable } from "../../sources/canvas/webgl-palette-recolor.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import {
  drawSnapshotToDest,
  assertOpaqueRemap,
} from "./palette-recolor-test-helpers.js";

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

function solidColorCanvas(r, g, b, w = 8, h = 8) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, w, h);
  return c;
}

describe("canvas/palette-recolor.ts recolor cache", () => {
  let catalog;
  let catalogWriter;

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(catalogWriter, itemMetadata, { paletteMetadata });
    clearRecolorCache();
  });

  it("returns the same canvas reference on cache hit (same spritePath + recolors)", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const recolors = { body: "olive" };
    const path = "spritesheets/body/bodies/male/walk.png";

    const first = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      path,
    );
    const second = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      path,
    );

    expect(first).to.equal(second);
    expect(getRecolorCacheStats()).to.deep.equal({
      skipped: 0,
      cacheHits: 1,
      misses: 1,
    });
  });

  it("produces different canvases when recolors differ", async () => {
    const img = solidColorCanvas(255, 0, 0);
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
    expect(oliveHit).to.not.equal(bronze);
    assertOpaqueRemap(drawSnapshotToDest(oliveHit), { r: 0, g: 255, b: 0 });
  });

  it("produces different canvases when spritePath differs", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const recolors = { body: "olive" };

    const a = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      "spritesheets/body/bodies/male/walk.png",
    );
    const aDest = drawSnapshotToDest(a);
    const b = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      "spritesheets/body/bodies/male/slash.png",
    );
    const bDest = drawSnapshotToDest(b);
    assertOpaqueRemap(aDest, { r: 0, g: 255, b: 0 });
    assertOpaqueRemap(bDest, { r: 0, g: 255, b: 0 });

    const aHit = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      "spritesheets/body/bodies/male/walk.png",
    );
    expect(aHit).to.not.equal(b);
  });

  it("bypasses cache when spritePath is null (uncacheable inputs)", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const recolors = { body: "olive" };

    const first = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      null,
    );
    const second = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      null,
    );

    expect(first).to.not.equal(second);
  });

  it("returns the input image unchanged when recolors is null (no cache entry)", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const path = "spritesheets/body/bodies/male/walk.png";

    const result = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      null,
      path,
    );

    expect(result).to.equal(img);
    expect(getRecolorCacheStats().skipped).to.equal(1);
  });

  it("increments recolorSkipped when the item has no palette config", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const result = await getImageToDraw(
      catalog,
      img,
      "missing-item",
      { body: "olive" },
      "spritesheets/body/bodies/male/walk.png",
    );
    expect(result).to.equal(img);
    expect(getRecolorCacheStats().skipped).to.equal(1);
  });

  it("clearRecolorCache() drops all entries so the next call recomputes", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const recolors = { body: "olive" };
    const path = "spritesheets/body/bodies/male/walk.png";

    const first = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      path,
    );
    assertOpaqueRemap(drawSnapshotToDest(first), { r: 0, g: 255, b: 0 });
    clearRecolorCache();
    expect(getRecolorCacheStats().misses).to.equal(0);
    const second = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      path,
    );

    expect(getRecolorCacheStats().misses).to.equal(1);
    assertOpaqueRemap(drawSnapshotToDest(second), { r: 0, g: 255, b: 0 });
  });

  it("concurrent callers for the same key resolve to the same canvas", async () => {
    const img = solidColorCanvas(255, 0, 0);
    const recolors = { body: "olive" };
    const path = "spritesheets/body/bodies/male/walk.png";

    const [a, b, c] = await Promise.all([
      getImageToDraw(catalog, img, RECOLOR_ITEM_ID, recolors, path),
      getImageToDraw(catalog, img, RECOLOR_ITEM_ID, recolors, path),
      getImageToDraw(catalog, img, RECOLOR_ITEM_ID, recolors, path),
    ]);

    expect(a).to.equal(b);
    expect(b).to.equal(c);
  });

  it("closes ImageBitmaps evicted from the LRU cache", async function () {
    if (!isWebGLAvailable() || typeof ImageBitmap === "undefined") {
      this.skip();
    }
    setPaletteRecolorMode("webgl");
    const closeSpy = sinon.spy(ImageBitmap.prototype, "close");
    try {
      const img = solidColorCanvas(255, 0, 0);
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/evict/0.png",
      );
      for (let i = 1; i <= 250; i++) {
        await getImageToDraw(
          catalog,
          img,
          RECOLOR_ITEM_ID,
          { body: "olive" },
          `spritesheets/evict/${i}.png`,
        );
      }
      expect(closeSpy.called).to.equal(true);
    } finally {
      closeSpy.restore();
      clearRecolorCache();
    }
  });

  it("still caches CPU results while WebGL snapshots are deferred", async () => {
    setPaletteRecolorMode("cpu");
    const img = solidColorCanvas(255, 0, 0);
    const path = "spritesheets/body/bodies/male/walk.png";
    beginDeferredRecolorSnapshots();
    try {
      const first = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      const second = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        path,
      );
      expect(first).to.equal(second);
      expect(getRecolorCacheStats()).to.deep.equal({
        skipped: 0,
        cacheHits: 1,
        misses: 1,
      });
    } finally {
      endDeferredRecolorSnapshots();
      await flushDeferredRecolorCache();
      if (isWebGLAvailable()) {
        setPaletteRecolorMode("webgl");
      }
    }
  });

  it("does not close an in-flight ImageBitmap on clearRecolorCache", async function () {
    if (!isWebGLAvailable() || typeof ImageBitmap === "undefined") {
      this.skip();
    }
    setPaletteRecolorMode("webgl");
    const img = solidColorCanvas(255, 0, 0);
    const pending = getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/inflight/walk.png",
    );
    clearRecolorCache();
    const result = await pending;
    expect(result).to.be.instanceOf(HTMLCanvasElement);
    assertOpaqueRemap(drawSnapshotToDest(result), { r: 0, g: 255, b: 0 });
  });
});

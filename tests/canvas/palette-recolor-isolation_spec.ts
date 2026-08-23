/**
 * Compositor-visible isolation for WebGL recolor.
 *
 * These cases do not assume one shared WebGL canvas. They only require that
 * `drawImage` of each result (the renderer contract: draw before the next
 * cacheable miss) keeps the intended pixels after later recolors.
 */
import { expect } from "chai";
import { describe, it, before, beforeEach, afterEach } from "mocha-globals";
import {
  getImageToDraw,
  clearRecolorCache,
  setPaletteRecolorMode,
  beginDeferredRecolorSnapshots,
  endDeferredRecolorSnapshots,
  flushDeferredRecolorCache,
} from "../../sources/canvas/palette-recolor.ts";
import {
  recolorImageWebGL,
  isWebGLAvailable,
  resetSharedWebGLForTests,
} from "../../sources/canvas/webgl-palette-recolor.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import { SHEET_WIDTH } from "../../sources/canvas/renderer.ts";
import {
  solidCanvas,
  drawSnapshotToDest,
  assertOpaqueRemap,
} from "./palette-recolor-test-helpers.ts";
import {
  RECOLOR_ITEM_ID,
  seedRecolorCatalog,
} from "./palette-recolor-fixtures.ts";

const OLIVE = { r: 0, g: 255, b: 0 };
const BRONZE = { r: 0, g: 0, b: 255 };
const TEAL = { r: 0, g: 255, b: 255 };

function drawLayer(
  dest: HTMLCanvasElement,
  source: CanvasImageSource,
  y: number,
): void {
  dest.getContext("2d")!.drawImage(source, 0, y);
}

function stackedDest(height: number): HTMLCanvasElement {
  const dest = document.createElement("canvas");
  dest.width = SHEET_WIDTH;
  dest.height = height;
  return dest;
}

describe("canvas/palette-recolor compositor isolation", function () {
  let catalog: CatalogReader;
  let catalogWriter: CatalogWriter;

  before(function (this: { skip: () => void }) {
    if (!isWebGLAvailable()) {
      this.skip();
    }
  });

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedRecolorCatalog(catalogWriter);
    clearRecolorCache();
    resetSharedWebGLForTests();
    setPaletteRecolorMode("webgl");
  });

  afterEach(() => {
    clearRecolorCache();
    resetSharedWebGLForTests();
  });

  async function drawRecolor(
    recolors: Record<string, string>,
    path: string,
    img: HTMLCanvasElement,
  ): Promise<{ source: CanvasImageSource; dest: HTMLCanvasElement }> {
    const source = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      recolors,
      path,
    );
    return { source, dest: drawSnapshotToDest(source) };
  }

  it("keeps each immediately-drawn dest after two later cacheable misses", async () => {
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const olive = await drawRecolor(
      { body: "olive" },
      "spritesheets/isolation/walk.png",
      img,
    );
    const bronze = await drawRecolor(
      { body: "bronze" },
      "spritesheets/isolation/walk.png",
      img,
    );
    const teal = await drawRecolor(
      { body: "teal" },
      "spritesheets/isolation/walk.png",
      img,
    );

    assertOpaqueRemap(olive.dest, OLIVE);
    assertOpaqueRemap(bronze.dest, BRONZE);
    assertOpaqueRemap(teal.dest, TEAL);
  });

  it("stacks two live recolors on one dest; a later miss does not clobber those strips", async () => {
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const dest = stackedDest(128);

    const olive = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/isolation/stack-a.png",
    );
    drawLayer(dest, olive, 0);

    const bronze = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "bronze" },
      "spritesheets/isolation/stack-b.png",
    );
    drawLayer(dest, bronze, 64);

    await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "teal" },
      "spritesheets/isolation/stack-c.png",
    );

    assertOpaqueRemap(dest, OLIVE, 0, 0);
    assertOpaqueRemap(dest, BRONZE, 0, 64);
  });

  it("keeps dests when the next miss is a different size", async () => {
    const small = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const large = solidCanvas(255, 0, 0, SHEET_WIDTH, 128);
    const olive = await drawRecolor(
      { body: "olive" },
      "spritesheets/isolation/small.png",
      small,
    );
    const bronze = await drawRecolor(
      { body: "bronze" },
      "spritesheets/isolation/large.png",
      large,
    );

    expect(olive.dest.height).to.equal(64);
    expect(bronze.dest.height).to.equal(128);
    assertOpaqueRemap(olive.dest, OLIVE);
    assertOpaqueRemap(bronze.dest, BRONZE);
  });

  it("draws each resolved miss before the next starts when two keys race", async () => {
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const [olive, bronze] = await Promise.all([
      getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/isolation/race-olive.png",
      ).then((source) => drawSnapshotToDest(source)),
      getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "bronze" },
        "spritesheets/isolation/race-bronze.png",
      ).then((source) => drawSnapshotToDest(source)),
    ]);
    assertOpaqueRemap(olive, OLIVE);
    assertOpaqueRemap(bronze, BRONZE);
  });

  it("keeps stacked dests across a deferred window and the idle fill", async () => {
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const dest = stackedDest(128);
    beginDeferredRecolorSnapshots();
    try {
      const olive = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "olive" },
        "spritesheets/isolation/defer-a.png",
      );
      drawLayer(dest, olive, 0);
      const bronze = await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "bronze" },
        "spritesheets/isolation/defer-b.png",
      );
      drawLayer(dest, bronze, 64);
      await getImageToDraw(
        catalog,
        img,
        RECOLOR_ITEM_ID,
        { body: "teal" },
        "spritesheets/isolation/defer-c.png",
      );
      assertOpaqueRemap(dest, OLIVE, 0, 0);
      assertOpaqueRemap(dest, BRONZE, 0, 64);
    } finally {
      endDeferredRecolorSnapshots();
      await flushDeferredRecolorCache();
    }

    assertOpaqueRemap(dest, OLIVE, 0, 0);
    assertOpaqueRemap(dest, BRONZE, 0, 64);
    const oliveHit = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      "spritesheets/isolation/defer-a.png",
    );
    assertOpaqueRemap(drawSnapshotToDest(oliveHit), OLIVE);
  });

  it("keeps an uncacheable dest after the next uncacheable recolor", async () => {
    const img = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "olive" },
      null,
    );
    const firstDest = drawSnapshotToDest(first);
    const second = await getImageToDraw(
      catalog,
      img,
      RECOLOR_ITEM_ID,
      { body: "bronze" },
      null,
    );
    const secondDest = drawSnapshotToDest(second);
    assertOpaqueRemap(firstDest, OLIVE);
    assertOpaqueRemap(secondDest, BRONZE);
  });

  it("keeps an immediate-snapshot result drawable after a later recolor", async () => {
    const red = solidCanvas(255, 0, 0, SHEET_WIDTH, 64);
    const first = await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#00FF00"] },
    ]);
    const dest = stackedDest(128);
    drawLayer(dest, first, 0);
    const second = await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#0000FF"] },
    ]);
    drawLayer(dest, second, 64);
    await recolorImageWebGL(red, [
      { source: ["#FF0000"], target: ["#00FFFF"] },
    ]);
    assertOpaqueRemap(dest, OLIVE, 0, 0);
    assertOpaqueRemap(dest, BRONZE, 0, 64);
    assertOpaqueRemap(drawSnapshotToDest(first), OLIVE);
  });
});

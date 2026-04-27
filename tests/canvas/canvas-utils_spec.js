import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  canvasToBlob,
  drawTransparencyBackground,
  get2DContext,
  getZPos,
  hasContentInRegion,
} from "../../sources/canvas/canvas-utils.ts";
import { resetCatalogForTests } from "../../sources/state/catalog.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe("canvas/canvas-utils.ts", () => {
  describe("canvasToBlob", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("resolves with a PNG Blob for a canvas with content", async () => {
      const canvas = createCanvas(4, 4);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, 2, 2);

      const blob = await canvasToBlob(canvas);

      expect(blob).to.be.instanceOf(Blob);
      expect(blob.type).to.equal("image/png");
      expect(blob.size).to.be.greaterThan(0);
    });

    it("rejects when toBlob invokes the callback with null", async () => {
      const canvas = createCanvas(4, 4);
      sinon.stub(canvas, "toBlob").callsFake((callback) => {
        callback(null);
      });

      try {
        await canvasToBlob(canvas);
        expect.fail("expected rejection");
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal("Failed to create blob from canvas");
      }
    });

    it("rejects when toBlob throws synchronously", async () => {
      const canvas = createCanvas(4, 4);
      sinon.stub(canvas, "toBlob").throws(new Error("toBlob failed"));

      try {
        await canvasToBlob(canvas);
        expect.fail("expected rejection");
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal(
          "Canvas to Blob conversion failed: toBlob failed",
        );
      }
    });
  });

  describe("get2DContext", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("returns a 2d context with image smoothing disabled", () => {
      const canvas = createCanvas(8, 8);
      const ctx = get2DContext(canvas);
      expect(ctx).to.not.equal(null);
      expect(ctx.imageSmoothingEnabled).to.equal(false);
    });

    it("passes willReadFrequently false to getContext by default", () => {
      const canvas = createCanvas(8, 8);
      const spy = sinon.spy(canvas, "getContext");
      get2DContext(canvas);
      expect(spy.firstCall.args).to.deep.equal([
        "2d",
        { willReadFrequently: false },
      ]);
    });

    it("passes willReadFrequently true when requested", () => {
      const canvas = createCanvas(8, 8);
      const spy = sinon.spy(canvas, "getContext");
      get2DContext(canvas, true);
      expect(spy.firstCall.args).to.deep.equal([
        "2d",
        { willReadFrequently: true },
      ]);
    });

    it("throws when getContext returns null", () => {
      const canvas = createCanvas(4, 4);
      sinon.stub(canvas, "getContext").returns(null);
      expect(() => get2DContext(canvas)).to.throw("Failed to get 2D context");
    });
  });

  describe("getZPos", () => {
    beforeEach(() => {
      resetCatalogForTests();
    });

    afterEach(async () => {
      await restoreAppCatalogAfterTest();
    });

    it("returns 100 when item id is missing from itemMetadata", () => {
      seedBrowserCatalog({});
      expect(getZPos("unknown-id")).to.equal(100);
    });

    it("returns layer zPos for the default layer (layer_1)", () => {
      seedBrowserCatalog({
        itemA: {
          layers: {
            layer_1: { zPos: 42 },
          },
        },
      });
      expect(getZPos("itemA")).to.equal(42);
    });

    it("returns zPos for layer_N when layerNum is provided", () => {
      seedBrowserCatalog({
        itemB: {
          layers: {
            layer_1: { zPos: 1 },
            layer_2: { zPos: 77 },
          },
        },
      });
      expect(getZPos("itemB", 2)).to.equal(77);
    });

    it("returns 100 when metadata exists but the layer is missing", () => {
      seedBrowserCatalog({
        itemC: { layers: { layer_1: { zPos: 5 } } },
      });
      expect(getZPos("itemC", 3)).to.equal(100);
    });

    it("returns 100 when the layer has no zPos", () => {
      seedBrowserCatalog({
        itemD: {
          layers: {
            layer_1: {},
          },
        },
      });
      expect(getZPos("itemD")).to.equal(100);
    });

    it("returns 100 when metadata has no layers object", () => {
      seedBrowserCatalog({
        itemE: {},
      });
      expect(getZPos("itemE")).to.equal(100);
    });
  });

  describe("hasContentInRegion", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("returns false when the region is fully transparent", () => {
      const canvas = createCanvas(8, 8);
      const ctx = canvas.getContext("2d");
      expect(hasContentInRegion(ctx, 0, 0, 8, 8)).to.equal(false);
    });

    it("returns true when any channel in the region is non-zero", () => {
      const canvas = createCanvas(8, 8);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 1, 1);
      expect(hasContentInRegion(ctx, 0, 0, 4, 4)).to.equal(true);
    });

    it("returns false when the region does not overlap drawn pixels", () => {
      const canvas = createCanvas(8, 8);
      const ctx = canvas.getContext("2d");
      ctx.fillRect(0, 0, 1, 1);
      expect(hasContentInRegion(ctx, 4, 4, 2, 2)).to.equal(false);
    });

    it("returns false and warns when getImageData throws", () => {
      const prevDebug = window.DEBUG;
      window.DEBUG = true;
      try {
        const canvas = createCanvas(8, 8);
        const ctx = canvas.getContext("2d");
        sinon.stub(ctx, "getImageData").throws(new Error("not readable"));
        const warnSpy = sinon.stub(console, "warn");

        expect(hasContentInRegion(ctx, 0, 0, 8, 8)).to.equal(false);
        expect(warnSpy.calledOnce).to.be.true;
        expect(warnSpy.firstCall.args[0]).to.equal(
          "Error checking region content:",
        );
      } finally {
        window.DEBUG = prevDebug;
      }
    });
  });

  describe("drawTransparencyBackground", () => {
    it("should draw a checkered pattern on the canvas", () => {
      const width = 16;
      const height = 16;
      const squareSize = 8;

      // Create a mock canvas and context
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      // Call the function
      drawTransparencyBackground(context, width, height, squareSize);

      // Get pixel data
      const imageData = context.getImageData(0, 0, width, height).data;

      // Check the colors of the squares
      const lightGray = [204, 204, 204, 255]; // #CCCCCC
      const darkGray = [153, 153, 153, 255]; // #999999

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const pixel = [
            imageData[index],
            imageData[index + 1],
            imageData[index + 2],
            imageData[index + 3],
          ];

          const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
          const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
          const isLight = isEvenRow === isEvenCol;

          if (isLight) {
            expect(pixel).to.deep.equal(lightGray);
          } else {
            expect(pixel).to.deep.equal(darkGray);
          }
        }
      }
    });

    it("should handle non-default square sizes", () => {
      const width = 24;
      const height = 24;
      const squareSize = 12;

      // Create a mock canvas and context
      const canvas = createCanvas(width, height);
      const context = canvas.getContext("2d");

      // Call the function
      drawTransparencyBackground(context, width, height, squareSize);

      // Get pixel data
      const imageData = context.getImageData(0, 0, width, height).data;

      // Check the colors of the squares
      const lightGray = [204, 204, 204, 255]; // #CCCCCC
      const darkGray = [153, 153, 153, 255]; // #999999

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const pixel = [
            imageData[index],
            imageData[index + 1],
            imageData[index + 2],
            imageData[index + 3],
          ];

          const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
          const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
          const isLight = isEvenRow === isEvenCol;

          if (isLight) {
            expect(pixel).to.deep.equal(lightGray);
          } else {
            expect(pixel).to.deep.equal(darkGray);
          }
        }
      }
    });
  });
});

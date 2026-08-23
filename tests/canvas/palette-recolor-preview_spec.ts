/**
 * `loadPalette`, `drawRecolorPreview`, and `setPaletteRecolorMode` edge cases.
 */
import { expect } from "chai";
import sinon, { type SinonSandbox, type SinonSpy } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  loadPalette,
  drawRecolorPreview,
  setPaletteRecolorMode,
  getPaletteRecolorConfig,
  type RecolorMode,
} from "../../sources/canvas/palette-recolor.ts";
import {
  createCatalog,
  type CatalogReader,
} from "../../sources/state/catalog.ts";
import { createState } from "../../sources/state/state.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { walkItemMeta } from "./renderer-test-helpers.ts";
import {
  COMPACT_FRAME_SIZE,
  FRAME_SIZE,
} from "../../sources/state/constants.ts";

describe("canvas/palette-recolor preview / loadPalette / mode", () => {
  let sandbox: SinonSandbox;
  let previousMode: RecolorMode;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    previousMode = getPaletteRecolorConfig().activeMode;
  });

  afterEach(() => {
    sandbox.restore();
    if (previousMode === "webgl") {
      setPaletteRecolorMode("webgl");
    } else {
      setPaletteRecolorMode("cpu");
    }
  });

  describe("loadPalette", () => {
    it("returns ok JSON when fetch succeeds", async () => {
      sandbox.stub(globalThis, "fetch").callsFake((() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ colors: ["#fff"] }),
        })) as (...args: never[]) => unknown);
      const result = await loadPalette("/palettes/test.json");
      expect(result.isOk()).to.equal(true);
      expect(result._unsafeUnwrap()).to.deep.equal({ colors: ["#fff"] });
    });

    it("returns fetch-failed when the response is not ok", async () => {
      sandbox.stub(globalThis, "fetch").callsFake((() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
        })) as (...args: never[]) => unknown);
      const result = await loadPalette("/palettes/missing.json");
      expect(result.isErr()).to.equal(true);
      expect(result._unsafeUnwrapErr()).to.deep.equal({
        kind: "fetch-failed",
        status: 404,
        statusText: "Not Found",
      });
    });

    it("returns parse-failed when the body is not JSON", async () => {
      sandbox.stub(globalThis, "fetch").callsFake((() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new SyntaxError("bad json")),
        })) as (...args: never[]) => unknown);
      const result = await loadPalette("/palettes/broken.json");
      expect(result.isErr()).to.equal(true);
      const error = result._unsafeUnwrapErr();
      expect(error.kind).to.equal("parse-failed");
      if (error.kind !== "parse-failed") {
        throw new Error("expected parse-failed");
      }
      expect(error.cause).to.be.instanceOf(SyntaxError);
    });
  });

  describe("setPaletteRecolorMode", () => {
    it("logs an error for an invalid mode", () => {
      const errorSpy = sandbox.spy(console, "error");
      setPaletteRecolorMode("nope" as RecolorMode);
      expect(errorSpy.calledOnce).to.equal(true);
    });

    it("keeps CPU mode when WebGL is unavailable", function (this: {
      skip: () => void;
    }) {
      if (getPaletteRecolorConfig().useWebGL) {
        this.skip();
      }
      setPaletteRecolorMode("cpu");
      setPaletteRecolorMode("webgl");
      expect(getPaletteRecolorConfig().activeMode).to.equal("cpu");
    });
  });

  describe("drawRecolorPreview", () => {
    function previewCatalog(): CatalogReader {
      const { reader, writer } = createCatalog();
      seedCatalog(writer, {
        walk_item: walkItemMeta(),
        fail_item: walkItemMeta({
          layers: {
            layer_1: {
              zPos: 10,
              male: "does/not/exist/",
            },
          },
        }),
        offset_item: walkItemMeta({
          preview_row: 0,
          preview_column: 1,
          preview_x_offset: 3,
          preview_y_offset: 5,
        }),
      });
      return reader;
    }

    function merged(catalog: CatalogReader, itemId: string) {
      const meta = catalog.getItemMerged(itemId).unwrapOr(null);
      if (!meta) {
        throw new Error(`missing merged item ${itemId}`);
      }
      return meta;
    }

    function drawImageSpy(): SinonSpy {
      return sandbox.spy(CanvasRenderingContext2D.prototype, "drawImage");
    }

    it("returns 0 when the canvas is not connected", async () => {
      const catalog = previewCatalog();
      const state = createState();
      const canvas = document.createElement("canvas");
      const drawn = await drawRecolorPreview(
        catalog,
        state,
        "walk_item",
        merged(catalog, "walk_item"),
        canvas,
        {},
      );
      expect(drawn).to.equal(0);
    });

    it("returns 0 when the render becomes stale after load", async () => {
      const catalog = previewCatalog();
      const state = createState();
      const canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
      let stale = false;
      try {
        const pending = drawRecolorPreview(
          catalog,
          state,
          "walk_item",
          merged(catalog, "walk_item"),
          canvas,
          {},
          () => stale,
        );
        stale = true;
        expect(await pending).to.equal(0);
      } finally {
        canvas.remove();
      }
    });

    it("skips a layer that fails to load and still returns the drawn count", async () => {
      const catalog = previewCatalog();
      const state = createState();
      const canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
      try {
        const drawn = await drawRecolorPreview(
          catalog,
          state,
          "fail_item",
          merged(catalog, "fail_item"),
          canvas,
          {},
        );
        expect(drawn).to.equal(0);
      } finally {
        canvas.remove();
      }
    });

    it("draws a compact dest when compactDisplay is on", async () => {
      const catalog = previewCatalog();
      const state = createState();
      state.compactDisplay = true;
      const canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
      const spy = drawImageSpy();
      try {
        const drawn = await drawRecolorPreview(
          catalog,
          state,
          "walk_item",
          merged(catalog, "walk_item"),
          canvas,
          {},
        );
        expect(drawn).to.be.at.least(1);
        const last = spy.args[spy.args.length - 1];
        expect(last[7]).to.equal(COMPACT_FRAME_SIZE);
        expect(last[8]).to.equal(COMPACT_FRAME_SIZE);
      } finally {
        canvas.remove();
      }
    });

    it("draws a full frame dest and honors preview row/column/offsets", async () => {
      const catalog = previewCatalog();
      const state = createState();
      state.compactDisplay = false;
      const canvas = document.createElement("canvas");
      document.body.appendChild(canvas);
      const spy = drawImageSpy();
      try {
        const drawn = await drawRecolorPreview(
          catalog,
          state,
          "offset_item",
          merged(catalog, "offset_item"),
          canvas,
          {},
        );
        expect(drawn).to.be.at.least(1);
        const last = spy.args[spy.args.length - 1];
        expect(last[1]).to.equal(1 * FRAME_SIZE + 3);
        expect(last[2]).to.equal(0 * FRAME_SIZE + 5);
        expect(last[7]).to.equal(FRAME_SIZE);
        expect(last[8]).to.equal(FRAME_SIZE);
      } finally {
        canvas.remove();
      }
    });
  });
});

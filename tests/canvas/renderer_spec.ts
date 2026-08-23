/**
 * Contract tests for `sources/canvas/renderer.ts`.
 *
 * Asserts planning state (`drawCalls`, `customAreaItems`), canvas geometry, and
 * extract/single-item size contracts — not full-sheet pixel goldens.
 *
 * Real sprite URLs (no global Image stub). Failed loads are fine for drawCall planning;
 * content smoke passes a truthy `recolors` arg so paths resolve to existing
 * `walk.png` sheets under `body/bodies/male/`.
 */
import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  initCanvas,
  isOffscreenCanvasInitialized,
  resetOffscreenCanvasStateForTests,
  getCanvas,
  extractAnimationFromCanvas,
  renderCharacter,
  renderSingleItem,
  renderSingleItemAnimation,
  addedCustomAnimations,
  drawCalls,
  customAreaItems,
  SHEET_WIDTH,
  SHEET_HEIGHT,
  canvas as rendererCanvas,
} from "../../sources/canvas/renderer.ts";
import { resetImageLoadCache } from "../../sources/canvas/load-image.ts";
import { PerformanceProfiler } from "../../sources/performance-profiler.ts";
import {
  createCatalog,
  type CatalogReader,
  type CatalogWriter,
} from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { createState, type State } from "../../sources/state/state.ts";
import {
  ANIMATION_CONFIGS,
  FRAME_SIZE,
} from "../../sources/state/constants.ts";
import { hasContentInRegion } from "../../sources/canvas/canvas-utils.ts";
import {
  ALL_BODY_TYPES,
  walkItemMeta,
  resetRendererModuleState,
} from "./renderer-test-helpers.ts";
import m from "mithril";

function requireOffscreenCanvas(): HTMLCanvasElement {
  if (!rendererCanvas) {
    throw new Error("renderer canvas missing");
  }
  return rendererCanvas;
}

function require2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable");
  }
  return ctx;
}

let state: State;

const WHEELCHAIR_ITEM_META = {
  name: "Wheel item",
  type_name: "misc",
  required: ALL_BODY_TYPES,
  animations: ["walk"],
  recolors: [],
  layers: {
    layer_1: {
      zPos: 10,
      custom_animation: "wheelchair",
      male: "arms/bracers/female/hurt/",
    },
  },
};

async function imageFromFilledCanvas(
  width: number,
  height: number,
  color: string,
): Promise<HTMLImageElement> {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) {
    throw new Error("2d context unavailable");
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const img = new Image();
  img.src = c.toDataURL("image/png");
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image load failed"));
  });
  return img;
}

describe("canvas/renderer.ts", () => {
  describe("initCanvas / getCanvas", () => {
    afterEach(() => {
      resetOffscreenCanvasStateForTests();
    });

    it("reports uninitialized before initCanvas", () => {
      resetOffscreenCanvasStateForTests();
      expect(isOffscreenCanvasInitialized()).to.equal(false);
      const result = getCanvas();
      expect(result.isErr()).to.equal(true);
      expect(result._unsafeUnwrapErr()).to.deep.equal({
        kind: "canvas-not-initialized",
      });
    });

    it("creates an offscreen canvas at sheet dimensions", () => {
      resetOffscreenCanvasStateForTests();
      initCanvas();
      expect(isOffscreenCanvasInitialized()).to.equal(true);
      const result = getCanvas();
      expect(result.isOk()).to.equal(true);
      const c = result._unsafeUnwrap();
      expect(c.width).to.equal(SHEET_WIDTH);
      expect(c.height).to.equal(SHEET_HEIGHT);
    });

    it("resetOffscreenCanvasStateForTests clears the initialized flag", () => {
      initCanvas();
      expect(isOffscreenCanvasInitialized()).to.equal(true);
      resetOffscreenCanvasStateForTests();
      expect(isOffscreenCanvasInitialized()).to.equal(false);
      expect(getCanvas().isErr()).to.equal(true);
    });

    it("renderCharacter throws when the offscreen canvas is not initialized", async () => {
      resetOffscreenCanvasStateForTests();
      const { reader: catalog, writer } = createCatalog();
      seedCatalog(writer, { walk_only: walkItemMeta() });
      const localState = createState();
      const localSandbox = sinon.createSandbox();
      localSandbox.stub(m, "redraw");
      localSandbox.stub(console, "error");
      try {
        let thrown: unknown = null;
        try {
          await renderCharacter(
            catalog,
            localState,
            {
              slot: {
                itemId: "walk_only",
                variant: "olive",
                name: "Walk",
              },
            },
            "male",
          );
        } catch (error) {
          thrown = error;
        }
        expect(thrown).to.be.instanceOf(Error);
        expect((thrown as Error).message).to.equal("Canvas not initialized");
      } finally {
        localSandbox.restore();
      }
    });
  });

  describe("extractAnimationFromCanvas", () => {
    afterEach(() => {
      resetOffscreenCanvasStateForTests();
    });

    it("returns null when the offscreen canvas is missing", () => {
      resetOffscreenCanvasStateForTests();
      expect(extractAnimationFromCanvas("walk")).to.equal(null);
    });

    it("returns null for an unknown animation name", () => {
      initCanvas();
      expect(extractAnimationFromCanvas("not_an_animation")).to.equal(null);
    });

    it("crops walk to the configured size and copies painted pixels", () => {
      initCanvas();
      const walk = ANIMATION_CONFIGS.walk;
      const srcY = walk.row * FRAME_SIZE;
      const expectedHeight = walk.num * FRAME_SIZE;

      const ctx = require2dContext(requireOffscreenCanvas());
      ctx.fillStyle = "#ff00aa";
      ctx.fillRect(0, srcY, 4, 4);

      const extracted = extractAnimationFromCanvas("walk");
      if (!extracted) {
        throw new Error("expected extracted walk animation");
      }
      expect(extracted.width).to.equal(SHEET_WIDTH);
      expect(extracted.height).to.equal(expectedHeight);

      const pixel = require2dContext(extracted).getImageData(0, 0, 1, 1).data;
      expect([pixel[0], pixel[1], pixel[2], pixel[3]]).to.deep.equal([
        255, 0, 170, 255,
      ]);
    });
  });

  describe("renderCharacter drawCalls / layering", function () {
    this.timeout(15_000);

    let sandbox: SinonSandbox | null;
    let catalog: CatalogReader;
    let catalogWriter: CatalogWriter;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      state.customUploadedImage = null;
      state.customImageZPos = 100;
      initCanvas();
      ({ reader: catalog, writer: catalogWriter } = createCatalog());
      sandbox.stub(m, "redraw");
    });

    afterEach(() => {
      resetImageLoadCache();
      resetRendererModuleState();
      state.customUploadedImage = null;
      if (sandbox) {
        sandbox.restore();
        sandbox = null;
      }
    });

    it("skips items whose required list excludes the body type", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "walk_only",
            variant: "olive",
            name: "Walk",
          },
        },
        "female",
      );
      expect(drawCalls).to.have.length(0);
    });

    it("skips selections that have a subId", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      // `subId` is checked for truthiness in the renderer (0 would not skip).
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "walk_only",
            variant: "olive",
            name: "Walk",
            subId: 1,
          },
        },
        "male",
      );
      expect(drawCalls).to.have.length(0);
    });

    it("queues walk and omits alias folders for a walk-only item", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "walk_only",
            variant: "olive",
            name: "Walk",
          },
        },
        "male",
      );

      const anims = drawCalls.map((d) => d.animation);
      expect(anims).to.include("walk");
      expect(anims).to.not.include("combat_idle");
      expect(anims).to.not.include("backslash");
      expect(anims).to.not.include("halfslash");
    });

    it("maps combat metadata to combat_idle drawCalls", async () => {
      seedCatalog(catalogWriter, {
        combat_item: walkItemMeta({ animations: ["combat"] }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "combat_item",
            variant: "olive",
            name: "Combat",
          },
        },
        "male",
      );
      expect(drawCalls.map((d) => d.animation)).to.include("combat_idle");
    });

    it("maps 1h_slash metadata to backslash drawCalls", async () => {
      seedCatalog(catalogWriter, {
        slash_item: walkItemMeta({ animations: ["1h_slash"] }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "slash_item",
            variant: "olive",
            name: "Slash",
          },
        },
        "male",
      );
      expect(drawCalls.map((d) => d.animation)).to.include("backslash");
    });

    it("maps watering-only metadata to thrust drawCalls", async () => {
      seedCatalog(catalogWriter, {
        water_item: walkItemMeta({ animations: ["watering"] }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "water_item",
            variant: "olive",
            name: "Water",
          },
        },
        "male",
      );
      expect(drawCalls.map((d) => d.animation)).to.include("thrust");
    });

    it("warns and skips a layer with no path for the body type", async () => {
      const prevDebug = window.DEBUG;
      window.DEBUG = true;
      const warnSpy = sandbox!.spy(console, "warn");
      try {
        seedCatalog(catalogWriter, {
          no_male_path: walkItemMeta({
            layers: {
              layer_1: {
                zPos: 10,
                female: "body/bodies/female/",
              },
            },
          }),
        });
        await renderCharacter(
          catalog,
          state,
          {
            slot: {
              itemId: "no_male_path",
              variant: "olive",
              name: "No male",
            },
          },
          "male",
        );
        expect(drawCalls).to.have.length(0);
        expect(
          warnSpy.args.some((call) =>
            String(call[0]).includes("has no path for bodyType male"),
          ),
        ).to.equal(true);
      } finally {
        window.DEBUG = prevDebug;
      }
    });

    it("maps 1h_halfslash metadata to halfslash drawCalls", async () => {
      seedCatalog(catalogWriter, {
        half_item: walkItemMeta({ animations: ["1h_halfslash"] }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "half_item",
            variant: "olive",
            name: "Half",
          },
        },
        "male",
      );
      expect(drawCalls.map((d) => d.animation)).to.include("halfslash");
    });

    it("sorts drawCalls by ascending zPos", async () => {
      seedCatalog(catalogWriter, {
        layered: walkItemMeta({
          layers: {
            layer_1: {
              zPos: 50,
              male: "body/bodies/male/",
            },
            layer_2: {
              zPos: 10,
              male: "body/bodies/male/",
            },
          },
        }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "layered",
            variant: "olive",
            name: "Layered",
          },
        },
        "male",
      );

      expect(drawCalls.length).to.be.at.least(2);
      for (let i = 1; i < drawCalls.length; i++) {
        expect(drawCalls[i].zPos).to.be.at.least(drawCalls[i - 1].zPos);
      }
      expect(drawCalls[0].zPos).to.equal(10);
    });

    it("sets needsRecolor for body-body with a non-light variant", async () => {
      seedCatalog(catalogWriter, {
        "body-body": walkItemMeta({
          name: "Body Color",
          type_name: "body",
        }),
      });
      await renderCharacter(
        catalog,
        state,
        {
          body: {
            itemId: "body-body",
            variant: "olive",
            name: "Body Color",
          },
        },
        "male",
      );

      const bodyCalls = drawCalls.filter((d) => d.itemId === "body-body");
      expect(bodyCalls.length).to.be.at.least(1);
      expect(bodyCalls.every((d) => d.needsRecolor === true)).to.equal(true);
    });

    it("keeps walk-band content after a palette change", async () => {
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
      seedCatalog(
        catalogWriter,
        {
          "body-body": walkItemMeta({
            name: "Body Color",
            type_name: "body",
            recolors: [
              {
                label: "Body",
                type_name: null,
                material: "body",
                default: "ulpc",
                base: "ulpc.light",
                variants: ["light", "olive", "bronze"],
              },
            ],
          }),
        },
        { paletteMetadata },
      );

      const walk = ANIMATION_CONFIGS.walk;
      const walkY = walk.row * FRAME_SIZE;
      const walkH = walk.num * FRAME_SIZE;
      const walkBandHasContent = () => {
        return hasContentInRegion(
          require2dContext(requireOffscreenCanvas()),
          0,
          walkY,
          SHEET_WIDTH,
          walkH,
        );
      };

      await renderCharacter(
        catalog,
        state,
        {
          body: {
            itemId: "body-body",
            variant: null,
            recolor: "olive",
            name: "Body Color",
          },
        },
        "male",
      );
      expect(walkBandHasContent()).to.equal(true);

      await renderCharacter(
        catalog,
        state,
        {
          body: {
            itemId: "body-body",
            variant: null,
            recolor: "bronze",
            name: "Body Color",
          },
        },
        "male",
      );
      expect(walkBandHasContent()).to.equal(true);
    });

    it("queues custom-upload drawCalls from state.customUploadedImage", async () => {
      seedCatalog(catalogWriter, {});
      state.customUploadedImage = await imageFromFilledCanvas(8, 8, "#00ff00");
      state.customImageZPos = 42;

      await renderCharacter(catalog, state, {}, "male");

      expect(state.renderCharacter.isRendering).to.equal(false);
      expect(state.isRenderingCharacter).to.equal(false);

      const customCalls = drawCalls.filter((d) => d.itemId === "custom-upload");
      expect(customCalls.length).to.be.at.least(1);
      expect(customCalls.every((d) => d.source.kind === "custom")).to.equal(
        true,
      );
      expect(customCalls.every((d) => d.zPos === 42)).to.equal(true);
    });

    it("records a renderCharacter phase report when window.profiler is enabled", async () => {
      const prevProfiler = window.profiler;
      sandbox!.stub(globalThis, "requestAnimationFrame").returns(1);
      sandbox!.stub(globalThis, "setInterval").returns(999);
      const p = new PerformanceProfiler({
        enabled: true,
        logSlowOperations: false,
      });
      window.profiler = p;
      try {
        seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
        await renderCharacter(
          catalog,
          state,
          {
            slot: {
              itemId: "walk_only",
              variant: "olive",
              name: "Walk",
            },
          },
          "male",
        );
        const calls = p.snapshot().renderCharacter.calls;
        expect(calls).to.have.length(1);
        expect(calls[0].phasesMs).to.include.keys(
          "buildDrawCalls",
          "sizeCanvas",
          "loadImages",
          "recolor",
          "draw",
        );
        expect(calls[0].counters.drawCalls).to.be.at.least(1);
        expect(calls[0].counters.selections).to.equal(1);
      } finally {
        window.profiler = prevProfiler;
      }
    });
  });

  describe("renderCharacter custom animation geometry", function () {
    this.timeout(15_000);

    let sandbox: SinonSandbox | null;
    let catalog: CatalogReader;
    let catalogWriter: CatalogWriter;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      initCanvas();
      ({ reader: catalog, writer: catalogWriter } = createCatalog());
      seedCatalog(catalogWriter, {
        wheel_item: WHEELCHAIR_ITEM_META,
      });
      sandbox.stub(m, "redraw");
    });

    afterEach(() => {
      resetImageLoadCache();
      resetRendererModuleState();
      if (sandbox) {
        sandbox.restore();
        sandbox = null;
      }
    });

    it("grows the canvas and records custom_sprite area items for wheelchair", async () => {
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "wheel_item",
            variant: "brass",
            name: "Wheel",
          },
        },
        "male",
      );

      expect(requireOffscreenCanvas().height).to.be.greaterThan(SHEET_HEIGHT);
      expect(customAreaItems).to.have.property("wheelchair");
      const area = customAreaItems.wheelchair;
      expect(area.some((entry) => entry.type === "custom_sprite")).to.equal(
        true,
      );
    });

    it("records custom animation names on the exported addedCustomAnimations set after renderCharacter", async () => {
      await renderCharacter(
        catalog,
        state,
        {
          slot: {
            itemId: "wheel_item",
            variant: "brass",
            name: "Wheel",
          },
        },
        "male",
      );

      expect(addedCustomAnimations.size).to.be.at.least(1);
      expect(addedCustomAnimations.has("wheelchair")).to.equal(true);
    });
  });

  describe("renderSingleItem / renderSingleItemAnimation", function () {
    this.timeout(15_000);

    let sandbox: SinonSandbox | null;
    let catalog: CatalogReader;
    let catalogWriter: CatalogWriter;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      initCanvas();
      ({ reader: catalog, writer: catalogWriter } = createCatalog());
      sandbox.stub(m, "redraw");
    });

    afterEach(() => {
      resetImageLoadCache();
      resetRendererModuleState();
      if (sandbox) {
        sandbox.restore();
        sandbox = null;
      }
    });

    it("returns null for a missing item", async () => {
      seedCatalog(catalogWriter, {});
      const result = await renderSingleItem(
        catalog,
        "does_not_exist",
        null,
        null,
        "male",
        {},
      );
      expect(result).to.equal(null);
    });

    it("returns null for an unsupported body type", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      const result = await renderSingleItem(
        catalog,
        "walk_only",
        "olive",
        null,
        "child",
        {},
      );
      expect(result).to.equal(null);
    });

    it("returns null for an unknown animation name", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      const result = await renderSingleItemAnimation(
        catalog,
        "walk_only",
        "olive",
        null,
        "male",
        "not_an_animation",
        {},
      );
      expect(result).to.equal(null);
    });

    it("returns a standard sheet-sized canvas for a walk item", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      // Truthy recolors omit the variant segment so paths hit existing walk.png.
      const result = await renderSingleItem(
        catalog,
        "walk_only",
        null,
        { misc: "unused" },
        "male",
        {},
      );
      if (!result) {
        throw new Error("expected a walk item canvas");
      }
      expect(result.width).to.equal(SHEET_WIDTH);
      expect(result.height).to.equal(SHEET_HEIGHT);
    });

    it("returns a single-anim canvas with height num * FRAME_SIZE", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      const walk = ANIMATION_CONFIGS.walk;
      const result = await renderSingleItemAnimation(
        catalog,
        "walk_only",
        null,
        { misc: "unused" },
        "male",
        "walk",
        {},
      );
      if (!result) {
        throw new Error("expected a single-anim canvas");
      }
      expect(result.width).to.equal(SHEET_WIDTH);
      expect(result.height).to.equal(walk.num * FRAME_SIZE);
    });

    it("draws content into the walk band for a successful single-item render", async () => {
      seedCatalog(catalogWriter, { walk_only: walkItemMeta() });
      const result = await renderSingleItem(
        catalog,
        "walk_only",
        null,
        { misc: "unused" },
        "male",
        {},
      );
      if (!result) {
        throw new Error("expected a walk item canvas");
      }
      const ctx = require2dContext(result);
      const walk = ANIMATION_CONFIGS.walk;
      const walkY = walk.row * FRAME_SIZE;
      expect(
        hasContentInRegion(ctx, 0, walkY, SHEET_WIDTH, walk.num * FRAME_SIZE),
      ).to.equal(true);
    });

    it("returns a taller-than-sheet canvas for a custom-animation-only item", async () => {
      seedCatalog(catalogWriter, { wheel_item: WHEELCHAIR_ITEM_META });
      const result = await renderSingleItem(
        catalog,
        "wheel_item",
        "brass",
        null,
        "male",
        {},
      );
      if (!result) {
        throw new Error("expected a custom-animation canvas");
      }
      expect(result.height).to.be.greaterThan(SHEET_HEIGHT);
    });
  });
});

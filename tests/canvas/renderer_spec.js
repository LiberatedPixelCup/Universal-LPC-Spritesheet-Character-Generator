/**
 * Contract tests for `sources/canvas/renderer.ts`.
 *
 * Asserts planning state (`drawCalls`, `customAreaItems`), canvas geometry, and
 * extract/single-item size contracts — not full-sheet pixel goldens.
 *
 * Real sprite URLs (no global Image stub): same rationale as
 * `renderer-issue-364_spec.js`. Failed loads are fine for drawCall planning;
 * content smoke passes a truthy `recolors` arg so paths resolve to existing
 * `walk.png` sheets under `body/bodies/male/`.
 */
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  initCanvas,
  isOffscreenCanvasInitialized,
  resetOffscreenCanvasStateForTests,
  resetRenderCharacterQueueForTests,
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
import { createCatalog } from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { createState } from "../../sources/state/state.ts";
let state;
import {
  ANIMATION_CONFIGS,
  FRAME_SIZE,
} from "../../sources/state/constants.ts";
import { hasContentInRegion } from "../../sources/canvas/canvas-utils.ts";

const ALL_BODY_TYPES = [
  "male",
  "female",
  "teen",
  "child",
  "muscular",
  "pregnant",
];

/** Standard walk item pointing at real body sheets (path ok; load needs recolors). */
function walkItemMeta(overrides = {}) {
  return {
    name: "Walk item",
    type_name: "misc",
    required: ["male"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 10,
        male: "body/bodies/male/",
      },
    },
    ...overrides,
  };
}

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

function resetRendererModuleState() {
  resetRenderCharacterQueueForTests();
  drawCalls.length = 0;
  for (const k of Object.keys(customAreaItems)) {
    delete customAreaItems[k];
  }
  addedCustomAnimations.clear();
  initCanvas();
}

async function imageFromFilledCanvas(width, height, color) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  const img = new Image();
  img.src = c.toDataURL("image/png");
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
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

      const ctx = rendererCanvas.getContext("2d");
      ctx.fillStyle = "#ff00aa";
      ctx.fillRect(0, srcY, 4, 4);

      const extracted = extractAnimationFromCanvas("walk");
      expect(extracted).to.not.equal(null);
      expect(extracted.width).to.equal(SHEET_WIDTH);
      expect(extracted.height).to.equal(expectedHeight);

      const pixel = extracted.getContext("2d").getImageData(0, 0, 1, 1).data;
      expect([pixel[0], pixel[1], pixel[2], pixel[3]]).to.deep.equal([
        255, 0, 170, 255,
      ]);
    });
  });

  describe("renderCharacter drawCalls / layering", function () {
    this.timeout(15_000);

    let sandbox;
    let catalog;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      state.customUploadedImage = null;
      state.customImageZPos = 100;
      initCanvas();
      catalog = createCatalog();
      if (typeof m !== "undefined" && m.redraw) {
        sandbox.stub(m, "redraw");
      }
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      seedCatalog(catalog, {
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
      seedCatalog(catalog, {
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

    it("maps 1h_halfslash metadata to halfslash drawCalls", async () => {
      seedCatalog(catalog, {
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
      seedCatalog(catalog, {
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
      seedCatalog(catalog, {
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

    it("queues custom-upload drawCalls from state.customUploadedImage", async () => {
      seedCatalog(catalog, {});
      state.customUploadedImage = await imageFromFilledCanvas(8, 8, "#00ff00");
      state.customImageZPos = 42;

      await renderCharacter(catalog, state, {}, "male");

      const customCalls = drawCalls.filter((d) => d.itemId === "custom-upload");
      expect(customCalls.length).to.be.at.least(1);
      expect(customCalls.every((d) => d.source.kind === "custom")).to.equal(
        true,
      );
      expect(customCalls.every((d) => d.zPos === 42)).to.equal(true);
    });
  });

  describe("renderCharacter custom animation geometry", function () {
    this.timeout(15_000);

    let sandbox;
    let catalog;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      initCanvas();
      catalog = createCatalog();
      seedCatalog(catalog, {
        wheel_item: WHEELCHAIR_ITEM_META,
      });
      if (typeof m !== "undefined" && m.redraw) {
        sandbox.stub(m, "redraw");
      }
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

      expect(rendererCanvas.height).to.be.greaterThan(SHEET_HEIGHT);
      expect(customAreaItems).to.have.property("wheelchair");
      const area = customAreaItems.wheelchair;
      expect(area.some((entry) => entry.type === "custom_sprite")).to.equal(
        true,
      );
    });
  });

  describe("renderSingleItem / renderSingleItemAnimation", function () {
    this.timeout(15_000);

    let sandbox;
    let catalog;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      state = createState();
      initCanvas();
      catalog = createCatalog();
      if (typeof m !== "undefined" && m.redraw) {
        sandbox.stub(m, "redraw");
      }
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
      seedCatalog(catalog, {});
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      seedCatalog(catalog, { walk_only: walkItemMeta() });
      // Truthy recolors omit the variant segment so paths hit existing walk.png.
      const result = await renderSingleItem(
        catalog,
        "walk_only",
        null,
        { misc: "unused" },
        "male",
        {},
      );
      expect(result).to.not.equal(null);
      expect(result.width).to.equal(SHEET_WIDTH);
      expect(result.height).to.equal(SHEET_HEIGHT);
    });

    it("returns a single-anim canvas with height num * FRAME_SIZE", async () => {
      seedCatalog(catalog, { walk_only: walkItemMeta() });
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
      expect(result).to.not.equal(null);
      expect(result.width).to.equal(SHEET_WIDTH);
      expect(result.height).to.equal(walk.num * FRAME_SIZE);
    });

    it("draws content into the walk band for a successful single-item render", async () => {
      seedCatalog(catalog, { walk_only: walkItemMeta() });
      const result = await renderSingleItem(
        catalog,
        "walk_only",
        null,
        { misc: "unused" },
        "male",
        {},
      );
      expect(result).to.not.equal(null);
      const ctx = result.getContext("2d");
      const walk = ANIMATION_CONFIGS.walk;
      const walkY = walk.row * FRAME_SIZE;
      expect(
        hasContentInRegion(ctx, 0, walkY, SHEET_WIDTH, walk.num * FRAME_SIZE),
      ).to.equal(true);
    });

    it("returns a taller-than-sheet canvas for a custom-animation-only item", async () => {
      seedCatalog(catalog, { wheel_item: WHEELCHAIR_ITEM_META });
      const result = await renderSingleItem(
        catalog,
        "wheel_item",
        "brass",
        null,
        "male",
        {},
      );
      expect(result).to.not.equal(null);
      expect(result.height).to.be.greaterThan(SHEET_HEIGHT);
    });
  });
});

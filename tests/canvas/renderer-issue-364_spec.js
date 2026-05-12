/**
 * LiberatedPixelCup#364 / PR "Fixed Item Split and Animation Split Exports":
 * `renderCharacter` must populate the module export `addedCustomAnimations` so
 * ZIP export can iterate custom animation names (no shadowed local Set).
 *
 * Real sprite URLs (no global Image stub): avoids cache/global issues in the
 * shared `load-image` module. `try`/`finally` plus `resetRendererModuleState()`
 * (layers, itemsToDraw, customAreaItems, addedCustomAnimations, initCanvas) plus
 * `resetImageLoadCache()` and restoring the app catalog keep later specs
 * safe when this file is imported first (e.g. if test order is randomized later).
 */
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  initCanvas,
  renderCharacter,
  resetRenderCharacterQueueForTests,
  addedCustomAnimations,
  layers as rendererLayers,
  itemsToDraw,
  customAreaItems,
} from "../../sources/canvas/renderer.ts";
import { resetImageLoadCache } from "../../sources/canvas/load-image.ts";
import { resetState } from "../../sources/state/hash.ts";
import { resetCatalogForTests } from "../../sources/state/catalog.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";
import { state } from "../../sources/state/state.ts";

const ISSUE_364_METADATA = {
  issue364_wheel_item: {
    name: "Wheel item",
    type_name: "misc",
    required: ["male", "female", "teen", "child", "muscular", "pregnant"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 10,
        custom_animation: "wheelchair",
        male: "arms/bracers/female/hurt/",
      },
    },
  },
};

describe("canvas/renderer.ts issue #364 (addedCustomAnimations export)", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    resetState();
    initCanvas();
    resetCatalogForTests();
    seedBrowserCatalog(ISSUE_364_METADATA);
    state.selections = {
      slot: {
        itemId: "issue364_wheel_item",
        variant: "brass",
        name: "Wheel",
      },
    };
    if (typeof m !== "undefined" && m.redraw) {
      sandbox.stub(m, "redraw");
    }
  });

  function resetRendererModuleState() {
    resetRenderCharacterQueueForTests();
    rendererLayers.length = 0;
    itemsToDraw.length = 0;
    for (const k of Object.keys(customAreaItems)) {
      delete customAreaItems[k];
    }
    addedCustomAnimations.clear();
    initCanvas();
  }

  afterEach(async () => {
    resetImageLoadCache();
    resetRendererModuleState();
    if (sandbox) {
      sandbox.restore();
      sandbox = null;
    }
    await restoreAppCatalogAfterTest();
  });

  it("records custom animation names on the exported addedCustomAnimations set after renderCharacter", async () => {
    await renderCharacter(state.selections, "male");

    expect(
      addedCustomAnimations.size,
      "module export addedCustomAnimations must list custom animations used during render (fixes shadowed local Set)",
    ).to.be.at.least(1);
    expect(addedCustomAnimations.has("wheelchair")).to.be.true;
  });
}, 15_000);

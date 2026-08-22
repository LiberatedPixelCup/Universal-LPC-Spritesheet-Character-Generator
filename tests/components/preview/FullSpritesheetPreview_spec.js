import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { FullSpritesheetPreview } from "../../../sources/components/preview/FullSpritesheetPreview.ts";
import * as canvasRenderer from "../../../sources/canvas/renderer.ts";
import { createState } from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";

describe("FullSpritesheetPreview", function () {
  let host;
  let previousRenderer;
  let catalog;

  beforeEach(function () {
    state = createState();
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    catalog = createCatalog();
    catalog.registerFromLayersModule({ itemLayers: {} });
    window.canvasRenderer = canvasRenderer;
    canvasRenderer.initCanvas();
    state.showTransparencyGrid = true;
    state.applyTransparencyMask = false;
    state.fullSpritesheetCanvasZoomLevel = 1;
    state.isRenderingCharacter = false;
  });

  afterEach(function () {
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    window.canvasRenderer = previousRenderer;
    state.showTransparencyGrid = true;
    state.applyTransparencyMask = false;
    state.fullSpritesheetCanvasZoomLevel = 1;
    state.isRenderingCharacter = false;
    canvasRenderer.resetOffscreenCanvasStateForTests();
  });

  it("renders the spritesheet canvas and default checkbox state", function () {
    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });

    assert.notEqual(host.querySelector("#spritesheet-preview"), null);
    const checkboxes = host.querySelectorAll('input[type="checkbox"]');
    assert.strictEqual(checkboxes.length, 2);
    assert.strictEqual(checkboxes[0].checked, true);
    assert.strictEqual(checkboxes[1].checked, false);
  });

  it("writes transparency grid and mask flags from the checkboxes", function () {
    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });

    const checkboxes = host.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    checkboxes[1].click();
    m.redraw.sync();

    assert.strictEqual(state.showTransparencyGrid, false);
    assert.strictEqual(state.applyTransparencyMask, true);
  });

  it("writes fullSpritesheetCanvasZoomLevel from the zoom slider", function () {
    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });

    const slider = host.querySelector("input[type=range]");
    slider.value = "0.8";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    m.redraw.sync();

    assert.strictEqual(state.fullSpritesheetCanvasZoomLevel, 0.8);
    assert.include(host.textContent, "80%");
  });

  it("shows a busy overlay while the character is rendering", function () {
    state.isRenderingCharacter = true;
    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });

    const busy = host.querySelector(".preview-canvas-busy");
    assert.notEqual(busy, null);
    assert.notEqual(busy.querySelector("span.loading"), null);
  });
});

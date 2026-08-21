import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { AnimationPreview } from "../../../sources/components/preview/AnimationPreview.ts";
import {
  setCurrentCustomAnimations,
  stopPreviewAnimation,
} from "../../../sources/canvas/preview-animation.ts";
import { customAnimations } from "../../../sources/custom-animations.ts";
import * as canvasRenderer from "../../../sources/canvas/renderer.ts";
import { createState } from "../../../sources/state/state.ts";
let state;
import { ANIMATION_CONFIGS } from "../../../sources/state/constants.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";

describe("AnimationPreview", function () {
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
    window.__DISABLE_PREVIEW_ANIMATION__ = true;
    canvasRenderer.initCanvas();
    state.selectedAnimation = "walk";
    state.previewCanvasZoomLevel = 1;
    state.isRenderingCharacter = false;
    setCurrentCustomAnimations({});
  });

  afterEach(function () {
    stopPreviewAnimation();
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    window.canvasRenderer = previousRenderer;
    window.__DISABLE_PREVIEW_ANIMATION__ = false;
    setCurrentCustomAnimations({});
    state.selectedAnimation = "walk";
    state.previewCanvasZoomLevel = 1;
    state.isRenderingCharacter = false;
    canvasRenderer.resetOffscreenCanvasStateForTests();
  });

  it("renders the walk select, zoom slider, and preview canvas", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const select = host.querySelector("select");
    assert.notEqual(select, null);
    assert.strictEqual(select.value, "walk");
    assert.notEqual(host.querySelector("input[type=range]"), null);
    assert.notEqual(host.querySelector("#previewAnimations"), null);
    assert.include(host.textContent, ANIMATION_CONFIGS.walk.cycle.join("-"));
  });

  it("updates selectedAnimation and the frame-cycle label when the select changes", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const select = host.querySelector("select");
    select.value = "slash";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    m.redraw.sync();

    assert.strictEqual(state.selectedAnimation, "slash");
    assert.include(host.textContent, ANIMATION_CONFIGS.slash.cycle.join("-"));
  });

  it("adds a custom animation option and selects it", function () {
    setCurrentCustomAnimations({ wheelchair: customAnimations.wheelchair });
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const option = host.querySelector('option[value="wheelchair"]');
    assert.notEqual(option, null);

    const select = host.querySelector("select");
    select.value = "wheelchair";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    m.redraw.sync();

    assert.strictEqual(state.selectedAnimation, "wheelchair");
    assert.include(host.textContent, "2-2");
  });

  it("writes previewCanvasZoomLevel from the zoom slider", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const slider = host.querySelector("input[type=range]");
    slider.value = "1.5";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    m.redraw.sync();

    assert.strictEqual(state.previewCanvasZoomLevel, 1.5);
    assert.include(host.textContent, "150%");
  });

  it("shows a busy overlay while the character is rendering", function () {
    state.isRenderingCharacter = true;
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const busy = host.querySelector(".preview-canvas-busy");
    assert.notEqual(busy, null);
    assert.notEqual(busy.querySelector("span.loading"), null);
  });

  it("stops the preview loop on remove", function () {
    window.__DISABLE_PREVIEW_ANIMATION__ = false;
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });
    m.mount(host, null);
    assert.strictEqual(stopPreviewAnimation(), false);
  });
});

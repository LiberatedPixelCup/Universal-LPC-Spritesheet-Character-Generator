import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  AnimationPreview,
  PreviewCanvas,
} from "../../../sources/components/preview/AnimationPreview.ts";
import {
  setCurrentCustomAnimations,
  stopPreviewAnimation,
} from "../../../sources/canvas/preview-animation.ts";
import { customAnimations } from "../../../sources/custom-animations.ts";
import * as canvasRenderer from "../../../sources/canvas/renderer.ts";
import { createState } from "../../../sources/state/state.ts";
import { importStateFromJSON } from "../../../sources/state/json.ts";
let state;
import {
  ANIMATION_CONFIGS,
  FRAME_SIZE,
} from "../../../sources/state/constants.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";

describe("AnimationPreview", function () {
  let host;
  let previousRenderer;
  let catalog;
  let catalogWriter;

  beforeEach(function () {
    state = createState();
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    catalogWriter.registerLayersMetadata({});
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
    const preview = host.querySelector("#previewAnimations");
    assert.notEqual(preview, null);
    assert.strictEqual(preview.width, 4 * FRAME_SIZE);
    assert.strictEqual(preview.height, FRAME_SIZE);
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

  it("sizes the preview canvas to a custom animation frame size", function () {
    setCurrentCustomAnimations({ tool_rod: customAnimations.tool_rod });
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    const select = host.querySelector("select");
    select.value = "tool_rod";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    m.redraw.sync();

    const preview = host.querySelector("#previewAnimations");
    assert.strictEqual(preview.width, 4 * customAnimations.tool_rod.frameSize);
    assert.strictEqual(preview.height, customAnimations.tool_rod.frameSize);
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

  it("restores canvas zoom when the animation panel reopens", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });
    state.previewCanvasZoomLevel = 2;
    m.redraw.sync();
    const original = host.querySelector("#previewAnimations");
    const toggle = host.querySelector("button.collapsible-header");

    toggle.click();
    m.redraw.sync();
    assert.isNull(host.querySelector("#previewAnimations"));
    toggle.click();
    m.redraw.sync();

    const reopened = host.querySelector("#previewAnimations");
    assert.notStrictEqual(reopened, original);
    assert.strictEqual(reopened.style.zoom, "2");
  });

  it("uses imported animation even when the outfit is unchanged", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });
    Object.assign(
      state,
      importStateFromJSON(
        catalog,
        state,
        JSON.stringify({
          version: 2,
          bodyType: state.bodyType,
          selections: state.selections,
          selectedAnimation: "slash",
        }),
      ),
    );
    m.redraw.sync();

    assert.strictEqual(host.querySelector("select").value, "slash");
    assert.strictEqual(
      host.querySelector(".lpc-frame-cycle").textContent,
      ANIMATION_CONFIGS.slash.cycle.join("-"),
    );
  });

  it("preserves a custom animation request until the outfit has rendered", function () {
    state.previewBootstrapRenderDone = true;
    state.pendingCharacterRender = Promise.resolve();
    state.selectedAnimation = "wheelchair";
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    assert.strictEqual(state.selectedAnimation, "wheelchair");
    assert.strictEqual(host.querySelector("select").value, "walk");
    setCurrentCustomAnimations({ wheelchair: customAnimations.wheelchair });
    state.pendingCharacterRender = null;
    m.redraw.sync();
    assert.strictEqual(host.querySelector("select").value, "wheelchair");

    setCurrentCustomAnimations({});
    state.pendingCharacterRender = Promise.resolve();
    m.redraw.sync();
    assert.strictEqual(state.selectedAnimation, "wheelchair");
    state.pendingCharacterRender = null;
    m.redraw.sync();
    assert.strictEqual(state.selectedAnimation, "walk");
    assert.strictEqual(host.querySelector("select").value, "walk");
  });

  it("repaints the preview canvas when preview zoom changes", function () {
    m.mount(host, { view: () => m(AnimationPreview, { catalog, state }) });

    state.previewCanvasZoomLevel = 1.25;
    m.redraw.sync();

    assert.strictEqual(state.previewCanvasZoomLevel, 1.25);
  });

  it("starts a static preview from PreviewCanvas oncreate", function () {
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const vnode = {
      attrs: {
        state,
        selectedAnimation: "walk",
        zoomLevel: 1,
        onFrameCycleUpdate() {},
      },
      state: {},
      dom: canvas,
    };

    PreviewCanvas.oncreate(vnode);
    assert.strictEqual(vnode.state.lastAnimation, "walk");
    PreviewCanvas.onremove(vnode);
  });

  it("repaints a static preview frame from PreviewCanvas onupdate", function () {
    state.previewCanvasZoomLevel = 1.25;
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const vnode = {
      attrs: {
        state,
        selectedAnimation: "walk",
        zoomLevel: 1,
        onFrameCycleUpdate() {},
      },
      state: {
        lastAnimation: "walk",
        zoomLevel: 1,
        pinch: null,
        _pinchUnmounted: false,
      },
      dom: canvas,
    };

    PreviewCanvas.onupdate(vnode);

    assert.strictEqual(vnode.state.zoomLevel, 1.25);
  });

  it("restarts preview animation when PreviewCanvas selectedAnimation changes", function () {
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const vnode = {
      attrs: {
        state,
        selectedAnimation: "slash",
        zoomLevel: 1,
        onFrameCycleUpdate() {},
      },
      state: {
        lastAnimation: "walk",
        zoomLevel: 1,
        pinch: null,
        _pinchUnmounted: false,
      },
      dom: canvas,
    };

    PreviewCanvas.onupdate(vnode);

    assert.strictEqual(vnode.state.lastAnimation, "slash");
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

import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { FullSpritesheetPreview } from "../../../sources/components/preview/FullSpritesheetPreview.ts";
import PinchToZoom from "../../../sources/components/preview/PinchToZoom.ts";
import * as canvasRenderer from "../../../sources/canvas/renderer.ts";
import { createState } from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";

describe("FullSpritesheetPreview", function () {
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
    canvasRenderer.initCanvas();
    state.showTransparencyGrid = true;
    state.applyTransparencyMask = false;
    state.fullSpritesheetCanvasZoomLevel = 1;
    state.isRenderingCharacter = false;
  });

  afterEach(function () {
    sinon.restore();
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

    const sheet = host.querySelector("#spritesheet-preview");
    assert.notEqual(sheet, null);
    assert.strictEqual(sheet.width, canvasRenderer.SHEET_WIDTH);
    assert.strictEqual(sheet.height, canvasRenderer.SHEET_HEIGHT);
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

  it("keeps the previous spritesheet when grid changes during compositing", function () {
    const offscreen = canvasRenderer.canvas;
    const paint = (color) => {
      const ctx = offscreen.getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    };
    paint("#ff0000");
    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });
    const preview = host.querySelector("#spritesheet-preview");
    const previousWidth = preview.width;
    const pixel = () =>
      Array.from(preview.getContext("2d").getImageData(0, 0, 1, 1).data);
    assert.deepEqual(pixel(), [255, 0, 0, 255]);

    state.pendingCharacterRender = Promise.resolve();
    offscreen.width = previousWidth + 64;
    paint("#0000ff");
    state.showTransparencyGrid = false;
    m.redraw.sync();
    assert.strictEqual(preview.width, previousWidth);
    assert.deepEqual(pixel(), [255, 0, 0, 255]);

    state.pendingCharacterRender = null;
    m.redraw.sync();
    assert.strictEqual(preview.width, previousWidth + 64);
    assert.deepEqual(pixel(), [0, 0, 255, 255]);
  });

  it("persists pinch zoom across redraws and avoids redundant canvas redraws on unrelated updates", async function () {
    let pinchCallback;
    const setZoom = sinon.spy();
    const destroy = sinon.spy();
    sinon.stub(PinchToZoom, "create").callsFake(async (_el, onZoom) => {
      pinchCallback = onZoom;
      return { setZoom, destroy };
    });

    m.mount(host, {
      view: () => m(FullSpritesheetPreview, { catalog, state }),
    });
    await Promise.resolve();

    const sheet = host.querySelector("#spritesheet-preview");
    const ctx = sheet.getContext("2d");
    const clearSpy = sinon.spy(ctx, "clearRect");

    // Unrelated redraw should NOT repaint the full spritesheet canvas
    m.redraw.sync();
    assert.strictEqual(clearSpy.callCount, 0);

    // Pinch zoom updates state & CSS zoom and persists across subsequent redraw
    pinchCallback(1.5);
    m.redraw.sync();
    assert.strictEqual(state.fullSpritesheetCanvasZoomLevel, 1.5);
    assert.strictEqual(sheet.style.zoom, "1.5");
    assert.include(host.textContent, "150%");
    assert.strictEqual(clearSpy.callCount, 0);

    // Slider change updates zoom and syncs PinchToZoom without full repaint
    const slider = host.querySelector("input[type=range]");
    slider.value = "1.2";
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    m.redraw.sync();
    assert.strictEqual(sheet.style.zoom, "1.2");
    assert.isTrue(setZoom.calledWith(1.2));
    assert.strictEqual(clearSpy.callCount, 0);

    // Toggling grid triggers a full repaint
    state.showTransparencyGrid = false;
    m.redraw.sync();
    assert.isAbove(clearSpy.callCount, 0);
  });
});

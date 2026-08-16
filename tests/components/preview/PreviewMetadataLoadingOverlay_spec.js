import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { PreviewMetadataLoadingOverlay } from "../../../sources/components/preview/PreviewMetadataLoadingOverlay.ts";
import { state } from "../../../sources/state/state.ts";
import {
  resetOffscreenCanvasStateForTests,
  setOffscreenCanvasInitializedForTests,
} from "../../../sources/canvas/renderer.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";

describe("PreviewMetadataLoadingOverlay", function () {
  let host;
  let catalog;

  beforeEach(function () {
    catalog = createCatalog();
    catalog.registerFromLayersModule({ itemLayers: {} });
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    state.isRenderingCharacter = false;
    state.previewBootstrapRenderDone = false;
    resetOffscreenCanvasStateForTests();
  });

  it("renders no DOM when preview pipeline reports ready", function () {
    setOffscreenCanvasInitializedForTests(true);
    state.previewBootstrapRenderDone = true;
    state.isRenderingCharacter = false;

    m.render(host, m(PreviewMetadataLoadingOverlay, { catalog }));

    assert.strictEqual(
      host.querySelector(".preview-canvas-loading-overlay"),
      null,
    );
    assert.strictEqual(host.textContent.trim(), "");
  });

  it("renders no DOM while isRenderingCharacter is true (compositing)", function () {
    setOffscreenCanvasInitializedForTests(true);
    state.previewBootstrapRenderDone = false;
    state.isRenderingCharacter = true;

    m.render(host, m(PreviewMetadataLoadingOverlay, { catalog }));

    assert.strictEqual(
      host.querySelector(".preview-canvas-loading-overlay"),
      null,
    );
  });

  it("renders overlay with status semantics while layer data is not ready", function () {
    catalog = createCatalog();

    m.render(host, m(PreviewMetadataLoadingOverlay, { catalog }));

    const overlay = host.querySelector(".preview-canvas-loading-overlay");
    assert.notEqual(overlay, null);
    assert.strictEqual(overlay.getAttribute("role"), "status");
    assert.strictEqual(overlay.getAttribute("aria-live"), "polite");

    const inner = host.querySelector(".preview-canvas-loading-inner");
    assert.notEqual(inner, null);

    const spinner = inner.querySelector("span.loading");
    assert.notEqual(spinner, null);
    assert.isTrue(spinner.hasAttribute("aria-hidden"));

    const text = host.querySelector(".preview-canvas-loading-text");
    assert.notEqual(text, null);
    assert.strictEqual(text.textContent, "Loading layer data…");
  });
});

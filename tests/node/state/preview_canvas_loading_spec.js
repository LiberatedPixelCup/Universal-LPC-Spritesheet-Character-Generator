import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerFromLayersModule,
  resetCatalogForTests,
} from "../../../sources/state/catalog.ts";
import { getPreviewCanvasLoadingMessage } from "../../../sources/state/preview-canvas-loading.js";
import { state } from "../../../sources/state/state.js";
import {
  resetOffscreenCanvasStateForTests,
  setOffscreenCanvasInitializedForTests,
} from "../../../sources/canvas/renderer.js";

test("getPreviewCanvasLoadingMessage: null only when S5, offscreen, and bootstrap all done", () => {
  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  state.isRenderingCharacter = false;

  assert.equal(getPreviewCanvasLoadingMessage(), "Loading layer data…");
  registerFromLayersModule({ itemLayers: {} });
  assert.equal(getPreviewCanvasLoadingMessage(), "Loading layer data…");
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasLoadingMessage(), "Loading layer data…");
  state.previewBootstrapRenderDone = true;
  assert.equal(getPreviewCanvasLoadingMessage(), null);

  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
});

test("getPreviewCanvasLoadingMessage: null while compositing (render spinner only)", () => {
  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  registerFromLayersModule({ itemLayers: {} });
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasLoadingMessage(), "Loading layer data…");
  state.isRenderingCharacter = true;
  assert.equal(getPreviewCanvasLoadingMessage(), null);

  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.isRenderingCharacter = false;
  state.previewBootstrapRenderDone = false;
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerFromLayersModule,
  resetCatalogForTests,
} from "../../../sources/state/catalog.ts";
import { getPreviewCanvasState } from "../../../sources/state/preview-canvas-loading.ts";
import { state } from "../../../sources/state/state.ts";
import {
  resetOffscreenCanvasStateForTests,
  setOffscreenCanvasInitializedForTests,
} from "../../../sources/canvas/renderer.js";

test("getPreviewCanvasState walks through pending kinds in order, then ready", () => {
  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  state.isRenderingCharacter = false;

  assert.equal(getPreviewCanvasState().kind, "loading-layers");
  registerFromLayersModule({ itemLayers: {} });
  assert.equal(getPreviewCanvasState().kind, "canvas-not-initialized");
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState().kind, "bootstrap-pending");
  state.previewBootstrapRenderDone = true;
  assert.equal(getPreviewCanvasState().kind, "ready");

  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
});

test("getPreviewCanvasState reports `rendering` while a render is in flight, even with pending preconditions", () => {
  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  registerFromLayersModule({ itemLayers: {} });
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState().kind, "bootstrap-pending");
  state.isRenderingCharacter = true;
  assert.equal(getPreviewCanvasState().kind, "rendering");

  resetCatalogForTests();
  resetOffscreenCanvasStateForTests();
  state.isRenderingCharacter = false;
  state.previewBootstrapRenderDone = false;
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { getPreviewCanvasState } from "../../../sources/state/preview-canvas-loading.ts";
import { state } from "../../../sources/state/state.ts";
import {
  resetOffscreenCanvasStateForTests,
  setOffscreenCanvasInitializedForTests,
} from "../../../sources/canvas/renderer.ts";

test("getPreviewCanvasState walks through pending kinds in order, then ready", () => {
  const catalog = createCatalog();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  state.isRenderingCharacter = false;

  assert.equal(getPreviewCanvasState(catalog).kind, "loading-layers");
  catalog.registerFromLayersModule({ itemLayers: {} });
  assert.equal(getPreviewCanvasState(catalog).kind, "canvas-not-initialized");
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState(catalog).kind, "bootstrap-pending");
  state.previewBootstrapRenderDone = true;
  assert.equal(getPreviewCanvasState(catalog).kind, "ready");

  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
});

test("getPreviewCanvasState reports `rendering` while a render is in flight, even with pending preconditions", () => {
  const catalog = createCatalog();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  catalog.registerFromLayersModule({ itemLayers: {} });
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState(catalog).kind, "bootstrap-pending");
  state.isRenderingCharacter = true;
  assert.equal(getPreviewCanvasState(catalog).kind, "rendering");

  resetOffscreenCanvasStateForTests();
  state.isRenderingCharacter = false;
  state.previewBootstrapRenderDone = false;
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { getPreviewCanvasState } from "../../../sources/state/preview-canvas-loading.ts";
import { createState } from "../../../sources/state/state.ts";
import {
  resetOffscreenCanvasStateForTests,
  setOffscreenCanvasInitializedForTests,
} from "../../../sources/canvas/renderer.ts";

test("getPreviewCanvasState walks through pending kinds in order, then ready", () => {
  const { reader: catalog, writer } = createCatalog();
  const state = createState();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  state.isRenderingCharacter = false;

  assert.equal(getPreviewCanvasState(catalog, state).kind, "loading-layers");
  writer.registerLayersMetadata({});
  assert.equal(
    getPreviewCanvasState(catalog, state).kind,
    "canvas-not-initialized",
  );
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState(catalog, state).kind, "bootstrap-pending");
  state.previewBootstrapRenderDone = true;
  assert.equal(getPreviewCanvasState(catalog, state).kind, "ready");

  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
});

test("getPreviewCanvasState reports `rendering` while a render is in flight, even with pending preconditions", () => {
  const { reader: catalog, writer } = createCatalog();
  const state = createState();
  resetOffscreenCanvasStateForTests();
  state.previewBootstrapRenderDone = false;
  writer.registerLayersMetadata({});
  setOffscreenCanvasInitializedForTests(true);
  assert.equal(getPreviewCanvasState(catalog, state).kind, "bootstrap-pending");
  state.isRenderingCharacter = true;
  assert.equal(getPreviewCanvasState(catalog, state).kind, "rendering");

  resetOffscreenCanvasStateForTests();
  state.isRenderingCharacter = false;
  state.previewBootstrapRenderDone = false;
});

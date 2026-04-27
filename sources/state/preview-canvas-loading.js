/**
 * Preview panel loading gate: S5 (layers) alone is not enough — layers can load before the
 * offscreen canvas exists or before the first bootstrap `renderCharacter` finishes.
 */
import { isLayersReady } from "./catalog.ts";
import { isOffscreenCanvasInitialized } from "../canvas/renderer.js";
import { state } from "./state.js";

/**
 * @returns {string|null} "Loading layer data…" while the preview should stay covered; null when
 *   layers are registered, offscreen canvas exists, and main bootstrap render has finished.
 */
export function getPreviewCanvasLoadingMessage() {
  if (state.isRenderingCharacter) {
    return null;
  }
  if (!isLayersReady()) {
    return "Loading layer data…";
  }
  if (!isOffscreenCanvasInitialized()) {
    return "Loading layer data…";
  }
  if (!state.previewBootstrapRenderDone) {
    return "Loading layer data…";
  }
  return null;
}

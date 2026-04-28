/**
 * Preview panel state machine. The preview canvas should be covered by an
 * overlay until: (a) the layers chunk (S5) is registered, (b) the offscreen
 * canvas exists, and (c) the first bootstrap `renderCharacter` has completed.
 * Mid-render is not "blocked" — the render itself is the activity, so we
 * surface a `rendering` state that consumers treat as ready.
 */
import { isLayersReady } from "./catalog.ts";
import { isOffscreenCanvasInitialized } from "../canvas/renderer.js";
import { state } from "./state.js";

export type PreviewState =
  | { kind: "rendering" }
  | { kind: "ready" }
  | { kind: "loading-layers" }
  | { kind: "canvas-not-initialized" }
  | { kind: "bootstrap-pending" };

/**
 * Snapshot the preview's current state. The UI overlay shows for any kind
 * other than `rendering` or `ready`.
 */
export function getPreviewCanvasState(): PreviewState {
  if (state.isRenderingCharacter) return { kind: "rendering" };
  if (!isLayersReady()) return { kind: "loading-layers" };
  if (!isOffscreenCanvasInitialized())
    return { kind: "canvas-not-initialized" };
  if (!state.previewBootstrapRenderDone) return { kind: "bootstrap-pending" };
  return { kind: "ready" };
}

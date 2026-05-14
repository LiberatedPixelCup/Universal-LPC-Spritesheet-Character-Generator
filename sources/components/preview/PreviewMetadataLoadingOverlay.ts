// Semi-transparent layer over the preview canvas until layers + offscreen canvas + bootstrap draw.
import m from "mithril";
import {
  getPreviewCanvasState,
  type PreviewState,
} from "../../state/preview-canvas-loading.ts";

/** UI copy for blocking states. `rendering`/`ready` produce no overlay. */
function messageForState(state: PreviewState): string | null {
  switch (state.kind) {
    case "rendering":
    case "ready":
      return null;
    case "loading-layers":
    case "canvas-not-initialized":
    case "bootstrap-pending":
      return "Loading layer data…";
  }
}

export const PreviewMetadataLoadingOverlay: m.Component = {
  view() {
    const message = messageForState(getPreviewCanvasState());
    if (!message) {
      return null;
    }
    return m(
      "div.preview-canvas-loading-overlay",
      { role: "status", "aria-live": "polite" },
      m("div.preview-canvas-loading-inner", [
        m("span.loading", {
          "aria-hidden": true,
        }),
        m("span.is-size-7.has-text-grey.preview-canvas-loading-text", message),
      ]),
    );
  },
};

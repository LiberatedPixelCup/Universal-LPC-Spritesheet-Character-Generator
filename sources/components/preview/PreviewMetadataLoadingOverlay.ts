// Semi-transparent layer over the preview canvas until layers + offscreen canvas + bootstrap draw.
import m from "mithril";
import {
  getPreviewCanvasState,
  type PreviewState,
} from "../../state/preview-canvas-loading.ts";
import type { CatalogReader } from "../../state/catalog.ts";
import type { State } from "../../state/state.ts";

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

export const PreviewMetadataLoadingOverlay: m.Component<{
  catalog: CatalogReader;
  state: State;
}> = {
  view(vnode) {
    const { catalog, state } = vnode.attrs;
    const message = messageForState(getPreviewCanvasState(catalog, state));
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

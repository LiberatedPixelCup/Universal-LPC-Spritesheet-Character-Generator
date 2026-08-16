// Main app component
import m from "mithril";
import { state } from "../state/state.ts";
import { syncSelectionsToHash } from "../state/hash.ts";
import type { CatalogReader } from "../state/catalog.ts";
import { Download } from "./download/Download.ts";
import { FiltersPanel } from "./FiltersPanel.ts";
import { Credits } from "./download/Credits.ts";
import { AdvancedTools } from "./advanced/AdvancedTools.ts";
import { renderCharacter } from "../canvas/renderer.ts";

/** App threads the catalog owned by application bootstrap through the UI. */
type AppAttrs = { catalog: CatalogReader };

type AppState = {
  prevSelections: string;
  prevBodyType: string;
  prevCustomImage: HTMLImageElement | null;
  prevCustomZPos: number;
};

export const App: m.Component<AppAttrs, AppState> = {
  oninit(vnode) {
    // Track previous state to detect changes
    vnode.state.prevSelections = JSON.stringify(state.selections);
    vnode.state.prevBodyType = state.bodyType;
    vnode.state.prevCustomImage = state.customUploadedImage;
    vnode.state.prevCustomZPos = state.customImageZPos;
  },
  onupdate(vnode) {
    // Only sync hash and render canvas if selections, bodyType, or custom image changed
    const currentSelections = JSON.stringify(state.selections);
    const currentBodyType = state.bodyType;
    const currentCustomImage = state.customUploadedImage;
    const currentCustomZPos = state.customImageZPos;

    if (
      currentSelections !== vnode.state.prevSelections ||
      currentBodyType !== vnode.state.prevBodyType ||
      currentCustomImage !== vnode.state.prevCustomImage ||
      currentCustomZPos !== vnode.state.prevCustomZPos
    ) {
      syncSelectionsToHash(vnode.attrs.catalog);
      if (window.canvasRenderer) {
        // Render to offscreen canvas (async)
        renderCharacter(
          vnode.attrs.catalog,
          state.selections,
          state.bodyType,
        ).then(() => {
          // Trigger redraw to update preview canvas after offscreen render completes
          m.redraw();
        });
      }

      // Update tracked state
      vnode.state.prevSelections = currentSelections;
      vnode.state.prevBodyType = currentBodyType;
      vnode.state.prevCustomImage = currentCustomImage;
      vnode.state.prevCustomZPos = currentCustomZPos;
    }
  },
  view(vnode) {
    return m("div", [
      m(Download, { catalog: vnode.attrs.catalog }),
      m(FiltersPanel, { catalog: vnode.attrs.catalog }),
      m(Credits, { catalog: vnode.attrs.catalog }),
      m(AdvancedTools),
    ]);
  },
};

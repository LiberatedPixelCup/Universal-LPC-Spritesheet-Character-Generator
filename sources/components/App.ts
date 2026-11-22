// Main app component
import m from "mithril";
import type { State } from "../state/state.ts";
import { syncSelectionsToHash } from "../state/hash.ts";
import type { CatalogReader } from "../state/catalog.ts";
import { Download } from "./download/Download.ts";
import { FiltersPanel } from "./FiltersPanel.ts";
import { Credits } from "./download/Credits.ts";
import { AdvancedTools } from "./advanced/AdvancedTools.ts";
import { renderCharacter } from "../canvas/renderer.ts";
import type { ApplicationModels } from "../models/application.ts";

/** App threads the catalog owned by application bootstrap through the UI. */
type AppAttrs = {
  catalog: CatalogReader;
  state: State;
  models: ApplicationModels;
};

type AppState = {
  prevSelections: string;
  prevBodyType: string;
  prevCustomImage: HTMLImageElement | null;
  prevCustomZPos: number;
};

export const App: m.Component<AppAttrs, AppState> = {
  oninit(vnode) {
    const { state } = vnode.attrs;
    // Track previous state to detect changes
    vnode.state.prevSelections = JSON.stringify(state.selections);
    vnode.state.prevBodyType = state.bodyType;
    vnode.state.prevCustomImage = state.customUploadedImage;
    vnode.state.prevCustomZPos = state.customImageZPos;
  },
  onupdate(vnode) {
    const { catalog, state } = vnode.attrs;
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
      syncSelectionsToHash(catalog, state);
      if (window.canvasRenderer) {
        const render = renderCharacter(
          catalog,
          state,
          state.selections,
          state.bodyType,
        );
        state.pendingCharacterRender = render;
        const finish = () => {
          if (state.pendingCharacterRender !== render) return;
          state.pendingCharacterRender = null;
          m.redraw();
        };
        void render.then(finish, (error: unknown) => {
          console.error("Character render failed:", error);
          finish();
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
    const { state, models } = vnode.attrs;
    return m("div.lpc-app-stack", [
      m(Download, { createModel: models.createDownloadModel }),
      m(FiltersPanel, {
        // Models are meant to be created lazily when the leaf components need it
        createSearchControlModel: models.createSearchControlModel,
        createLicenseFiltersModel: models.createLicenseFiltersModel,
        createAnimationFiltersModel: models.createAnimationFiltersModel,
        createCurrentSelectionsModel: models.createCurrentSelectionsModel,
        createCategoryTreeModel: models.createCategoryTreeModel,
      }),
      m(Credits, { createModel: models.createCreditsModel }),
      m(AdvancedTools, { state }),
    ]);
  },
};

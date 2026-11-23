// Main app component
import m from "mithril";
import type { State } from "../state/state.ts";
import { syncSelectionsToHash } from "../state/hash.ts";
import type { CatalogReader } from "../state/catalog.ts";
import { renderCharacter } from "../canvas/renderer.ts";
import type { ApplicationModels } from "../models/application.ts";
import { getImageExportBlock } from "../models/download.ts";

import { Toolbar } from "./Toolbar.ts";
import { LeftSidebar } from "./sidebar/LeftSidebar.ts";
import { CategoryTree } from "./tree/CategoryTree.ts";
import { SearchControl } from "./filters/SearchControl.ts";
import { FiltersPanel } from "./FiltersPanel.ts";
import { PreviewArea } from "./preview/PreviewArea.ts";
import { ExportModal } from "./download/ExportModal.ts";
import { CharacterCreditsModal } from "./download/CharacterCreditsModal.ts";
import { AdvancedToolsDrawer } from "./advanced/AdvancedToolsDrawer.ts";

/** App threads the catalog owned by application bootstrap through the UI. */
export type AppAttrs = {
  catalog: CatalogReader;
  state: State;
  models: ApplicationModels;
};

type AppState = {
  prevSelections: string;
  prevBodyType: string;
  prevCustomImage: HTMLImageElement | null;
  prevCustomZPos: number;
  prevMatchBodyColorEnabled: boolean;
  handleKeydown: (event: KeyboardEvent) => void;
  desktopCategories: MediaQueryList;
  isDesktopCategories: boolean;
  handleCategoriesLayoutChange: () => void;
  toggleCategories: () => void;
  restoreCategoriesFocus: boolean;
  root?: Element;
  unsubscribeMenuAction?: () => void;
  lastElectronCanExport?: boolean;
  characterRenderController?: AbortController;
};

function syncElectronExportState(vnode: m.Vnode<AppAttrs, AppState>): void {
  const update = window.electronAPI?.updateExportState;
  if (!update) return;
  const { catalog, state } = vnode.attrs;
  const canExport = !getImageExportBlock(catalog, state);
  if (vnode.state.lastElectronCanExport !== canExport) {
    vnode.state.lastElectronCanExport = canExport;
    update(canExport);
  }
}

export const App: m.Component<AppAttrs, AppState> = {
  oninit(vnode) {
    const { state } = vnode.attrs;
    vnode.state.prevSelections = JSON.stringify(state.selections);
    vnode.state.prevBodyType = state.bodyType;
    vnode.state.prevCustomImage = state.customUploadedImage;
    vnode.state.prevCustomZPos = state.customImageZPos;
    vnode.state.prevMatchBodyColorEnabled = state.matchBodyColorEnabled;
    const desktopCategories = window.matchMedia("(min-width: 1100px)");
    vnode.state.desktopCategories = desktopCategories;
    vnode.state.isDesktopCategories = desktopCategories.matches;
    vnode.state.restoreCategoriesFocus = false;
    vnode.state.handleCategoriesLayoutChange = () => {
      const sidebar = vnode.state.root?.querySelector(".lpc-sidebar");
      vnode.state.restoreCategoriesFocus ||= Boolean(
        sidebar?.contains(document.activeElement),
      );
      vnode.state.isDesktopCategories = desktopCategories.matches;
      state.isCategoriesDrawerOpen = false;
      m.redraw();
    };
    desktopCategories.addEventListener(
      "change",
      vnode.state.handleCategoriesLayoutChange,
    );

    vnode.state.toggleCategories = () => {
      if (vnode.state.isDesktopCategories) {
        state.isSidebarOpen = !state.isSidebarOpen;
      } else {
        state.isCategoriesDrawerOpen = !state.isCategoriesDrawerOpen;
      }
      m.redraw();
    };

    vnode.state.handleKeydown = (event: KeyboardEvent) => {
      // Cmd+F or Ctrl+F -> Focus Search
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        const searchInput =
          document.querySelector<HTMLInputElement>("input[type=search]");
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
      // Escape -> Close topmost modal / drawer
      if (event.key === "Escape") {
        if (document.querySelector("dialog[open]")) return;
        if (state.isExportModalOpen) {
          state.isExportModalOpen = false;
          m.redraw();
        } else if (state.isCreditsModalOpen) {
          state.isCreditsModalOpen = false;
          m.redraw();
        } else if (state.isAdvancedDrawerOpen) {
          state.isAdvancedDrawerOpen = false;
          m.redraw();
        } else if (state.isCategoriesDrawerOpen) {
          state.isCategoriesDrawerOpen = false;
          m.redraw();
        } else if (state.isMoreMenuOpen) {
          state.isMoreMenuOpen = false;
          m.redraw();
        }
      }
    };
    window.addEventListener("keydown", vnode.state.handleKeydown);

    if (window.electronAPI?.onMenuAction) {
      vnode.state.unsubscribeMenuAction = window.electronAPI.onMenuAction(
        (action: string) => {
          if (action === "export") {
            if (state.isExportingZip) return;
            state.isCreditsModalOpen = false;
            state.isMoreMenuOpen = false;
            state.isExportModalOpen = true;
            m.redraw();
          } else if (action === "find") {
            const searchInput =
              document.querySelector<HTMLInputElement>("input[type=search]");
            searchInput?.focus();
          } else if (action === "toggle-sidebar") {
            vnode.state.toggleCategories();
          } else if (action === "advanced-tools") {
            state.isAdvancedDrawerOpen = true;
            m.redraw();
          } else if (action === "character-credits") {
            state.isExportModalOpen = false;
            state.isMoreMenuOpen = false;
            state.isCreditsModalOpen = true;
            m.redraw();
          } else if (action === "copy-json") {
            void vnode.attrs.models
              .createDownloadModel()
              .exportJsonToClipboard()
              .then((res) => {
                if (res.kind === "success") {
                  alert("Exported character JSON to clipboard!");
                } else {
                  alert(res.message ?? "Failed to copy character JSON.");
                }
              });
          } else if (action === "import-json") {
            void vnode.attrs.models
              .createDownloadModel()
              .importJsonFromClipboard()
              .then((res) => {
                if (res.kind === "success") {
                  alert("Imported character JSON successfully!");
                  m.redraw();
                } else {
                  alert(res.message ?? "Failed to import character JSON.");
                }
              });
          }
        },
      );
    }
  },
  oncreate(vnode) {
    vnode.state.root = vnode.dom;
    syncElectronExportState(vnode);
  },
  onremove(vnode) {
    window.removeEventListener("keydown", vnode.state.handleKeydown);
    vnode.state.desktopCategories.removeEventListener(
      "change",
      vnode.state.handleCategoriesLayoutChange,
    );
    vnode.state.unsubscribeMenuAction?.();
    vnode.state.characterRenderController?.abort();
  },
  onupdate(vnode) {
    if (vnode.state.restoreCategoriesFocus) {
      vnode.state.restoreCategoriesFocus = false;
      vnode.dom
        .querySelector<HTMLButtonElement>(".lpc-categories-toggle")
        ?.focus();
    }
    const { catalog, state } = vnode.attrs;
    const currentSelections = JSON.stringify(state.selections);
    const currentBodyType = state.bodyType;
    const currentCustomImage = state.customUploadedImage;
    const currentCustomZPos = state.customImageZPos;
    const currentMatchBodyColorEnabled = state.matchBodyColorEnabled;

    const outfitChanged =
      currentSelections !== vnode.state.prevSelections ||
      currentBodyType !== vnode.state.prevBodyType;
    const renderInputsChanged =
      outfitChanged ||
      currentCustomImage !== vnode.state.prevCustomImage ||
      currentCustomZPos !== vnode.state.prevCustomZPos ||
      currentMatchBodyColorEnabled !== vnode.state.prevMatchBodyColorEnabled;

    if (
      catalog.isIndexReady() &&
      catalog.isLiteReady() &&
      renderInputsChanged
    ) {
      state.canvasReadyForExport = false;
      if (outfitChanged) syncSelectionsToHash(catalog, state);
      if (window.canvasRenderer) {
        vnode.state.characterRenderController?.abort();
        const controller = new AbortController();
        vnode.state.characterRenderController = controller;
        const render = renderCharacter(
          catalog,
          state,
          state.selections,
          currentBodyType,
          null,
          controller.signal,
        );
        state.pendingCharacterRender = render;
        const finish = (isSuccess: boolean, error?: unknown) => {
          if (state.pendingCharacterRender !== render) return;
          state.pendingCharacterRender = null;
          if (controller.signal.aborted) return;
          vnode.state.characterRenderController = undefined;
          if (isSuccess) {
            state.renderedCharacter = {
              selections: currentSelections,
              bodyType: currentBodyType,
              customImage: currentCustomImage,
              customZPos: currentCustomZPos,
              matchBodyColorEnabled: currentMatchBodyColorEnabled,
            };
            state.canvasReadyForExport = true;
            state.lastRenderError = null;
          } else {
            state.canvasReadyForExport = false;
            state.lastRenderError = error ? String(error) : "Render failed";
          }
          m.redraw();
        };
        void render.then(
          () => finish(true),
          (error: unknown) => {
            if (!controller.signal.aborted) {
              console.error("Character render failed:", error);
            }
            finish(false, error);
          },
        );
      }

      vnode.state.prevSelections = currentSelections;
      vnode.state.prevBodyType = currentBodyType;
      vnode.state.prevCustomImage = currentCustomImage;
      vnode.state.prevCustomZPos = currentCustomZPos;
      vnode.state.prevMatchBodyColorEnabled = currentMatchBodyColorEnabled;
    }
    syncElectronExportState(vnode);
  },
  view(vnode) {
    const { catalog, state, models } = vnode.attrs;
    const isDesktop = vnode.state.isDesktopCategories;
    const closeCategoriesDrawer = () => {
      state.isCategoriesDrawerOpen = false;
    };

    return m("div.lpc-app-stack", [
      m(Toolbar, {
        state,
        createDownloadModel: models.createDownloadModel,
        categoriesExpanded: isDesktop
          ? state.isSidebarOpen
          : state.isCategoriesDrawerOpen,
        onToggleCategories: vnode.state.toggleCategories,
      }),
      m("main.lpc-main#columns-container", [
        m("div.lpc-workbench", [
          isDesktop &&
            state.isSidebarOpen &&
            m(LeftSidebar, {
              state,
              onClose: () => {
                state.isSidebarOpen = false;
              },
            }),
          m("div.lpc-chooser-column#chooser-column", [
            m("div#mithril-filters", [
              m(CategoryTree, {
                createModel: models.createCategoryTreeModel,
                headerContent: m("div.lpc-chooser-header", [
                  m(
                    "div.lpc-search-field",
                    m(SearchControl, {
                      createModel: models.createSearchControlModel,
                    }),
                  ),
                  m(FiltersPanel, {
                    createLicenseFiltersModel: models.createLicenseFiltersModel,
                    createAnimationFiltersModel:
                      models.createAnimationFiltersModel,
                    defaultOpen: false,
                  }),
                ]),
              }),
            ]),
          ]),
          m(PreviewArea, {
            catalog,
            state,
            createCurrentSelectionsModel: models.createCurrentSelectionsModel,
          }),
        ]),
      ]),
      !isDesktop &&
        state.isCategoriesDrawerOpen &&
        m(
          "div.lpc-drawer-backdrop",
          {
            onclick: closeCategoriesDrawer,
          },
          [
            m(
              "div.lpc-drawer-content",
              { onclick: (e: Event) => e.stopPropagation() },
              [
                m(LeftSidebar, {
                  state,
                  onClose: closeCategoriesDrawer,
                  onSelectCategory: closeCategoriesDrawer,
                }),
              ],
            ),
          ],
        ),
      state.isAdvancedDrawerOpen &&
        m(AdvancedToolsDrawer, {
          state,
          onClose: () => {
            state.isAdvancedDrawerOpen = false;
          },
        }),
      state.isExportModalOpen &&
        m(ExportModal, {
          state,
          createModel: models.createDownloadModel,
          onClose: () => {
            state.isExportModalOpen = false;
          },
        }),
      state.isCreditsModalOpen &&
        m(CharacterCreditsModal, {
          createModel: models.createCreditsModel,
          onClose: () => {
            state.isCreditsModalOpen = false;
          },
        }),
    ]);
  },
};

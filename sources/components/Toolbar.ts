import m from "mithril";
import type { State } from "../state/state.ts";
import type { DownloadModel } from "../models/download.ts";

export type ToolbarAttrs = {
  state: State;
  createDownloadModel: () => DownloadModel;
  categoriesExpanded: boolean;
  onToggleCategories: () => void;
};

type ToolbarState = {
  handleOutsidePointerDown?: (event: Event) => void;
};

export const Toolbar: m.Component<ToolbarAttrs, ToolbarState> = {
  oncreate(vnode) {
    const root = vnode.dom;
    const handleOutsidePointerDown = (event: Event) => {
      const { state } = vnode.attrs;
      if (!state.isMoreMenuOpen) return;
      const dropdown = root.querySelector(".lpc-more-dropdown");
      if (
        dropdown &&
        event.target instanceof Node &&
        dropdown.contains(event.target)
      ) {
        return;
      }
      state.isMoreMenuOpen = false;
      m.redraw();
    };
    vnode.state.handleOutsidePointerDown = handleOutsidePointerDown;
    document.addEventListener("pointerdown", handleOutsidePointerDown);
  },
  onremove(vnode) {
    if (vnode.state.handleOutsidePointerDown) {
      document.removeEventListener(
        "pointerdown",
        vnode.state.handleOutsidePointerDown,
      );
      vnode.state.handleOutsidePointerDown = undefined;
    }
  },
  view(vnode) {
    const {
      state,
      createDownloadModel,
      categoriesExpanded,
      onToggleCategories,
    } = vnode.attrs;
    const downloadModel = createDownloadModel();
    const isElectron = Boolean(window.electronAPI?.isElectron);

    const openExportModal = () => {
      state.isCreditsModalOpen = false;
      state.isMoreMenuOpen = false;
      state.isExportModalOpen = true;
      m.redraw();
    };

    const toggleMoreMenu = () => {
      state.isMoreMenuOpen = !state.isMoreMenuOpen;
      m.redraw();
    };

    return m(
      "header.lpc-toolbar",
      { role: "toolbar", "aria-label": "Application toolbar" },
      [
        m("div.lpc-toolbar-left", [
          m(
            "button.button.is-small.lpc-toolbar-btn.lpc-categories-toggle",
            {
              type: "button",
              "aria-label": "Toggle Categories Sidebar",
              "aria-expanded": String(categoriesExpanded),
              onclick: onToggleCategories,
            },
            [
              m("span.lpc-toolbar-icon", { "aria-hidden": "true" }, "☰"),
              m("span.lpc-toolbar-label", "Categories"),
            ],
          ),
          m("div.lpc-toolbar-brand", [
            m("span.lpc-app-title", "Open Spritesheet"),
          ]),
        ]),
        m("div.lpc-toolbar-right", [
          m(
            "button.button.is-primary.is-small.lpc-btn-primary.lpc-toolbar-export-btn",
            {
              type: "button",
              disabled: state.isExportingZip,
              onclick: openExportModal,
            },
            "Export…",
          ),
          !isElectron &&
            m(
              "div.lpc-more-dropdown",
              { class: state.isMoreMenuOpen ? "is-active" : "" },
              [
                m(
                  "button.button.is-small.lpc-toolbar-btn.lpc-more-toggle",
                  {
                    type: "button",
                    "aria-label": "More options",
                    "aria-haspopup": "true",
                    "aria-expanded": String(state.isMoreMenuOpen),
                    onclick: toggleMoreMenu,
                  },
                  [
                    m("span", "More"),
                    m(
                      "span.lpc-dropdown-caret",
                      { "aria-hidden": "true" },
                      " ▾",
                    ),
                  ],
                ),
                state.isMoreMenuOpen &&
                  m("div.lpc-dropdown-menu", { role: "menu" }, [
                    m(
                      "button.lpc-dropdown-item",
                      {
                        type: "button",
                        role: "menuitem",
                        onclick: () => {
                          state.isMoreMenuOpen = false;
                          state.isAdvancedDrawerOpen = true;
                        },
                      },
                      "Advanced Tools…",
                    ),
                    m(
                      "button.lpc-dropdown-item",
                      {
                        type: "button",
                        role: "menuitem",
                        onclick: () => {
                          state.isMoreMenuOpen = false;
                          state.isExportModalOpen = false;
                          state.isCreditsModalOpen = true;
                        },
                      },
                      "Character Credits…",
                    ),
                    m(
                      "button.lpc-dropdown-item",
                      {
                        type: "button",
                        role: "menuitem",
                        disabled: Boolean(downloadModel.creditsDisabled),
                        title: downloadModel.creditsTitle,
                        onclick: () => {
                          if (downloadModel.creditsDisabled) return;
                          state.isMoreMenuOpen = false;
                          downloadModel.downloadCreditsCsv();
                        },
                      },
                      "Character Credits (CSV)",
                    ),
                    m("hr.lpc-dropdown-divider"),
                    m(
                      "button.lpc-dropdown-item",
                      {
                        type: "button",
                        role: "menuitem",
                        disabled: Boolean(downloadModel.copyTitle),
                        title: downloadModel.copyTitle,
                        onclick: async () => {
                          state.isMoreMenuOpen = false;
                          const res =
                            await downloadModel.exportJsonToClipboard();
                          if (res.kind === "success") {
                            alert("Exported character JSON to clipboard!");
                          } else {
                            alert(
                              res.message ??
                                "Failed to export character JSON to clipboard.",
                            );
                          }
                        },
                      },
                      "Copy Character JSON",
                    ),
                    m(
                      "button.lpc-dropdown-item",
                      {
                        type: "button",
                        role: "menuitem",
                        disabled: Boolean(downloadModel.importTitle),
                        title: downloadModel.importTitle,
                        onclick: async () => {
                          state.isMoreMenuOpen = false;
                          const res =
                            await downloadModel.importJsonFromClipboard();
                          if (res.kind === "success") {
                            alert("Imported character JSON successfully!");
                            m.redraw();
                          } else {
                            alert(
                              res.message ?? "Failed to import character JSON.",
                            );
                          }
                        },
                      },
                      "Import Character JSON…",
                    ),
                    m("hr.lpc-dropdown-divider"),
                    m(
                      "a.lpc-dropdown-item",
                      {
                        role: "menuitem",
                        href: "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        onclick: () => {
                          state.isMoreMenuOpen = false;
                        },
                      },
                      "LPC Generator (Original)",
                    ),
                    m(
                      "a.lpc-dropdown-item",
                      {
                        role: "menuitem",
                        href: "https://github.com/teakay1311/OpenSpritesheet",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        onclick: () => {
                          state.isMoreMenuOpen = false;
                        },
                      },
                      "Source on GitHub",
                    ),
                  ]),
              ],
            ),
        ]),
      ],
    );
  },
};

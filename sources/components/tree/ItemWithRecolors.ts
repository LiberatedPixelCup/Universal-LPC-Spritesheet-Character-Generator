// Item with recolors component
import m from "mithril";
import classNames from "classnames";
import {
  getSelectionGroup,
  selectItem,
  type State,
} from "../../state/state.ts";
import type { CatalogReader, ItemMerged } from "../../state/catalog.ts";
import { drawRecolorPreview } from "../../canvas/palette-recolor.ts";
import { getPaletteOptions, type PaletteOption } from "../../state/palettes.ts";
import { PaletteSelectModal } from "./PaletteSelectModal.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../../state/constants.ts";

export type ItemWithRecolorsAttrs = {
  itemId: string;
  meta: ItemMerged;
  isSearchMatch: boolean;
  isCompatible: boolean;
  tooltipText: string;
  showItemTooltips?: boolean;
  catalog: CatalogReader;
  state: State;
};

type ItemWithRecolorsState = {
  showPaletteModal: number | null;
  isLoading?: boolean;
  imagesLoaded: number;
  oldSelectedColors: string;
  _palettePreviewLastTotal?: number;
  // Mutated by `PaletteSelectModal` via the `rootViewNode` ref it receives.
  palettePreviewGateSeq?: number;
  palettePreviewExpected?: number;
  palettePreviewCompleted?: number;
};

type PaletteModalHost = { state: ItemWithRecolorsState };

/**
 * When switching to a different same-type recolor asset, apply the mapped
 * remembered color(s) immediately. First pick, already-selected, and
 * incompatible items are left unchanged; the caller still opens the popover.
 */
function applyRememberedColorsOnSwitch(
  state: State,
  itemId: string,
  meta: ItemMerged,
  paletteOptions: PaletteOption[],
  selectedColors: Record<string, string>,
  isSelected: boolean,
  isCompatible: boolean,
): void {
  if (isSelected || !isCompatible) {
    return;
  }
  if (!state.selections[getSelectionGroup(itemId)]) {
    return;
  }

  for (let idx = 0; idx < paletteOptions.length; idx++) {
    const opt = paletteOptions[idx];
    const group =
      idx !== 0 ? (opt.type_name ?? meta.type_name) : meta.type_name;
    const mapped = selectedColors[group];
    const recolor =
      mapped ?? (idx === 0 ? meta.recolors[0]?.variants?.[0] : mapped);
    if (recolor) {
      selectItem(state, itemId, recolor, false, opt.type_name ? idx : null);
    }
  }
}

function openPaletteModal(
  state: State,
  rootViewNode: PaletteModalHost,
  modalIdx: number,
  itemId: string,
  meta: ItemMerged,
  paletteOptions: PaletteOption[],
  selectedColors: Record<string, string>,
  isSelected: boolean,
  isCompatible: boolean,
): void {
  applyRememberedColorsOnSwitch(
    state,
    itemId,
    meta,
    paletteOptions,
    selectedColors,
    isSelected,
    isCompatible,
  );
  rootViewNode.state._palettePreviewLastTotal = undefined;
  rootViewNode.state.showPaletteModal = modalIdx;
  m.redraw();
}

export const ItemWithRecolors: m.Component<
  ItemWithRecolorsAttrs,
  ItemWithRecolorsState
> = {
  view(vnode) {
    const {
      itemId,
      meta,
      isSearchMatch,
      isCompatible,
      tooltipText,
      showItemTooltips = true,
      catalog,
      state,
    } = vnode.attrs;
    const rowTitle = showItemTooltips ? tooltipText : undefined;
    const compactDisplay = state.compactDisplay;
    const displayName = meta.name;
    const rootViewNode = vnode;
    let nodePath = itemId;
    if (displayName === "Body Color") {
      nodePath = "body-body";
    }

    // Check Selection Status
    const selectionGroup = getSelectionGroup(itemId);
    const isExpanded = state.expandedNodes[nodePath] || false;
    const selection = state.selections[selectionGroup];
    const isSelected = selection?.itemId === itemId;

    const paletteReady = catalog.isPaletteReady();

    // Build palette/color options for all recolor fields
    const [paletteOptions, selectedColors] = getPaletteOptions(
      catalog,
      state,
      itemId,
      meta,
    );

    // Check Selection Status
    let paletteModal = null;
    if (
      paletteReady &&
      typeof rootViewNode.state.showPaletteModal === "number"
    ) {
      const idx = rootViewNode.state.showPaletteModal;
      const opt = paletteOptions[idx];
      paletteModal = m(PaletteSelectModal, {
        itemId,
        opt,
        selectedColors,
        compactDisplay,
        rootViewNode,
        catalog,
        state,
        onClose: () => {
          rootViewNode.state.showPaletteModal = null;
          rootViewNode.state._palettePreviewLastTotal = undefined;
          m.redraw();
        },
        onSelect: (recolor) => {
          const subSelectGroup =
            opt.type_name !== meta.type_name ? opt.type_name : null;
          selectItem(
            state,
            itemId,
            recolor,
            isSelected &&
              selectedColors[subSelectGroup ?? meta.type_name] === recolor,
            opt.type_name ? idx : null,
          );
        },
      });
    }

    return m(
      "div",
      {
        class: classNames({
          "search-result": isSearchMatch,
          "has-text-grey": !isCompatible,
        }),
      },
      [
        m(
          "div.tree-label",
          {
            title: rowTitle,
            onclick: () => {
              state.expandedNodes[nodePath] = !isExpanded;
            },
          },
          [
            m("span.tree-arrow", {
              class: isExpanded ? "expanded" : "collapsed",
            }),
            m("span", displayName),
            !isCompatible ? m("span.ml-1", "⚠️") : null,
          ],
        ),
        paletteModal,
        isExpanded && !paletteReady
          ? m("div.ml-4.mt-2", [
              m(
                "div.skeleton-row.skeleton-row--stacked",
                { "aria-busy": "true" },
                [
                  m("span.skeleton-row__bar.skeleton-row__bar--long"),
                  m("span.skeleton-row__bar.skeleton-row__bar--medium"),
                  m(
                    "div",
                    {
                      class: classNames({
                        "variant-item is-flex is-flex-direction-column is-align-items-center is-clickable": true,
                        "has-background-link-light has-text-weight-bold has-text-link":
                          isSelected,
                        "is-not-compatible": !isCompatible,
                      }),
                    },
                    [
                      m("canvas.variant-canvas.box.p-0", {
                        width: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
                        height: compactDisplay
                          ? COMPACT_FRAME_SIZE
                          : FRAME_SIZE,
                        class: compactDisplay ? " compact-display" : "",
                        oncreate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const cs = canvasVnode.state as {
                            renderId?: number;
                            lastColorsKey?: string;
                          };
                          const renderId = (cs.renderId ?? 0) + 1;
                          cs.renderId = renderId;
                          cs.lastColorsKey = JSON.stringify(selectedColors);
                          drawRecolorPreview(
                            catalog,
                            state,
                            itemId,
                            meta,
                            canvas,
                            selectedColors,
                            () => cs.renderId !== renderId,
                          );
                        },
                        onupdate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const cs = canvasVnode.state as {
                            renderId?: number;
                            lastColorsKey?: string;
                          };
                          const key = JSON.stringify(selectedColors);
                          if (cs.lastColorsKey === key) return;
                          cs.lastColorsKey = key;
                          const renderId = (cs.renderId ?? 0) + 1;
                          cs.renderId = renderId;
                          drawRecolorPreview(
                            catalog,
                            state,
                            itemId,
                            meta,
                            canvas,
                            selectedColors,
                            () => cs.renderId !== renderId,
                          );
                        },
                        onremove: (canvasVnode: m.VnodeDOM) => {
                          const cs = canvasVnode.state as {
                            renderId?: number;
                          };
                          cs.renderId = (cs.renderId ?? 0) + 1;
                        },
                      }),
                    ],
                  ),
                  // Small color icons for each recolor category
                  paletteOptions.length
                    ? m(
                        "div.ml-3.is-align-items-center.palette-recolor-list",
                        paletteOptions.map((opt, idx) => {
                          const gradient = (opt.colors ?? []).slice().reverse();
                          return m(
                            "div.is-flex.palette-recolor-item",
                            {
                              onclick: (e: MouseEvent) => {
                                e.stopPropagation();
                                rootViewNode.state._palettePreviewLastTotal =
                                  undefined;
                                rootViewNode.state.showPaletteModal = idx;
                                m.redraw();
                              },
                            },
                            [
                              m("label", opt.label),
                              m(
                                "div.palette-swatch",
                                gradient.map((color) =>
                                  m("span", {
                                    style: {
                                      backgroundColor: color,
                                    },
                                  }),
                                ),
                              ),
                            ],
                          );
                        }),
                      )
                    : null,
                ],
              ),
              m("p.is-size-7.has-text-grey.mt-2", "Loading palette data…"),
            ])
          : isExpanded
            ? m("div", [
                m("div", {
                  class: rootViewNode.state.isLoading ? "loading" : "",
                }),
                m(
                  "div.is-flex.is-align-items-center",
                  {
                    title: rowTitle,
                    onmouseover: (e: MouseEvent) => {
                      if (!isCompatible) return;
                      const div = e.currentTarget as HTMLElement;
                      if (!isSelected)
                        div.classList.add("has-background-white-ter");
                    },
                    onmouseout: (e: MouseEvent) => {
                      if (!isCompatible) return;
                      const div = e.currentTarget as HTMLElement;

                      if (!isSelected)
                        div.classList.remove("has-background-white-ter");
                    },
                    onclick: (e: MouseEvent) => {
                      e.stopPropagation();
                      if (!paletteReady) return;
                      openPaletteModal(
                        state,
                        rootViewNode,
                        0,
                        itemId,
                        meta,
                        paletteOptions,
                        selectedColors,
                        isSelected,
                        isCompatible,
                      );
                    },
                  },
                  [
                    m(
                      "div",
                      {
                        class: classNames({
                          "variant-item is-flex is-flex-direction-column is-align-items-center is-clickable": true,
                          "has-background-link-light has-text-weight-bold has-text-link":
                            isSelected,
                          "is-not-compatible": !isCompatible,
                        }),
                      },
                      [
                        m("canvas.variant-canvas.box.p-0", {
                          width: compactDisplay
                            ? COMPACT_FRAME_SIZE
                            : FRAME_SIZE,
                          height: compactDisplay
                            ? COMPACT_FRAME_SIZE
                            : FRAME_SIZE,
                          class: compactDisplay ? " compact-display" : "",
                          oncreate: async (canvasVnode: m.VnodeDOM) => {
                            const canvas = canvasVnode.dom as HTMLCanvasElement;
                            const imagesLoaded = await drawRecolorPreview(
                              catalog,
                              state,
                              itemId,
                              meta,
                              canvas,
                              selectedColors,
                            );
                            if (imagesLoaded > 0) {
                              rootViewNode.state.imagesLoaded += imagesLoaded;
                              rootViewNode.state.oldSelectedColors =
                                JSON.stringify(selectedColors);
                            }
                          },
                          onupdate: async (canvasVnode: m.VnodeDOM) => {
                            if (
                              rootViewNode.state.oldSelectedColors ===
                              JSON.stringify(selectedColors)
                            ) {
                              return;
                            }
                            const canvas = canvasVnode.dom as HTMLCanvasElement;
                            const imagesLoaded = await drawRecolorPreview(
                              catalog,
                              state,
                              itemId,
                              meta,
                              canvas,
                              selectedColors,
                            );
                            if (imagesLoaded > 0) {
                              rootViewNode.state.oldSelectedColors =
                                JSON.stringify(selectedColors);
                            }
                          },
                        }),
                      ],
                    ),
                    // Small color icons for each recolor category
                    paletteOptions.length
                      ? m(
                          "div.ml-3.is-align-items-center.palette-recolor-list",
                          paletteOptions.map((opt, idx) => {
                            const gradient = (opt.colors ?? [])
                              .slice()
                              .reverse();
                            return m(
                              "div.is-flex.palette-recolor-item",
                              {
                                onclick: (e: MouseEvent) => {
                                  e.stopPropagation();
                                  if (!paletteReady) return;
                                  openPaletteModal(
                                    state,
                                    rootViewNode,
                                    idx,
                                    itemId,
                                    meta,
                                    paletteOptions,
                                    selectedColors,
                                    isSelected,
                                    isCompatible,
                                  );
                                },
                              },
                              [
                                m("label", opt.label),
                                m(
                                  "div.palette-swatch",
                                  gradient.map((color) =>
                                    m("span", {
                                      style: {
                                        backgroundColor: color,
                                      },
                                    }),
                                  ),
                                ),
                              ],
                            );
                          }),
                        )
                      : null,
                  ],
                ),
              ])
            : null,
      ],
    );
  },
};

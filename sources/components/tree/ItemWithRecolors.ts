// Item with recolors component
import m from "mithril";
import classNames from "classnames";
import type {
  ItemWithRecolorsModel,
  RecolorPaletteOptionModel,
} from "../../models/item-with-recolors.ts";
import { PaletteSelectModal } from "./PaletteSelectModal.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../../state/constants.ts";

type ItemWithRecolorsState = {
  showPaletteModal: number | null;
  isLoading?: boolean;
  imagesLoaded: number;
  lastPreviewKey: string;
  _palettePreviewLastTotal?: number;
};

function previewKey(
  selectedColors: Record<string, string>,
  compactDisplay: boolean,
): string {
  return JSON.stringify([compactDisplay, selectedColors]);
}

function openPaletteModal(
  option: RecolorPaletteOptionModel,
  rootViewNode: { state: ItemWithRecolorsState },
  modalIdx: number,
): void {
  option.prepareSelection();
  rootViewNode.state._palettePreviewLastTotal = undefined;
  rootViewNode.state.showPaletteModal = modalIdx;
  m.redraw();
}

export const ItemWithRecolors: m.Component<
  { createModel: () => ItemWithRecolorsModel },
  ItemWithRecolorsState
> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    const {
      isSearchMatch,
      isCompatible,
      compactDisplay,
      paletteOptions,
      selectedColors,
      isSelected,
      paletteReady,
    } = model;
    const rowTitle = model.tooltip;
    const displayName = model.name;
    const rootViewNode = vnode;
    const isExpanded = model.isExpanded;

    // Check Selection Status
    let paletteModal = null;
    if (
      paletteReady &&
      typeof rootViewNode.state.showPaletteModal === "number"
    ) {
      const idx = rootViewNode.state.showPaletteModal;
      const option = paletteOptions[idx];
      paletteModal = m(PaletteSelectModal, {
        createModel: option.createModalModel,
        onClose: () => {
          rootViewNode.state.showPaletteModal = null;
          rootViewNode.state._palettePreviewLastTotal = undefined;
          m.redraw();
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
              model.toggle();
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
                            lastPreviewKey?: string;
                          };
                          const renderId = (cs.renderId ?? 0) + 1;
                          cs.renderId = renderId;
                          cs.lastPreviewKey = previewKey(
                            selectedColors,
                            compactDisplay,
                          );
                          void model.drawPreview(
                            canvas,
                            selectedColors,
                            () => cs.renderId !== renderId,
                          );
                        },
                        onupdate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const cs = canvasVnode.state as {
                            renderId?: number;
                            lastPreviewKey?: string;
                          };
                          const key = previewKey(
                            selectedColors,
                            compactDisplay,
                          );
                          if (cs.lastPreviewKey === key) return;
                          cs.lastPreviewKey = key;
                          const renderId = (cs.renderId ?? 0) + 1;
                          cs.renderId = renderId;
                          void model.drawPreview(
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
                      openPaletteModal(paletteOptions[0], rootViewNode, 0);
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
                            const imagesLoaded =
                              await model.drawPreview(canvas);
                            if (imagesLoaded > 0) {
                              rootViewNode.state.imagesLoaded += imagesLoaded;
                              rootViewNode.state.lastPreviewKey = previewKey(
                                selectedColors,
                                compactDisplay,
                              );
                            }
                          },
                          onupdate: async (canvasVnode: m.VnodeDOM) => {
                            const key = previewKey(
                              selectedColors,
                              compactDisplay,
                            );
                            if (rootViewNode.state.lastPreviewKey === key) {
                              return;
                            }
                            const canvas = canvasVnode.dom as HTMLCanvasElement;
                            const imagesLoaded =
                              await model.drawPreview(canvas);
                            if (imagesLoaded > 0) {
                              rootViewNode.state.lastPreviewKey = key;
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
                                  openPaletteModal(opt, rootViewNode, idx);
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

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
  _palettePreviewLastTotal?: number;
  returnFocusEl?: HTMLElement | null;
  disclosureEl?: HTMLElement | null;
};

type ThumbnailState = { renderId?: number; previewKey?: string };

function previewKey(
  bodyType: string,
  selectedColors: Record<string, string>,
  compactDisplay: boolean,
): string {
  return JSON.stringify([bodyType, compactDisplay, selectedColors]);
}

function openPaletteModal(
  option: RecolorPaletteOptionModel,
  rootViewNode: { state: ItemWithRecolorsState },
  modalIdx: number,
  opener?: HTMLElement | null,
): void {
  option.prepareSelection();
  rootViewNode.state.returnFocusEl = opener ?? null;
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
      bodyType,
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
    const drawThumbnail = (canvasVnode: m.VnodeDOM) => {
      const thumbnail = canvasVnode.state as ThumbnailState;
      const key = previewKey(bodyType, selectedColors, compactDisplay);
      if (thumbnail.previewKey === key) return;
      thumbnail.previewKey = key;
      const renderId = (thumbnail.renderId ?? 0) + 1;
      thumbnail.renderId = renderId;
      void model.drawPreview(
        canvasVnode.dom as HTMLCanvasElement,
        selectedColors,
        () => thumbnail.renderId !== renderId,
      );
    };
    const cancelThumbnail = (canvasVnode: m.VnodeDOM) => {
      const thumbnail = canvasVnode.state as ThumbnailState;
      thumbnail.renderId = (thumbnail.renderId ?? 0) + 1;
    };

    // Check Selection Status
    let paletteModal = null;
    if (
      paletteReady &&
      typeof rootViewNode.state.showPaletteModal === "number"
    ) {
      const idx = rootViewNode.state.showPaletteModal;
      const targetOption = paletteOptions[idx];
      if (targetOption) {
        paletteModal = m(PaletteSelectModal, {
          createModel: targetOption.createModalModel,
          returnFocusTo: rootViewNode.state.returnFocusEl ?? null,
          fallbackFocusTo: rootViewNode.state.disclosureEl ?? null,
          onClose: () => {
            rootViewNode.state.showPaletteModal = null;
            rootViewNode.state._palettePreviewLastTotal = undefined;
            m.redraw();
          },
        });
      }
    }

    return m(
      "div.lpc-tree-item-row",
      {
        class: classNames({
          "search-result": isSearchMatch,
          "has-text-grey": !isCompatible,
        }),
      },
      [
        m(
          "button.tree-label.lpc-tree-disclosure",
          {
            type: "button",
            "aria-expanded": String(isExpanded),
            title: rowTitle,
            oncreate: (btnVnode: m.VnodeDOM) => {
              rootViewNode.state.disclosureEl = btnVnode.dom as HTMLElement;
            },
            onupdate: (btnVnode: m.VnodeDOM) => {
              rootViewNode.state.disclosureEl = btnVnode.dom as HTMLElement;
            },
            onclick: model.toggle,
          },
          [
            m("span.tree-arrow", {
              class: isExpanded ? "expanded" : "collapsed",
              "aria-hidden": "true",
            }),
            m("span", displayName),
            !isCompatible
              ? m("span.ml-1", { "aria-hidden": "true" }, "⚠️")
              : null,
          ],
        ),
        paletteModal,
        isExpanded && !paletteReady
          ? m("div.lpc-recolor-loading", [
              m(
                "div.skeleton-row.skeleton-row--stacked",
                { "aria-busy": "true" },
                [
                  m("span.skeleton-row__bar.skeleton-row__bar--long"),
                  m("span.skeleton-row__bar.skeleton-row__bar--medium"),
                  m("div.lpc-recolor-row", [
                    m(
                      "div",
                      {
                        class: classNames({
                          "variant-item lpc-recolor-thumb-btn is-clickable": true,
                          "has-background-link-light lpc-tile-selected":
                            isSelected,
                          "is-not-compatible": !isCompatible,
                        }),
                      },
                      [
                        m("canvas.variant-canvas", {
                          key: bodyType,
                          width: compactDisplay
                            ? COMPACT_FRAME_SIZE
                            : FRAME_SIZE,
                          height: compactDisplay
                            ? COMPACT_FRAME_SIZE
                            : FRAME_SIZE,
                          "aria-hidden": "true",
                          class: compactDisplay ? "compact-display" : "",
                          oncreate: drawThumbnail,
                          onupdate: drawThumbnail,
                          onremove: cancelThumbnail,
                        }),
                      ],
                    ),
                    paletteOptions.length
                      ? m(
                          "div.palette-recolor-list",
                          paletteOptions.map((opt, idx) => {
                            const gradient = (opt.colors ?? [])
                              .slice()
                              .reverse();
                            return m(
                              "button.palette-recolor-item.lpc-swatch-btn",
                              {
                                key: `${opt.label ?? idx}-${idx}`,
                                type: "button",
                                "aria-disabled": !isCompatible
                                  ? "true"
                                  : undefined,
                                class: classNames({
                                  "is-not-compatible": !isCompatible,
                                }),
                                onclick: (e: MouseEvent) => {
                                  e.stopPropagation();
                                  if (!isCompatible) return;
                                  rootViewNode.state.returnFocusEl =
                                    e.currentTarget as HTMLElement;
                                  rootViewNode.state._palettePreviewLastTotal =
                                    undefined;
                                  rootViewNode.state.showPaletteModal = idx;
                                  m.redraw();
                                },
                              },
                              [
                                m("span.lpc-swatch-label", opt.label),
                                m(
                                  "span.palette-swatch",
                                  { "aria-hidden": "true" },
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
                  ]),
                ],
              ),
              m("p.lpc-helper-text.mt-2", "Loading palette data…"),
            ])
          : isExpanded
            ? m("div", [
                m("div", {
                  class: rootViewNode.state.isLoading ? "loading" : "",
                }),
                m("div.lpc-recolor-row", { title: rowTitle }, [
                  m(
                    "button.variant-item.lpc-recolor-thumb-btn",
                    {
                      type: "button",
                      "aria-label": `Choose color for ${displayName}`,
                      "aria-pressed": String(isSelected),
                      "aria-disabled": !isCompatible ? "true" : undefined,
                      class: classNames({
                        "is-clickable": isCompatible,
                        "has-background-link-light lpc-tile-selected":
                          isSelected,
                        "is-not-compatible": !isCompatible,
                      }),
                      onclick: (e: MouseEvent) => {
                        e.stopPropagation();
                        if (
                          !isCompatible ||
                          !paletteReady ||
                          !paletteOptions.length
                        )
                          return;
                        openPaletteModal(
                          paletteOptions[0],
                          rootViewNode,
                          0,
                          e.currentTarget as HTMLElement,
                        );
                      },
                    },
                    [
                      m("canvas.variant-canvas", {
                        key: bodyType,
                        width: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
                        height: compactDisplay
                          ? COMPACT_FRAME_SIZE
                          : FRAME_SIZE,
                        "aria-hidden": "true",
                        class: compactDisplay ? "compact-display" : "",
                        oncreate: drawThumbnail,
                        onupdate: drawThumbnail,
                        onremove: cancelThumbnail,
                      }),
                    ],
                  ),
                  paletteOptions.length
                    ? m(
                        "div.palette-recolor-list",
                        paletteOptions.map((opt, idx) => {
                          const gradient = (opt.colors ?? []).slice().reverse();
                          return m(
                            "button.palette-recolor-item.lpc-swatch-btn",
                            {
                              key: `${opt.label ?? idx}-${idx}`,
                              type: "button",
                              "aria-disabled": !isCompatible
                                ? "true"
                                : undefined,
                              class: classNames({
                                "is-not-compatible": !isCompatible,
                              }),
                              onclick: (e: MouseEvent) => {
                                e.stopPropagation();
                                if (!isCompatible || !paletteReady) return;
                                openPaletteModal(
                                  opt,
                                  rootViewNode,
                                  idx,
                                  e.currentTarget as HTMLElement,
                                );
                              },
                            },
                            [
                              m("span.lpc-swatch-label", opt.label),
                              m(
                                "span.palette-swatch",
                                { "aria-hidden": "true" },
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
                ]),
              ])
            : null,
      ],
    );
  },
};

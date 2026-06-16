// Item with variants component
import m from "mithril";
import classNames from "classnames";
import { state, getSelectionGroup, selectItem } from "../../state/state.ts";
import { getLayersToLoad } from "../../state/meta.ts";
import type { LayerToLoad } from "../../state/meta.ts";
import { COMPACT_FRAME_SIZE, FRAME_SIZE } from "../../state/constants.ts";
import type { ItemMerged } from "../../state/catalog.ts";
import {
  getItemDisplayName,
  getVariantDisplayName,
} from "../../../lang/i18n.ts";

export type ItemWithVariantsAttrs = {
  itemId: string;
  meta: ItemMerged;
  isSearchMatch: boolean;
  isCompatible: boolean;
  tooltipText: string;
  showItemTooltips?: boolean;
};

type ItemWithVariantsState = {
  isLoading: boolean;
  imagesToLoad: number;
  imagesLoaded: number;
};

type CanvasState = {
  loadedLayers?: Array<{ img: HTMLImageElement | null; layer: LayerToLoad }>;
};

export const ItemWithVariants: m.Component<
  ItemWithVariantsAttrs,
  ItemWithVariantsState
> = {
  view(vnode) {
    const {
      itemId,
      meta,
      isSearchMatch,
      isCompatible,
      tooltipText,
      showItemTooltips = true,
    } = vnode.attrs;
    const rowTitle = showItemTooltips ? tooltipText : undefined;
    const compactDisplay = state.compactDisplay;
    const displayName = getItemDisplayName(meta.name);
    const rootViewNode = vnode;
    let nodePath = itemId;
    if (itemId === "body" || meta.name === "Body Color") {
      nodePath = "body-body";
    }
    const isExpanded = state.expandedNodes[nodePath] || false;
    const layers = getLayersToLoad(meta, state.bodyType, state.selections);

    return m(
      "div",
      {
        class: classNames({
          "search-result": isSearchMatch,
          "has-text-grey": !isCompatible,
        }),
        oninit: () => {
          rootViewNode.state.isLoading = meta.variants.length > 0;
          rootViewNode.state.imagesToLoad =
            meta.variants.length * layers.length;
          rootViewNode.state.imagesLoaded = 0;
        },
        onupdate: () => {
          if (isExpanded && rootViewNode.state.isLoading) {
            if (
              rootViewNode.state.imagesLoaded >= rootViewNode.state.imagesToLoad
            ) {
              rootViewNode.state.isLoading = false;
            }
          }
        },
      },
      [
        m(
          "div.tree-label",
          {
            title: rowTitle,
            onclick: () => {
              state.expandedNodes[nodePath] = !isExpanded;
              if (state.expandedNodes[nodePath]) {
                rootViewNode.state.isLoading = meta.variants.length > 0;
                rootViewNode.state.imagesToLoad =
                  meta.variants.length * layers.length;
                rootViewNode.state.imagesLoaded = 0;
              }
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
        isExpanded
          ? m("div", [
              m("div", {
                class: rootViewNode.state.isLoading ? "loading" : "",
              }),
              m(
                "div.variants-container.ml-5.is-flex.is-flex-wrap-wrap",
                meta.variants.map((variant) => {
                  const selectionGroup = getSelectionGroup(itemId);
                  const isSelected =
                    state.selections[selectionGroup]?.itemId === itemId &&
                    state.selections[selectionGroup]?.variant === variant;
                  const variantDisplayName = getVariantDisplayName(variant);

                  // Get preview metadata from item metadata
                  const previewRow = meta.preview_row ?? 2;
                  const previewCol =
                    (meta as { preview_column?: number }).preview_column ?? 0;
                  const previewXOffset =
                    (meta as { preview_x_offset?: number }).preview_x_offset ??
                    0;
                  const previewYOffset =
                    (meta as { preview_y_offset?: number }).preview_y_offset ??
                    0;

                  return m(
                    "div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable",
                    {
                      key: variant,
                      class: classNames({
                        "has-background-link-light has-text-weight-bold has-text-link":
                          isSelected,
                        "is-not-compatible": !isCompatible,
                      }),
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
                      onclick: () => {
                        if (!isCompatible) return; // Prevent selecting incompatible
                        selectItem(itemId, variant, isSelected);
                      },
                    },
                    [
                      m(
                        "span.variant-display-name.has-text-centered.is-size-7",
                        variantDisplayName,
                      ),
                      m("canvas.variant-canvas.box.p-0", {
                        width: compactDisplay ? COMPACT_FRAME_SIZE : FRAME_SIZE,
                        height: compactDisplay
                          ? COMPACT_FRAME_SIZE
                          : FRAME_SIZE,
                        class: compactDisplay ? " compact-display" : "",
                        style: isSelected
                          ? " hsl(217, 71%, 53%)"
                          : " hsl(0, 0%, 86%)",
                        oncreate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const cs = canvasVnode.state as CanvasState;
                          const ctx = canvas.getContext("2d", {
                            willReadFrequently: true,
                          });
                          if (!ctx) return;

                          // Get Layers to Load for Variant
                          const layersToLoad = getLayersToLoad(
                            meta,
                            state.bodyType,
                            state.selections,
                            variant,
                          );

                          // Load and draw all layers
                          Promise.all(
                            layersToLoad.map((layer) => {
                              return new Promise<{
                                img: HTMLImageElement | null;
                                layer: LayerToLoad;
                              }>((resolve) => {
                                const img = new Image();
                                img.onload = () => resolve({ img, layer });
                                img.onerror = () =>
                                  resolve({ img: null, layer });
                                img.src = layer.path;
                              });
                            }),
                          ).then((loadedLayers) => {
                            cs.loadedLayers = loadedLayers;
                            // Draw each layer in zPos order
                            for (const { img } of loadedLayers) {
                              if (img) {
                                const size = compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE;
                                const srcX =
                                  previewCol * FRAME_SIZE + previewXOffset;
                                const srcY =
                                  previewRow * FRAME_SIZE + previewYOffset;
                                ctx.drawImage(
                                  img,
                                  srcX,
                                  srcY,
                                  FRAME_SIZE,
                                  FRAME_SIZE,
                                  0,
                                  0,
                                  size,
                                  size,
                                );
                              }
                            }
                            rootViewNode.state.imagesLoaded +=
                              loadedLayers.length;
                            m.redraw();
                          });
                        },
                        onupdate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const cs = canvasVnode.state as CanvasState;
                          const ctx = canvas.getContext("2d", {
                            willReadFrequently: true,
                          });
                          if (!ctx) return;

                          // Process Layers Loaded for Variant
                          if (cs.loadedLayers) {
                            for (const { img } of cs.loadedLayers) {
                              if (img) {
                                const size = compactDisplay
                                  ? COMPACT_FRAME_SIZE
                                  : FRAME_SIZE;
                                const srcX =
                                  previewCol * FRAME_SIZE + previewXOffset;
                                const srcY =
                                  previewRow * FRAME_SIZE + previewYOffset;
                                ctx.drawImage(
                                  img,
                                  srcX,
                                  srcY,
                                  FRAME_SIZE,
                                  FRAME_SIZE,
                                  0,
                                  0,
                                  size,
                                  size,
                                );
                              }
                            }
                          }
                        },
                      }),
                    ],
                  );
                }),
              ),
            ])
          : null,
      ],
    );
  },
};

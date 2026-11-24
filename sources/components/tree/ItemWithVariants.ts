import m from "mithril";
import classNames from "classnames";
import type { ItemWithVariantsModel } from "../../models/item-with-variants.ts";

type VariantLoadState = { settledPreviews: Set<string> };

export const ItemWithVariants: m.Component<
  { createModel: () => ItemWithVariantsModel },
  VariantLoadState
> = {
  oninit(vnode) {
    vnode.state.settledPreviews = new Set();
  },
  view(vnode) {
    const model = vnode.attrs.createModel();
    const { settledPreviews } = vnode.state;
    const isLoading = model.variants.some(
      (variant) => !settledPreviews.has(variant.key),
    );
    return m(
      "div.lpc-tree-item-row",
      {
        class: classNames({
          "search-result": model.isSearchMatch,
          "has-text-grey": !model.isCompatible,
        }),
      },
      [
        m(
          "button.tree-label.lpc-tree-disclosure",
          {
            type: "button",
            "aria-expanded": String(model.isExpanded),
            title: model.tooltip,
            onclick: model.toggle,
          },
          [
            m("span.tree-arrow", {
              class: model.isExpanded ? "expanded" : "collapsed",
              "aria-hidden": "true",
            }),
            m("span", model.name),
            !model.isCompatible
              ? m("span.ml-1", { "aria-hidden": "true" }, "⚠️")
              : null,
          ],
        ),
        model.isExpanded
          ? m("div", [
              m("div", {
                class: isLoading ? "loading" : "",
              }),
              m(
                "div.variants-container",
                model.variants.map((variant) =>
                  m(
                    "button.variant-item.lpc-variant-tile",
                    {
                      key: variant.key,
                      type: "button",
                      "aria-pressed": String(variant.isSelected),
                      "aria-disabled": !variant.isCompatible
                        ? "true"
                        : undefined,
                      class: classNames({
                        "is-clickable": variant.isCompatible,
                        "has-background-link-light lpc-tile-selected":
                          variant.isSelected,
                        "is-not-compatible": !variant.isCompatible,
                      }),
                      title: model.tooltip,
                      onclick: variant.select,
                    },
                    [
                      m(
                        "span.variant-display-name",
                        { key: "label" },
                        variant.label,
                      ),
                      m("canvas.variant-canvas", {
                        key: `canvas-${model.bodyType ?? ""}`,
                        width: variant.size,
                        height: variant.size,
                        "aria-hidden": "true",
                        class: variant.compactDisplay ? "compact-display" : "",
                        oncreate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          const canvasState = canvasVnode.state as {
                            redraw?: (size: number) => void;
                            lastSize?: number;
                          };
                          canvasState.lastSize = variant.size;
                          const settle = () => {
                            if (!canvas.isConnected) return;
                            settledPreviews.add(variant.key);
                            m.redraw();
                          };
                          void variant.loadPreview(canvas).then((redraw) => {
                            canvasState.redraw = redraw;
                            settle();
                          }, settle);
                        },
                        onupdate: (canvasVnode: m.VnodeDOM) => {
                          const canvasState = canvasVnode.state as {
                            redraw?: (size: number) => void;
                            lastSize?: number;
                          };
                          if (canvasState.lastSize === variant.size) return;
                          canvasState.lastSize = variant.size;
                          canvasState.redraw?.(variant.size);
                        },
                        onremove: () => {
                          settledPreviews.delete(variant.key);
                        },
                      }),
                    ],
                  ),
                ),
              ),
            ])
          : null,
      ],
    );
  },
};

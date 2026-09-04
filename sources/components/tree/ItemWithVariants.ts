import m from "mithril";
import classNames from "classnames";
import type { ItemWithVariantsModel } from "../../models/item-with-variants.ts";

export const ItemWithVariants: m.Component<
  { createModel: () => ItemWithVariantsModel },
  { isLoading: boolean; imagesToLoad: number; imagesLoaded: number }
> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return m(
      "div",
      {
        class: classNames({
          "search-result": model.isSearchMatch,
          "has-text-grey": !model.isCompatible,
        }),
        oninit: () => {
          vnode.state.isLoading = model.variants.length > 0;
          vnode.state.imagesToLoad = model.imagesToLoad;
          vnode.state.imagesLoaded = 0;
        },
        onupdate: () => {
          if (
            model.isExpanded &&
            vnode.state.isLoading &&
            vnode.state.imagesLoaded >= vnode.state.imagesToLoad
          ) {
            vnode.state.isLoading = false;
          }
        },
      },
      [
        m(
          "div.tree-label",
          {
            title: model.tooltip,
            onclick: () => {
              const imagesToLoad = model.toggle();
              if (!model.isExpanded) {
                vnode.state.isLoading = true;
                vnode.state.imagesToLoad = imagesToLoad;
                vnode.state.imagesLoaded = 0;
              }
            },
          },
          [
            m("span.tree-arrow", {
              class: model.isExpanded ? "expanded" : "collapsed",
            }),
            m("span", model.name),
            !model.isCompatible ? m("span.ml-1", "⚠️") : null,
          ],
        ),
        model.isExpanded
          ? m("div", [
              m("div", {
                class: vnode.state.isLoading ? "loading" : "",
              }),
              m(
                "div.variants-container.ml-5.is-flex.is-flex-wrap-wrap",
                model.variants.map((variant) =>
                  m(
                    "div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable",
                    {
                      key: variant.key,
                      class: classNames({
                        "has-background-link-light has-text-weight-bold has-text-link":
                          variant.isSelected,
                        "is-not-compatible": !variant.isCompatible,
                      }),
                      title: model.tooltip,
                      onmouseover: (event: MouseEvent) => {
                        if (!variant.isCompatible || variant.isSelected) return;
                        (event.currentTarget as HTMLElement).classList.add(
                          "has-background-white-ter",
                        );
                      },
                      onmouseout: (event: MouseEvent) => {
                        if (!variant.isCompatible || variant.isSelected) return;
                        (event.currentTarget as HTMLElement).classList.remove(
                          "has-background-white-ter",
                        );
                      },
                      onclick: variant.select,
                    },
                    [
                      m(
                        "span.variant-display-name.has-text-centered.is-size-7",
                        variant.label,
                      ),
                      m("canvas.variant-canvas.box.p-0", {
                        width: variant.size,
                        height: variant.size,
                        class: variant.compactDisplay ? " compact-display" : "",
                        style: variant.isSelected
                          ? " hsl(217, 71%, 53%)"
                          : " hsl(0, 0%, 86%)",
                        oncreate: (canvasVnode: m.VnodeDOM) => {
                          const canvas = canvasVnode.dom as HTMLCanvasElement;
                          void variant.loadPreview(canvas).then((preview) => {
                            (
                              canvasVnode.state as {
                                redraw?: (size: number) => void;
                              }
                            ).redraw = preview.redraw;
                            vnode.state.imagesLoaded += preview.imagesLoaded;
                            m.redraw();
                          });
                        },
                        onupdate: (canvasVnode: m.VnodeDOM) => {
                          (
                            canvasVnode.state as {
                              redraw?: (size: number) => void;
                            }
                          ).redraw?.(variant.size);
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

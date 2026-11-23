// Animation Filters component
import m from "mithril";
import type { AnimationFiltersModel } from "../../models/animation-filters.ts";

type AnimationFiltersState = { isExpanded: boolean };

const ANIMATION_FILTERS_BODY_ID = "lpc-animation-filters-body";

export const AnimationFilters: m.Component<
  { createModel: () => AnimationFiltersModel },
  AnimationFiltersState
> = {
  oninit(vnode) {
    vnode.state.isExpanded = false;
  },
  view(vnode) {
    const model = vnode.attrs.createModel();

    const removeIncompatibleItems = () => {
      const removedCount = model.removeIncompatible();
      if (removedCount > 0) {
        alert(`Removed ${removedCount} incompatible item(s)`);
      } else {
        alert("No incompatible items found");
      }
    };

    const hasIncompatibleItems = model.incompatibleCount > 0;

    return m("div.box.lpc-filter-card", [
      m(
        "button.tree-label.lpc-filter-disclosure",
        {
          type: "button",
          "aria-expanded": String(vnode.state.isExpanded),
          "aria-controls": ANIMATION_FILTERS_BODY_ID,
          onclick: () => {
            vnode.state.isExpanded = !vnode.state.isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: vnode.state.isExpanded ? "expanded" : "collapsed",
            "aria-hidden": "true",
          }),
          m("span.lpc-filter-title", "Animation Filters"),
          m("span.lpc-filter-summary", model.summary),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.lpc-filter-body", { id: ANIMATION_FILTERS_BODY_ID }, [
            model.loadError
              ? m(
                  "p.lpc-helper-text.is-danger",
                  { role: "alert" },
                  model.loadError,
                )
              : !model.liteReady
                ? m("p.lpc-helper-text", "Loading item list…")
                : null,
            m(
              "ul.tree-list.lpc-filter-list",
              model.options.map((anim) =>
                m("li", { key: anim.value }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: anim.enabled,
                      disabled: !model.liteReady || Boolean(model.loadError),
                      onchange: (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        anim.setEnabled(target.checked);
                      },
                    }),
                    m("span", anim.label),
                  ]),
                ]),
              ),
            ),
            hasIncompatibleItems
              ? [
                  m("div.lpc-warning-box", [
                    m("p", [
                      m(
                        "strong",
                        `${model.incompatibleCount} selected item${model.incompatibleCount > 1 ? "s are" : " is"} incompatible`,
                      ),
                      " with your current animation selection. ",
                      m("span", "(marked with ⚠️ below)"),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.lpc-btn-warning.mt-2",
                    {
                      type: "button",
                      onclick: removeIncompatibleItems,
                      title: `Remove ${model.incompatibleCount} incompatible item${model.incompatibleCount > 1 ? "s" : ""}`,
                    },
                    `Remove ${model.incompatibleCount} Incompatible Asset${model.incompatibleCount > 1 ? "s" : ""}`,
                  ),
                ]
              : null,
          ])
        : null,
    ]);
  },
};

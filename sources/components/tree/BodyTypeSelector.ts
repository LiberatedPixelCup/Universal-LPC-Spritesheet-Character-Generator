// Body type selector component (styled as tree category)
import m from "mithril";
import type { BodyTypeSelectorModel } from "../../models/category-tree.ts";

type BodyTypeSelectorState = { isExpanded: boolean };

export const BodyTypeSelector: m.Component<
  { model: BodyTypeSelectorModel },
  BodyTypeSelectorState
> = {
  oninit(vnode) {
    vnode.state.isExpanded = true; // Start expanded by default
  },
  view(vnode) {
    const { model } = vnode.attrs;
    return m("div.mb-3", [
      m(
        "div.tree-label",
        {
          onclick: () => {
            vnode.state.isExpanded = !vnode.state.isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: vnode.state.isExpanded ? "expanded" : "collapsed",
          }),
          m("span.has-text-weight-semibold", "Body Type"),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.ml-4.mt-2", [
            m(
              "div.buttons.ml-4",
              model.options.map((option) =>
                m(
                  "button.button.is-small",
                  {
                    class: model.selected === option.value ? "is-primary" : "",
                    onclick: () => {
                      model.select(option.value);
                    },
                  },
                  option.label,
                ),
              ),
            ),
          ])
        : null,
    ]);
  },
};

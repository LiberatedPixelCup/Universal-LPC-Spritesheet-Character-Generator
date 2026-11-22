// Body type selector component (styled as tree category)
import m from "mithril";
import type { BodyTypeSelectorModel } from "../../models/category-tree.ts";

type BodyTypeSelectorState = { isExpanded: boolean };

const BODY_TYPE_GROUP_ID = "lpc-body-type-options";

export const BodyTypeSelector: m.Component<
  { model: BodyTypeSelectorModel },
  BodyTypeSelectorState
> = {
  oninit(vnode) {
    vnode.state.isExpanded = true; // Start expanded by default
  },
  view(vnode) {
    const { model } = vnode.attrs;
    return m("div.lpc-body-type-block", [
      m(
        "button.tree-label.lpc-tree-disclosure",
        {
          type: "button",
          "aria-expanded": String(vnode.state.isExpanded),
          "aria-controls": BODY_TYPE_GROUP_ID,
          onclick: () => {
            vnode.state.isExpanded = !vnode.state.isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: vnode.state.isExpanded ? "expanded" : "collapsed",
            "aria-hidden": "true",
          }),
          m("span.has-text-weight-semibold", "Body Type"),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.lpc-body-type-group", { id: BODY_TYPE_GROUP_ID }, [
            m(
              "div.buttons.lpc-body-type-buttons",
              model.options.map((option) => {
                const isSelected = model.selected === option.value;
                return m(
                  "button.button.is-small",
                  {
                    key: option.value,
                    type: "button",
                    "aria-pressed": String(isSelected),
                    class: isSelected ? "is-primary lpc-body-btn-selected" : "",
                    onclick: () => {
                      model.select(option.value);
                    },
                  },
                  option.label,
                );
              }),
            ),
          ])
        : null,
    ]);
  },
};

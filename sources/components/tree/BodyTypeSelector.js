// Body type selector component (styled as tree category)
import m from "mithril";
import { state } from "../../state/state.ts";
import { BODY_TYPES } from "../../state/constants.ts";
import { t } from "../../i18n/index.ts";

export const BodyTypeSelector = {
  oninit: function (vnode) {
    vnode.state.isExpanded = true; // Start expanded by default
  },
  view: function (vnode) {
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
          m("span.has-text-weight-semibold", t("tree.bodyType")),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.ml-4.mt-2", [
            m(
              "div.buttons.ml-4",
              BODY_TYPES.map((type) =>
                m(
                  "button.button.is-small",
                  {
                    class: state.bodyType === type ? "is-primary" : "",
                    onclick: () => {
                      state.bodyType = type;
                    },
                  },
                  t(`bodyType.${type}`),
                ),
              ),
            ),
          ])
        : null,
    ]);
  },
};

import m from "mithril";
import type { CategoryTreeModel } from "../../models/category-tree.ts";
import { BodyTypeSelector } from "./BodyTypeSelector.ts";
import { TreeNode } from "./TreeNode.ts";

function renderLoadingHost() {
  return m("div.box.category-tree-panel", [
    m("div.category-tree-loading-host", [
      m(
        "div.category-tree-loading-overlay",
        { "aria-busy": "true", "aria-live": "polite" },
        m("span.loading", { "aria-label": "Loading category index" }),
      ),
      m("h3.title.is-5.lpc-subpanel-title", "Available Items"),
      m("p.lpc-helper-text", "Loading category index…"),
    ]),
  ]);
}

export const CategoryTree: m.Component<{
  createModel: () => CategoryTreeModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    if (model.isLoading) return renderLoadingHost();

    return m("div.box.category-tree-panel", [
      m("div.lpc-tree-header", [
        m("h3.title.is-5.lpc-subpanel-title.mb-0", "Available Items"),
        m("div.lpc-tree-toolbar", [
          m("div.buttons.mb-0.lpc-tree-actions", [
            m(
              "button.button.is-small",
              { type: "button", onclick: model.collapseAll },
              "Collapse All",
            ),
            m(
              "button.button.is-small",
              {
                type: "button",
                disabled: !model.liteReady,
                title: model.liteReady ? undefined : "Loading item list…",
                onclick: model.expandSelected,
              },
              "Expand Selected",
            ),
            m(
              "button.button.is-small",
              {
                type: "button",
                "aria-pressed": String(model.compactDisplay),
                class: model.compactDisplay ? "is-link lpc-btn-active" : "",
                onclick: model.toggleCompactDisplay,
              },
              "Compact Display",
            ),
          ]),
          m("div.buttons.mb-0.lpc-tree-reset", [
            m(
              "button.button.is-danger.is-small.lpc-btn-danger",
              { type: "button", onclick: model.reset },
              "Reset all",
            ),
          ]),
        ]),
      ]),
      m("div.lpc-match-body-color", [
        m(
          "label.checkbox",
          {
            title:
              "When enabled, changing body color will automatically update all compatible items (heads, ears, noses, etc.) to the same color variant",
          },
          [
            m("input[type=checkbox]", {
              id: "match-body-color-checkbox",
              "aria-describedby": "match-body-color-label",
              checked: model.matchBodyColorEnabled,
              onchange: (event: Event) => {
                model.setMatchBodyColor(
                  (event.target as HTMLInputElement).checked,
                );
              },
            }),
            m("span", "Match body color"),
          ],
        ),
        m(
          "p.lpc-match-body-help",
          { id: "match-body-color-label" },
          "Auto-update heads, ears, and other items when body color changes",
        ),
      ]),
      m("div.lpc-tree-root", [
        m(BodyTypeSelector, { model: model.bodyTypes }),
        model.roots.map((root) =>
          m(TreeNode, {
            key: root.key,
            createModel: root.createModel,
          }),
        ),
      ]),
    ]);
  },
};

import m from "mithril";
import classNames from "classnames";
import type {
  TreeItemModel,
  TreeNodeModel,
} from "../../models/category-tree.ts";
import { ItemWithVariants } from "./ItemWithVariants.ts";
import { ItemWithRecolors } from "./ItemWithRecolors.ts";

function renderItem(item: TreeItemModel) {
  if (item.kind === "skeleton") {
    return m(
      "div.skeleton-row",
      { key: `sk-${item.key}`, "aria-hidden": "true" },
      m("span.skeleton-row__bar.skeleton-row__bar--long"),
    );
  }
  if (item.kind === "recolors") {
    return m(ItemWithRecolors, {
      key: item.key,
      createModel: item.createModel,
    });
  }
  if (item.kind === "variants") {
    return m(ItemWithVariants, {
      key: item.key,
      createModel: item.createModel,
    });
  }
  return m(
    "button.tree-node.lpc-tree-item-btn",
    {
      key: item.key,
      type: "button",
      "aria-pressed": String(item.isSelected),
      class: classNames({
        "search-result": item.isSearchMatch,
        "has-text-grey": !item.isCompatible,
        "lpc-tree-item-selected": item.isSelected,
      }),
      title: item.tooltip,
      onclick: item.select,
    },
    [
      m("span", item.name),
      !item.isCompatible
        ? m("span.ml-1", { "aria-hidden": "true" }, "⚠️")
        : null,
      item.isSelected
        ? m("span.lpc-selected-indicator", { "aria-hidden": "true" }, "✓")
        : null,
    ],
  );
}

export const TreeNode: m.Component<{
  createModel: () => TreeNodeModel | null;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    if (!model) return null;

    return m(
      "div.lpc-tree-branch",
      m(
        "button.tree-label.lpc-tree-disclosure",
        {
          type: "button",
          "aria-expanded": String(model.isExpanded),
          class: classNames({ "has-text-grey": !model.isCompatible }),
          title: model.title,
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
        ? m("div.lpc-tree-children", [
            model.children.map((child) =>
              m(TreeNode, {
                key: child.key,
                createModel: child.createModel,
              }),
            ),
            model.items.map((item) => renderItem(item)),
          ])
        : null,
    );
  },
};

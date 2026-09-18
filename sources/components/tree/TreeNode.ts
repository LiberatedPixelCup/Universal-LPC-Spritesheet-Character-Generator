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
    "div.tree-node",
    {
      key: item.key,
      class: classNames({
        "search-result": item.isSearchMatch,
        "has-text-grey": !item.isCompatible,
      }),
      style: item.isSelected ? " font-weight: bold; color: #3273dc;" : "",
      title: item.tooltip,
      onclick: item.select,
    },
    [item.name, !item.isCompatible ? m("span.ml-1", "⚠️") : null],
  );
}

export const TreeNode: m.Component<{
  createModel: () => TreeNodeModel | null;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    if (!model) return null;

    return m(
      "div",
      m(
        "div.tree-label",
        {
          class: classNames({ "has-text-grey": !model.isCompatible }),
          title: model.title,
          onclick: model.toggle,
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
        ? m("div.ml-4", [
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

// Main tree component
import m from "mithril";
import {
  state,
  resetAll,
  getSelectionGroup,
  applyMatchBodyColor,
} from "../../state/state.ts";
import type {
  CatalogReader,
  CategoryTree as CategoryTreeShape,
} from "../../state/catalog.ts";
import { renderResult } from "../../utils/render-result.ts";
import { BodyTypeSelector } from "./BodyTypeSelector.ts";
import { TreeNode } from "./TreeNode.ts";
import { t } from "../../../lang/i18n.ts";

// Forwarder: passes catalog down to TreeNode subtree. Declared as the full
// reader (rather than a narrow Pick) because the transitive union of what its
// descendants need covers most of CatalogReader anyway, and enumerating it
// would make adding a downstream method an N-place edit. Leaves narrow.
type CategoryTreeAttrs = { catalog: CatalogReader };

function renderLoadingHost() {
  return m("div.box.has-background-light.category-tree-panel", [
    m("div.category-tree-loading-host", [
      m(
        "div.category-tree-loading-overlay",
        { "aria-busy": "true", "aria-live": "polite" },
        m("span.loading", { "aria-label": t("categoryTree.loadingIndex") }),
      ),
      m("h3.title.is-5.mb-3", t("categoryTree.title")),
      m("p.has-text-grey.is-size-7", t("categoryTree.loadingIndex")),
    ]),
  ]);
}

function renderTree(categoryTree: CategoryTreeShape, catalog: CatalogReader) {
  const liteReady = catalog.isLiteReady();

  return m("div.box.has-background-light.category-tree-panel", [
    m(
      "div.is-flex.is-justify-content-space-between.is-align-items-center.mb-3",
      [
        m("h3.title.is-5.mb-0", t("categoryTree.title")),
        m("div.buttons.mb-0", [
          m(
            "button.button.is-danger.is-small",
            { onclick: resetAll },
            t("categoryTree.resetAll"),
          ),
          m(
            "button.button.is-small",
            {
              onclick: () => {
                state.expandedNodes = {};
              },
            },
            t("categoryTree.collapseAll"),
          ),
          m(
            "button.button.is-small",
            {
              disabled: !liteReady,
              title: liteReady ? undefined : t("categoryTree.loadingItemList"),
              onclick: () => {
                if (!liteReady) return;
                for (const [, selection] of Object.entries(state.selections)) {
                  const { itemId } = selection;
                  catalog.getItemMerged(itemId).match(
                    (meta) => {
                      let pathSoFar = "";
                      // Expand all path segments (categories)
                      for (const segment of meta.path) {
                        pathSoFar = pathSoFar
                          ? `${pathSoFar}-${segment}`
                          : segment;
                        state.expandedNodes[pathSoFar] = true;
                      }
                      // Also expand the item itself (to show variants)
                      state.expandedNodes[itemId] = true;
                    },
                    () => {
                      // Selection points at an unknown id (stale URL or
                      // mid-load). Skip — nothing to expand.
                    },
                  );
                }
              },
            },
            t("categoryTree.expandSelected"),
          ),
          m(
            "button.button.is-small",
            {
              class: state.compactDisplay ? "is-link" : "",
              onclick: () => {
                state.compactDisplay = !state.compactDisplay;
              },
            },
            t("categoryTree.compactDisplay"),
          ),
        ]),
      ],
    ),
    m("div.mb-3", [
      m(
        "label.checkbox",
        {
          title: t("categoryTree.matchBodyColorTooltip"),
        },
        [
          m("input[type=checkbox]", {
            id: "match-body-color-checkbox",
            "aria-describedby": "match-body-color-label",
            checked: state.matchBodyColorEnabled,
            onchange: (e: Event) => {
              const target = e.target as HTMLInputElement;
              state.matchBodyColorEnabled = target.checked;
              // If enabling the checkbox, immediately apply match body color
              if (target.checked) {
                // Use body-body as the source if available
                const bodySelectionGroup = getSelectionGroup("body-body");
                const bodySelection = state.selections[bodySelectionGroup];
                if (bodySelection?.variant) {
                  applyMatchBodyColor(
                    bodySelection.variant,
                    bodySelection.recolor ?? bodySelection.variant,
                  );
                }
              }
            },
          }),
          ` ${t("categoryTree.matchBodyColor")}`,
        ],
      ),
      m(
        "p.is-size-7.has-text-grey.mt-1.ml-4",
        {
          id: "match-body-color-label",
        },
        t("categoryTree.matchBodyColorDesc"),
      ),
    ]),
    m("div", [
      // Body Type as first tree item
      m(BodyTypeSelector),
      // Rest of the category tree
      Object.entries(categoryTree.children ?? {}).map(
        ([categoryName, categoryNode]) =>
          m(TreeNode, {
            key: categoryName,
            name: categoryName,
            node: categoryNode,
            catalog,
          }),
      ),
    ]),
  ]);
}

export const CategoryTree: m.Component<CategoryTreeAttrs> = {
  view(vnode) {
    const { catalog } = vnode.attrs;
    return renderResult(
      catalog.getCategoryTree(),
      (categoryTree) => renderTree(categoryTree, catalog),
      () => renderLoadingHost(),
    );
  },
};

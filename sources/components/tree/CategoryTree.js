// Main tree component
import m from "mithril";
import {
  state,
  resetAll,
  getSelectionGroup,
  applyMatchBodyColor,
} from "../../state/state.ts";
import { isLiteReady } from "../../state/catalog.ts";
import { getCategoryTree, getItemMerged } from "../../state/catalog.ts";
import { ResultBoundary } from "../ResultBoundary.js";
import { BodyTypeSelector } from "./BodyTypeSelector.js";
import { TreeNode } from "./TreeNode.js";
import { t } from "../../i18n/index.ts";

function renderLoadingHost() {
  return m("div.box.has-background-light.category-tree-panel", [
    m("div.category-tree-loading-host", [
      m(
        "div.category-tree-loading-overlay",
        { "aria-busy": "true", "aria-live": "polite" },
        m("span.loading", { "aria-label": t("common.loadingCategoryIndex") }),
      ),
      m("h3.title.is-5.mb-3", t("tree.availableItems")),
      m("p.has-text-grey.is-size-7", t("common.loadingCategoryIndex")),
    ]),
  ]);
}

function renderTree(categoryTree) {
  const liteReady = isLiteReady();

  return m("div.box.has-background-light.category-tree-panel", [
    m(
      "div.is-flex.is-justify-content-space-between.is-align-items-center.mb-3",
      [
        m("h3.title.is-5.mb-0", t("tree.availableItems")),
        m("div.buttons.mb-0", [
          m(
            "button.button.is-danger.is-small",
            { onclick: resetAll },
            t("common.resetAll"),
          ),
          m(
            "button.button.is-small",
            {
              onclick: () => {
                state.expandedNodes = {};
              },
            },
            t("common.collapseAll"),
          ),
          m(
            "button.button.is-small",
            {
              disabled: !liteReady,
              title: liteReady ? undefined : t("common.loadingItemList"),
              onclick: () => {
                if (!liteReady) return;
                for (const [, selection] of Object.entries(state.selections)) {
                  const { itemId } = selection;
                  getItemMerged(itemId).match(
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
            t("common.expandSelected"),
          ),
          m(
            "button.button.is-small",
            {
              class: state.compactDisplay ? "is-link" : "",
              onclick: () => {
                state.compactDisplay = !state.compactDisplay;
              },
            },
            t("common.compactDisplay"),
          ),
        ]),
      ],
    ),
    m("div.mb-3", [
      m(
        "label.checkbox",
        {
          title: t("tree.matchBodyColorTitle"),
        },
        [
          m("input[type=checkbox]", {
            id: "match-body-color-checkbox",
            "aria-describedby": "match-body-color-label",
            checked: state.matchBodyColorEnabled,
            onchange: (e) => {
              state.matchBodyColorEnabled = e.target.checked;
              // If enabling the checkbox, immediately apply match body color
              if (e.target.checked) {
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
          t("tree.matchBodyColor"),
        ],
      ),
      m(
        "p.is-size-7.has-text-grey.mt-1.ml-4",
        {
          id: "match-body-color-label",
        },
        t("tree.matchBodyColorHelp"),
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
          }),
      ),
    ]),
  ]);
}

export const CategoryTree = {
  view: function () {
    return m(ResultBoundary, {
      read: () => getCategoryTree(),
      view: (categoryTree) => renderTree(categoryTree),
      renderError: () => renderLoadingHost(),
    });
  },
};

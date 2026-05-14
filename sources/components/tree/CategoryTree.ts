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
import type { CategoryTree as CategoryTreeShape } from "../../state/catalog.ts";
import { renderResult } from "../../utils/render-result.ts";
import { BodyTypeSelector } from "./BodyTypeSelector.ts";
import { TreeNode } from "./TreeNode.ts";

function renderLoadingHost() {
  return m("div.box.has-background-light.category-tree-panel", [
    m("div.category-tree-loading-host", [
      m(
        "div.category-tree-loading-overlay",
        { "aria-busy": "true", "aria-live": "polite" },
        m("span.loading", { "aria-label": "Loading category index" }),
      ),
      m("h3.title.is-5.mb-3", "Available Items"),
      m("p.has-text-grey.is-size-7", "Loading category index…"),
    ]),
  ]);
}

function renderTree(categoryTree: CategoryTreeShape) {
  const liteReady = isLiteReady();

  return m("div.box.has-background-light.category-tree-panel", [
    m(
      "div.is-flex.is-justify-content-space-between.is-align-items-center.mb-3",
      [
        m("h3.title.is-5.mb-0", "Available Items"),
        m("div.buttons.mb-0", [
          m(
            "button.button.is-danger.is-small",
            { onclick: resetAll },
            "Reset all",
          ),
          m(
            "button.button.is-small",
            {
              onclick: () => {
                state.expandedNodes = {};
              },
            },
            "Collapse All",
          ),
          m(
            "button.button.is-small",
            {
              disabled: !liteReady,
              title: liteReady ? undefined : "Loading item list…",
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
            "Expand Selected",
          ),
          m(
            "button.button.is-small",
            {
              class: state.compactDisplay ? "is-link" : "",
              onclick: () => {
                state.compactDisplay = !state.compactDisplay;
              },
            },
            "CompactDisplay",
          ),
        ]),
      ],
    ),
    m("div.mb-3", [
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
          " Match body color",
        ],
      ),
      m(
        "p.is-size-7.has-text-grey.mt-1.ml-4",
        {
          id: "match-body-color-label",
        },
        "Auto-update heads, ears, and other items when body color changes",
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

export const CategoryTree: m.Component = {
  view() {
    return renderResult(
      getCategoryTree(),
      (categoryTree) => renderTree(categoryTree),
      () => renderLoadingHost(),
    );
  },
};

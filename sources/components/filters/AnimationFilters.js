// Animation Filters component
import m from "mithril";
import { isLiteReady } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import { isItemAnimationCompatible } from "../../state/filters.ts";
import { ANIMATIONS } from "../../state/constants.ts";
import { t } from "../../i18n/index.ts";
import { translateAnimationLabel } from "../../i18n/metadata.ts";

// Dependency injection for testability
let deps = {
  isItemAnimationCompatible,
  animations: ANIMATIONS,
};

export function setAnimationCompatible({ isItemAnimationCompatible }) {
  deps.isItemAnimationCompatible = isItemAnimationCompatible;
}
export function isAnimationCompatible() {
  return deps.isItemAnimationCompatible(...arguments);
}

export function setAnimations(anims) {
  deps.animations = anims;
}
export function getAnimations() {
  return deps.animations;
}

function getAnimationLabel(anim) {
  return translateAnimationLabel(anim.value, anim.label);
}

export const AnimationFilters = {
  oninit: function (vnode) {
    vnode.state.isExpanded = false; // Start collapsed by default
  },
  view: function (vnode) {
    const liteReady = isLiteReady();

    // Function to remove incompatible items from selections
    const removeIncompatibleItems = () => {
      const toRemove = [];
      for (const [selectionGroup, selection] of Object.entries(
        state.selections,
      )) {
        if (!isAnimationCompatible(selection.itemId)) {
          toRemove.push(selectionGroup);
        }
      }

      if (toRemove.length > 0) {
        toRemove.forEach((key) => delete state.selections[key]);
        alert(t("filters.removedIncompatible", { count: toRemove.length }));
      } else {
        alert(t("filters.noIncompatibleFound"));
      }
    };

    // Check if there are any incompatible selected items
    const incompatibleSelections = Object.values(state.selections).filter(
      (selection) => !isAnimationCompatible(selection.itemId),
    );
    const hasIncompatibleItems = incompatibleSelections.length > 0;

    // Count how many animations are enabled
    const enabledCount = Object.values(state.enabledAnimations).filter(
      Boolean,
    ).length;
    const totalCount = getAnimations().length;
    const isFilterActive = enabledCount > 0;

    return m("div.box.mb-4.has-background-light", [
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
          m("span.title.is-inline.is-6", t("filters.animationTitle")),
          m(
            "span.is-size-7.has-text-grey.ml-2",
            isFilterActive
              ? `(${enabledCount}/${totalCount})`
              : t("filters.allCount"),
          ),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.content.mt-3", [
            !liteReady
              ? m("p.is-size-7.has-text-grey.mb-3", t("common.loadingItemList"))
              : null,
            m(
              "ul.tree-list",
              getAnimations().map((anim) =>
                m("li", { key: anim.value, class: "mb-2" }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: state.enabledAnimations[anim.value],
                      disabled: !liteReady,
                      onchange: (e) => {
                        state.enabledAnimations[anim.value] = e.target.checked;
                      },
                    }),
                    ` ${getAnimationLabel(anim)}`,
                  ]),
                ]),
              ),
            ),
            hasIncompatibleItems
              ? [
                  m("div.notification.is-warning.is-light.p-3.mt-2", [
                    m("p.is-size-7", [
                      m(
                        "strong",
                        t("compatibility.selectedIncompatible", {
                          count: incompatibleSelections.length,
                        }),
                      ),
                      t("compatibility.withAnimationSelection"),
                      m("span.has-text-grey", t("compatibility.markedAbove")),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.mt-2",
                    {
                      onclick: removeIncompatibleItems,
                      title: t("filters.removeIncompatibleTitle", {
                        count: incompatibleSelections.length,
                      }),
                    },
                    t("filters.removeIncompatibleButton", {
                      count: incompatibleSelections.length,
                    }),
                  ),
                ]
              : null,
          ])
        : null,
    ]);
  },
};

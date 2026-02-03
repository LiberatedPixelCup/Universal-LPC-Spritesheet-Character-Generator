// Animation Filters component
import { state } from "../../state/state.js";
import { isItemAnimationCompatible } from "../../state/filters.js";
import { ANIMATIONS } from "../../state/constants.js";

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

export const AnimationFilters = {
  isAnimationCompatible() {
    return deps.isItemAnimationCompatible(...arguments);
  },
  animations() {
    return deps.animations;
  },
  oninit: function (vnode) {
    vnode.state.isExpanded = false; // Start collapsed by default
  },
  view: function (vnode) {
    const self = this;

    // Function to remove incompatible items from selections
    const removeIncompatibleItems = () => {
      const toRemove = [];
      for (const [selectionGroup, selection] of Object.entries(
        state.selections,
      )) {
        if (!self.isAnimationCompatible(selection.itemId)) {
          toRemove.push(selectionGroup);
        }
      }

      if (toRemove.length > 0) {
        toRemove.forEach((key) => delete state.selections[key]);
        alert(`Removed ${toRemove.length} incompatible item(s)`);
      } else {
        alert("No incompatible items found");
      }
    };

    // Check if there are any incompatible selected items
    const incompatibleSelections = Object.values(state.selections).filter(
      (selection) => !self.isAnimationCompatible(selection.itemId),
    );
    const hasIncompatibleItems = incompatibleSelections.length > 0;

    // Count how many animations are enabled
    const enabledCount = Object.values(state.enabledAnimations).filter(
      Boolean,
    ).length;
    const totalCount = self.animations().length;
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
          m("span.title.is-inline.is-6", "Animation Filters"),
          m(
            "span.is-size-7.has-text-grey.ml-2",
            isFilterActive ? `(${enabledCount}/${totalCount})` : "(All)",
          ),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.content.mt-3", [
            m(
              "ul.tree-list",
              self.animations().map((anim) =>
                m("li", { key: anim.value, class: "mb-2" }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: state.enabledAnimations[anim.value],
                      onchange: (e) => {
                        state.enabledAnimations[anim.value] = e.target.checked;
                      },
                    }),
                    ` ${anim.label}`,
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
                        `${incompatibleSelections.length} selected item${incompatibleSelections.length > 1 ? "s are" : " is"} incompatible`,
                      ),
                      " with your current animation selection. ",
                      m("span.has-text-grey", "(marked with ⚠️ above)"),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.mt-2",
                    {
                      onclick: removeIncompatibleItems,
                      title: `Remove ${incompatibleSelections.length} incompatible item${incompatibleSelections.length > 1 ? "s" : ""}`,
                    },
                    `Remove ${incompatibleSelections.length} Incompatible Asset${incompatibleSelections.length > 1 ? "s" : ""}`,
                  ),
                ]
              : null,
          ])
        : null,
    ]);
  },
};

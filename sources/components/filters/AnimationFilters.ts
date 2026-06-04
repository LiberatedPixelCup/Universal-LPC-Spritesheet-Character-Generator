// Animation Filters component
import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import { isItemAnimationCompatible } from "../../state/filters.ts";
import { ANIMATIONS } from "../../state/constants.ts";

type AnimationOption = { value: string; label: string };
type AnimationFiltersDeps = {
  isItemAnimationCompatible: typeof isItemAnimationCompatible;
  animations: readonly AnimationOption[];
};

// Dependency injection for testability
const deps: AnimationFiltersDeps = {
  isItemAnimationCompatible,
  animations: ANIMATIONS,
};

export function setAnimationCompatible(
  overrides: Pick<AnimationFiltersDeps, "isItemAnimationCompatible">,
): void {
  deps.isItemAnimationCompatible = overrides.isItemAnimationCompatible;
}
export function isAnimationCompatible(
  itemId: string,
  catalog: Pick<CatalogReader, "getItemLite">,
): boolean {
  return deps.isItemAnimationCompatible(itemId, catalog);
}

export function setAnimations(anims: readonly AnimationOption[]): void {
  deps.animations = anims;
}
export function getAnimations(): readonly AnimationOption[] {
  return deps.animations;
}

type AnimationFiltersState = { isExpanded: boolean };
type AnimationFiltersAttrs = {
  catalog: Pick<CatalogReader, "isLiteReady" | "getItemLite">;
};

export const AnimationFilters: m.Component<
  AnimationFiltersAttrs,
  AnimationFiltersState
> = {
  oninit(vnode) {
    vnode.state.isExpanded = false;
  },
  view(vnode) {
    const liteReady = vnode.attrs.catalog.isLiteReady();

    const removeIncompatibleItems = () => {
      const toRemove: string[] = [];
      for (const [selectionGroup, selection] of Object.entries(
        state.selections,
      )) {
        if (!isAnimationCompatible(selection.itemId, vnode.attrs.catalog)) {
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

    const incompatibleSelections = Object.values(state.selections).filter(
      (selection) =>
        !isAnimationCompatible(selection.itemId, vnode.attrs.catalog),
    );
    const hasIncompatibleItems = incompatibleSelections.length > 0;

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
          m("span.title.is-inline.is-6", "Animation Filters"),
          m(
            "span.is-size-7.has-text-grey.ml-2",
            isFilterActive ? `(${enabledCount}/${totalCount})` : "(All)",
          ),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.content.mt-3", [
            !liteReady
              ? m("p.is-size-7.has-text-grey.mb-3", "Loading item list…")
              : null,
            m(
              "ul.tree-list",
              getAnimations().map((anim) =>
                m("li", { key: anim.value, class: "mb-2" }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: state.enabledAnimations[anim.value],
                      disabled: !liteReady,
                      onchange: (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        state.enabledAnimations[anim.value] = target.checked;
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

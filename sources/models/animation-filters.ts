import { ANIMATIONS } from "../state/constants.ts";
import type { CatalogReader } from "../state/catalog.ts";
import { isItemAnimationCompatible } from "../state/filters.ts";
import type { State } from "../state/state.ts";

export type AnimationFilterOptionModel = {
  readonly value: string;
  readonly label: string;
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
};

export type AnimationFiltersModel = {
  readonly liteReady: boolean;
  readonly summary: string;
  readonly options: readonly AnimationFilterOptionModel[];
  readonly incompatibleCount: number;
  removeIncompatible(): number;
};

function incompatibleSelectionKeys(
  catalog: CatalogReader,
  state: State,
): string[] {
  return Object.entries(state.selections)
    .filter(
      ([, selection]) =>
        !isItemAnimationCompatible(catalog, state, selection.itemId),
    )
    .map(([key]) => key);
}

export const animationFiltersModelFactory = {
  create(catalog: CatalogReader, state: State): AnimationFiltersModel {
    const enabledCount = Object.values(state.enabledAnimations).filter(
      Boolean,
    ).length;
    const incompatibleCount = incompatibleSelectionKeys(catalog, state).length;

    return {
      liteReady: catalog.isLiteReady(),
      summary:
        enabledCount > 0 ? `(${enabledCount}/${ANIMATIONS.length})` : "(All)",
      options: ANIMATIONS.map((animation) => ({
        value: animation.value,
        label: animation.label,
        enabled: Boolean(state.enabledAnimations[animation.value]),
        setEnabled(enabled) {
          state.enabledAnimations[animation.value] = enabled;
        },
      })),
      incompatibleCount,
      removeIncompatible() {
        const keys = incompatibleSelectionKeys(catalog, state);
        for (const key of keys) delete state.selections[key];
        return keys.length;
      },
    };
  },
};

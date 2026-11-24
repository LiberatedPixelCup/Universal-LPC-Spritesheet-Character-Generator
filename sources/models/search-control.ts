import { getCatalogFailure, type CatalogReader } from "../state/catalog.ts";
import type { State } from "../state/state.ts";

export type SearchControlModel = {
  readonly value: string;
  readonly disabled: boolean;
  readonly title?: string;
  setValue(value: string): void;
};

export const searchControlModelFactory = {
  create(catalog: CatalogReader, state: State): SearchControlModel {
    const loadError = getCatalogFailure(catalog, "index", "lite");
    const disabled = Boolean(loadError) || !catalog.isLiteReady();
    return {
      value: state.searchQuery,
      disabled,
      title: loadError ?? (disabled ? "Loading item list…" : undefined),
      setValue(value) {
        state.searchQuery = value;
      },
    };
  },
};

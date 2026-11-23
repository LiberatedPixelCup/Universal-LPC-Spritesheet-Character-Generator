import { LICENSE_CONFIG } from "../state/constants.ts";
import { getCatalogFailure, type CatalogReader } from "../state/catalog.ts";
import { isItemLicenseCompatible } from "../state/filters.ts";
import type { State } from "../state/state.ts";

export type LicenseFilterOptionModel = {
  readonly key: string;
  readonly label: string;
  readonly url?: string;
  readonly urlLabel?: string;
  readonly enabled: boolean;
  setEnabled(enabled: boolean): void;
};

export type LicenseFiltersModel = {
  readonly liteReady: boolean;
  readonly creditsReady: boolean;
  readonly loadError?: string;
  readonly summary: string;
  readonly options: readonly LicenseFilterOptionModel[];
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
        !isItemLicenseCompatible(catalog, state, selection.itemId),
    )
    .map(([key]) => key);
}

export const licenseFiltersModelFactory = {
  create(catalog: CatalogReader, state: State): LicenseFiltersModel {
    const creditsReady = catalog.isCreditsReady();
    const loadError = getCatalogFailure(catalog, "index", "lite", "credits");
    const enabledCount = Object.values(state.enabledLicenses).filter(
      Boolean,
    ).length;
    const incompatibleCount = creditsReady
      ? incompatibleSelectionKeys(catalog, state).length
      : 0;

    return {
      liteReady: catalog.isLiteReady(),
      creditsReady,
      loadError,
      summary: `(${enabledCount}/${LICENSE_CONFIG.length} enabled)`,
      options: LICENSE_CONFIG.map((license) => ({
        key: license.key,
        label: license.label,
        url: license.url,
        urlLabel: license.urlLabel,
        enabled: Boolean(state.enabledLicenses[license.key]),
        setEnabled(enabled) {
          if (!getCatalogFailure(catalog, "index", "lite", "credits")) {
            state.enabledLicenses[license.key] = enabled;
          }
        },
      })),
      incompatibleCount,
      removeIncompatible() {
        if (
          state.isExportingZip ||
          !catalog.isCreditsReady() ||
          !catalog.isLiteReady()
        )
          return 0;
        const keys = incompatibleSelectionKeys(catalog, state);
        for (const key of keys) delete state.selections[key];
        return keys.length;
      },
    };
  },
};

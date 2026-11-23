import { getCatalogFailure, type CatalogReader } from "../state/catalog.ts";
import {
  isItemAnimationCompatible,
  isItemLicenseCompatible,
} from "../state/filters.ts";
import type { State } from "../state/state.ts";

export type CurrentSelectionItemModel = {
  readonly key: string;
  readonly name: string;
  readonly isCompatible: boolean;
  readonly tooltip: string;
  remove(): void;
};

export type CurrentSelectionsModel =
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "empty" }
  | {
      readonly kind: "ready";
      readonly items: readonly CurrentSelectionItemModel[];
    };

export const currentSelectionsModelFactory = {
  create(catalog: CatalogReader, state: State): CurrentSelectionsModel {
    const failed = getCatalogFailure(catalog, "index", "lite");
    if (failed) return { kind: "failed", message: failed };
    if (!catalog.isLiteReady()) return { kind: "loading" };

    const selections = Object.entries(state.selections);
    if (selections.length === 0) return { kind: "empty" };

    const creditsReady = catalog.isCreditsReady();
    const creditsFailure = getCatalogFailure(catalog, "credits");
    return {
      kind: "ready",
      items: selections.map(([key, selection]) => {
        const licenseCompatible = isItemLicenseCompatible(
          catalog,
          state,
          selection.itemId,
        );
        const animationCompatible = isItemAnimationCompatible(
          catalog,
          state,
          selection.itemId,
        );
        const isCompatible = licenseCompatible && animationCompatible;
        const meta = catalog.getItemMerged(selection.itemId).unwrapOr(null);
        const licenses = new Set<string>();
        for (const credit of meta?.credits ?? []) {
          for (const license of credit.licenses) licenses.add(license.trim());
        }

        const licensesText = !creditsReady
          ? (creditsFailure ?? "License info loading…")
          : licenses.size > 0
            ? `Licenses: ${Array.from(licenses).join(", ")}`
            : "No license info";
        const supportedAnimations = meta?.animations ?? [];
        const animationsText =
          supportedAnimations.length > 0
            ? `Animations: ${supportedAnimations.join(", ")}`
            : "No animation info";
        const incompatibility = !isCompatible
          ? `⚠️ Incompatible with selected ${[
              !licenseCompatible ? "licenses" : null,
              !animationCompatible ? "animations" : null,
            ]
              .filter(Boolean)
              .join(" and ")}\n`
          : "";

        return {
          key,
          name: selection.name,
          isCompatible,
          tooltip: `${incompatibility}${licensesText}\n${animationsText}`,
          remove: () => {
            if (state.isExportingZip) return;
            delete state.selections[key];
          },
        };
      }),
    };
  },
};

import type { CatalogReader } from "../state/catalog.ts";
import type { State } from "../state/state.ts";
import {
  currentSelectionsModelFactory,
  type CurrentSelectionsModel,
} from "./current-selections.ts";
import {
  searchControlModelFactory,
  type SearchControlModel,
} from "./search-control.ts";
import {
  licenseFiltersModelFactory,
  type LicenseFiltersModel,
} from "./license-filters.ts";
import {
  animationFiltersModelFactory,
  type AnimationFiltersModel,
} from "./animation-filters.ts";

export type ApplicationModels = {
  createSearchControlModel(): SearchControlModel;
  createLicenseFiltersModel(): LicenseFiltersModel;
  createAnimationFiltersModel(): AnimationFiltersModel;
  createCurrentSelectionsModel(): CurrentSelectionsModel;
};

/** Builds the render-ready model graph at the application composition root. */
export function createApplicationModels(
  catalog: CatalogReader,
  state: State,
): ApplicationModels {
  return {
    createSearchControlModel: () =>
      searchControlModelFactory.create(catalog, state),
    createLicenseFiltersModel: () =>
      licenseFiltersModelFactory.create(catalog, state),
    createAnimationFiltersModel: () =>
      animationFiltersModelFactory.create(catalog, state),
    createCurrentSelectionsModel: () =>
      currentSelectionsModelFactory.create(catalog, state),
  };
}

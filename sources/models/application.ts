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
import {
  categoryTreeModelFactory,
  type CategoryTreeModel,
} from "./category-tree.ts";
import { downloadModelFactory, type DownloadModel } from "./download.ts";
import { creditsModelFactory, type CreditsModel } from "./credits.ts";

export type ApplicationModels = {
  createDownloadModel(): DownloadModel;
  createCreditsModel(): CreditsModel;
  createSearchControlModel(): SearchControlModel;
  createLicenseFiltersModel(): LicenseFiltersModel;
  createAnimationFiltersModel(): AnimationFiltersModel;
  createCurrentSelectionsModel(): CurrentSelectionsModel;
  createCategoryTreeModel(): CategoryTreeModel;
};

/** Builds the render-ready model graph at the application composition root. */
export function createApplicationModels(
  catalog: CatalogReader,
  state: State,
): ApplicationModels {
  return {
    createDownloadModel: () => downloadModelFactory.create(catalog, state),
    createCreditsModel: () => creditsModelFactory.create(catalog, state),
    createSearchControlModel: () =>
      searchControlModelFactory.create(catalog, state),
    createLicenseFiltersModel: () =>
      licenseFiltersModelFactory.create(catalog, state),
    createAnimationFiltersModel: () =>
      animationFiltersModelFactory.create(catalog, state),
    createCurrentSelectionsModel: () =>
      currentSelectionsModelFactory.create(catalog, state),
    createCategoryTreeModel: () =>
      categoryTreeModelFactory.create(catalog, state),
  };
}

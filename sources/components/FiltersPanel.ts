// Filters Panel - combines Controls, LicenseFilters, AnimationFilters, CurrentSelections, and CategoryTree
import m from "mithril";
import type { CatalogReader } from "../state/catalog.ts";
import { SearchControl } from "./filters/SearchControl.ts";
import { LicenseFilters } from "./filters/LicenseFilters.ts";
import { AnimationFilters } from "./filters/AnimationFilters.ts";
import { CurrentSelections } from "./selections/CurrentSelections.ts";
import { CategoryTree } from "./tree/CategoryTree.ts";
import { CollapsibleSection } from "./CollapsibleSection.ts";
import type { State } from "../state/state.ts";
import type { CurrentSelectionsModel } from "../models/current-selections.ts";
import type { SearchControlModel } from "../models/search-control.ts";
import type { LicenseFiltersModel } from "../models/license-filters.ts";
import type { AnimationFiltersModel } from "../models/animation-filters.ts";

type FiltersPanelAttrs = {
  catalog: CatalogReader;
  state: State;
  createSearchControlModel: () => SearchControlModel;
  createLicenseFiltersModel: () => LicenseFiltersModel;
  createAnimationFiltersModel: () => AnimationFiltersModel;
  createCurrentSelectionsModel: () => CurrentSelectionsModel;
};

export const FiltersPanel: m.Component<FiltersPanelAttrs> = {
  view(vnode) {
    const {
      catalog,
      state,
      createSearchControlModel,
      createLicenseFiltersModel,
      createAnimationFiltersModel,
      createCurrentSelectionsModel,
    } = vnode.attrs;
    return m(
      CollapsibleSection,
      {
        title: "Filters",
        defaultOpen: true,
      },
      [
        m(
          "div.mb-4",
          m(SearchControl, { createModel: createSearchControlModel }),
        ),
        // Responsive wrapper for License and Animation filters
        m("div.columns.is-multiline.m-0", [
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(LicenseFilters, { createModel: createLicenseFiltersModel }),
          ),
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(AnimationFilters, { createModel: createAnimationFiltersModel }),
          ),
        ]),
        m(
          "div.mb-4",
          m(CurrentSelections, {
            createModel: createCurrentSelectionsModel,
          }),
        ),
        m(CategoryTree, { catalog, state }),
      ],
    );
  },
};

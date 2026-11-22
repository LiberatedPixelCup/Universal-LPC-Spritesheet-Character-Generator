// Filters Panel - combines Controls, LicenseFilters, AnimationFilters, CurrentSelections, and CategoryTree
import m from "mithril";
import { SearchControl } from "./filters/SearchControl.ts";
import { LicenseFilters } from "./filters/LicenseFilters.ts";
import { AnimationFilters } from "./filters/AnimationFilters.ts";
import { CurrentSelections } from "./selections/CurrentSelections.ts";
import { CategoryTree } from "./tree/CategoryTree.ts";
import { CollapsibleSection } from "./CollapsibleSection.ts";
import type { CurrentSelectionsModel } from "../models/current-selections.ts";
import type { SearchControlModel } from "../models/search-control.ts";
import type { LicenseFiltersModel } from "../models/license-filters.ts";
import type { AnimationFiltersModel } from "../models/animation-filters.ts";
import type { CategoryTreeModel } from "../models/category-tree.ts";

type FiltersPanelAttrs = {
  createSearchControlModel: () => SearchControlModel;
  createLicenseFiltersModel: () => LicenseFiltersModel;
  createAnimationFiltersModel: () => AnimationFiltersModel;
  createCurrentSelectionsModel: () => CurrentSelectionsModel;
  createCategoryTreeModel: () => CategoryTreeModel;
};

export const FiltersPanel: m.Component<FiltersPanelAttrs> = {
  view(vnode) {
    const {
      createSearchControlModel,
      createLicenseFiltersModel,
      createAnimationFiltersModel,
      createCurrentSelectionsModel,
      createCategoryTreeModel,
    } = vnode.attrs;
    return m(
      CollapsibleSection,
      {
        title: "Filters",
        defaultOpen: true,
        boxClass: "box lpc-filters-panel",
      },
      [
        m(
          "div.lpc-search-field",
          m(SearchControl, { createModel: createSearchControlModel }),
        ),
        // Responsive wrapper for License and Animation filters
        m("div.lpc-filter-groups", [
          m(
            "div.lpc-filter-col.filters-column",
            m(LicenseFilters, { createModel: createLicenseFiltersModel }),
          ),
          m(
            "div.lpc-filter-col.filters-column",
            m(AnimationFilters, { createModel: createAnimationFiltersModel }),
          ),
        ]),
        m(
          "div.lpc-selections-block",
          m(CurrentSelections, {
            createModel: createCurrentSelectionsModel,
          }),
        ),
        m(CategoryTree, {
          createModel: createCategoryTreeModel,
        }),
      ],
    );
  },
};

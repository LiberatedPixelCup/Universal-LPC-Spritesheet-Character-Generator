// Filters Panel - combines Controls, LicenseFilters, AnimationFilters, CurrentSelections, and CategoryTree
import m from "mithril";
import { SearchControl } from "./filters/SearchControl.js";
import { LicenseFilters } from "./filters/LicenseFilters.js";
import { AnimationFilters } from "./filters/AnimationFilters.js";
import { CurrentSelections } from "./selections/CurrentSelections.js";
import { CategoryTree } from "./tree/CategoryTree.ts";
import { CollapsibleSection } from "./CollapsibleSection.ts";

export const FiltersPanel: m.Component = {
  view() {
    return m(
      CollapsibleSection,
      {
        title: "Filters",
        defaultOpen: true,
      },
      [
        m("div.mb-4", m(SearchControl)),
        // Responsive wrapper for License and Animation filters
        m("div.columns.is-multiline.m-0", [
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(LicenseFilters),
          ),
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(AnimationFilters),
          ),
        ]),
        m("div.mb-4", m(CurrentSelections)),
        m(CategoryTree),
      ],
    );
  },
};

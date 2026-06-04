// Filters Panel - combines Controls, LicenseFilters, AnimationFilters, CurrentSelections, and CategoryTree
import m from "mithril";
import type { CatalogReader } from "../state/catalog.ts";
import { SearchControl } from "./filters/SearchControl.ts";
import { LicenseFilters } from "./filters/LicenseFilters.ts";
import { AnimationFilters } from "./filters/AnimationFilters.ts";
import { CurrentSelections } from "./selections/CurrentSelections.ts";
import { CategoryTree } from "./tree/CategoryTree.ts";
import { CollapsibleSection } from "./CollapsibleSection.ts";

type FiltersPanelAttrs = { catalog: CatalogReader };

export const FiltersPanel: m.Component<FiltersPanelAttrs> = {
  view(vnode) {
    return m(
      CollapsibleSection,
      {
        title: "Filters",
        defaultOpen: true,
      },
      [
        m("div.mb-4", m(SearchControl, { catalog: vnode.attrs.catalog })),
        // Responsive wrapper for License and Animation filters
        m("div.columns.is-multiline.m-0", [
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(LicenseFilters, { catalog: vnode.attrs.catalog }),
          ),
          m(
            "div.column.is-half-desktop.is-12-mobile",
            {
              class: "filters-column",
            },
            m(AnimationFilters, { catalog: vnode.attrs.catalog }),
          ),
        ]),
        m("div.mb-4", m(CurrentSelections, { catalog: vnode.attrs.catalog })),
        m(CategoryTree, { catalog: vnode.attrs.catalog }),
      ],
    );
  },
};

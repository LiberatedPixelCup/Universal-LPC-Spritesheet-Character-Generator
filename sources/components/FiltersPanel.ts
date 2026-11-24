import m from "mithril";
import { LicenseFilters } from "./filters/LicenseFilters.ts";
import { AnimationFilters } from "./filters/AnimationFilters.ts";
import { CollapsibleSection } from "./CollapsibleSection.ts";
import type { LicenseFiltersModel } from "../models/license-filters.ts";
import type { AnimationFiltersModel } from "../models/animation-filters.ts";

type FiltersPanelAttrs = {
  createLicenseFiltersModel: () => LicenseFiltersModel;
  createAnimationFiltersModel: () => AnimationFiltersModel;
  defaultOpen?: boolean;
};

export const FiltersPanel: m.Component<FiltersPanelAttrs> = {
  view(vnode) {
    const {
      createLicenseFiltersModel,
      createAnimationFiltersModel,
      defaultOpen = true,
    } = vnode.attrs;
    return m(
      CollapsibleSection,
      {
        title: "Filters",
        defaultOpen,
        boxClass: "box lpc-filters-panel",
      },
      [
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
      ],
    );
  },
};

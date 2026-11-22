// License Filters component
import m from "mithril";
import type { LicenseFiltersModel } from "../../models/license-filters.ts";

type LicenseFiltersState = { isExpanded: boolean };

const LICENSE_FILTERS_BODY_ID = "lpc-license-filters-body";

export const LicenseFilters: m.Component<
  { createModel: () => LicenseFiltersModel },
  LicenseFiltersState
> = {
  oninit(vnode) {
    vnode.state.isExpanded = false;
  },
  view(vnode) {
    const model = vnode.attrs.createModel();

    const removeIncompatibleItems = () => {
      const removedCount = model.removeIncompatible();
      if (removedCount > 0) {
        alert(`Removed ${removedCount} incompatible item(s)`);
      } else {
        alert("No incompatible items found");
      }
    };

    const hasIncompatibleItems = model.incompatibleCount > 0;

    return m("div.box.lpc-filter-card", [
      m(
        "button.tree-label.lpc-filter-disclosure",
        {
          type: "button",
          "aria-expanded": String(vnode.state.isExpanded),
          "aria-controls": LICENSE_FILTERS_BODY_ID,
          onclick: () => {
            vnode.state.isExpanded = !vnode.state.isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: vnode.state.isExpanded ? "expanded" : "collapsed",
            "aria-hidden": "true",
          }),
          m("span.lpc-filter-title", "License Filters"),
          m("span.lpc-filter-summary", model.summary),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.lpc-filter-body", { id: LICENSE_FILTERS_BODY_ID }, [
            !model.liteReady
              ? m("p.lpc-helper-text", "Loading item list…")
              : null,
            !model.creditsReady
              ? m("p.lpc-helper-text", "Loading asset license data…")
              : null,
            m(
              "ul.tree-list.lpc-filter-list",
              model.options.map((license) =>
                m("li", { key: license.key }, [
                  m("div.lpc-license-option", [
                    m("label.checkbox", [
                      m("input[type=checkbox]", {
                        checked: license.enabled,
                        disabled: !model.liteReady,
                        onchange: (e: Event) => {
                          const target = e.target as HTMLInputElement;
                          license.setEnabled(target.checked);
                        },
                      }),
                      m("span", license.label),
                    ]),
                    m(
                      "a.lpc-license-link",
                      {
                        href: license.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                      `(Show license${license.urlLabel ? " " + license.urlLabel : ""})`,
                    ),
                  ]),
                ]),
              ),
            ),
            hasIncompatibleItems
              ? [
                  m("div.lpc-warning-box", [
                    m("p", [
                      m(
                        "strong",
                        `${model.incompatibleCount} selected item${model.incompatibleCount > 1 ? "s are" : " is"} incompatible`,
                      ),
                      " with your current license selection. ",
                      m("span", "(marked with ⚠️ below)"),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.lpc-btn-warning.mt-2",
                    {
                      type: "button",
                      onclick: removeIncompatibleItems,
                      title: `Remove ${model.incompatibleCount} incompatible item${model.incompatibleCount > 1 ? "s" : ""}`,
                    },
                    `Remove ${model.incompatibleCount} Incompatible Asset${model.incompatibleCount > 1 ? "s" : ""}`,
                  ),
                ]
              : null,
          ])
        : null,
    ]);
  },
};

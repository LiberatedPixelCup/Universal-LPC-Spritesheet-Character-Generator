// License Filters component
import m from "mithril";
import { state } from "../../state/state.ts";
import { isCreditsReady, isLiteReady } from "../../state/catalog.ts";
import { isItemLicenseCompatible } from "../../state/filters.ts";
import { LICENSE_CONFIG } from "../../state/constants.ts";
import { t } from "../../i18n/index.ts";

// Dependency injection for testability
let deps = {
  isItemLicenseCompatible,
  licenseConfig: LICENSE_CONFIG,
};

export function setLicenseCompatible({ isItemLicenseCompatible }) {
  deps.isItemLicenseCompatible = isItemLicenseCompatible;
}
export function isLicenseCompatible() {
  return deps.isItemLicenseCompatible(...arguments);
}

export function setLicenseConfig(config) {
  deps.licenseConfig = config;
}
export function getLicenseConfig() {
  return deps.licenseConfig;
}

export const LicenseFilters = {
  oninit: function (vnode) {
    vnode.state.isExpanded = false; // Start collapsed by default
  },
  view: function (vnode) {
    const liteReady = isLiteReady();

    // Function to remove incompatible items from selections
    const removeIncompatibleItems = () => {
      const toRemove = [];
      for (const [selectionGroup, selection] of Object.entries(
        state.selections,
      )) {
        if (!isLicenseCompatible(selection.itemId)) {
          toRemove.push(selectionGroup);
        }
      }

      if (toRemove.length > 0) {
        toRemove.forEach((key) => delete state.selections[key]);
        alert(t("filters.removedIncompatible", { count: toRemove.length }));
      } else {
        alert(t("filters.noIncompatibleFound"));
      }
    };

    const creditsReady = isCreditsReady();

    // Check if there are any incompatible selected items (needs credits chunk)
    const incompatibleSelections = creditsReady
      ? Object.values(state.selections).filter(
          (selection) => !isLicenseCompatible(selection.itemId),
        )
      : [];
    const hasIncompatibleItems =
      creditsReady && incompatibleSelections.length > 0;

    // Count how many licenses are enabled
    const enabledCount = Object.values(state.enabledLicenses).filter(
      Boolean,
    ).length;
    const totalCount = getLicenseConfig().length;

    return m("div.box.mb-4.has-background-light", [
      m(
        "div.tree-label",
        {
          onclick: () => {
            vnode.state.isExpanded = !vnode.state.isExpanded;
          },
        },
        [
          m("span.tree-arrow", {
            class: vnode.state.isExpanded ? "expanded" : "collapsed",
          }),
          m("span.title.is-6.is-inline", t("filters.licenseTitle")),
          m(
            "span.is-size-7.has-text-grey.ml-2",
            t("filters.enabledCount", {
              enabled: enabledCount,
              total: totalCount,
            }),
          ),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.content.mt-3", [
            !liteReady
              ? m("p.is-size-7.has-text-grey.mb-3", t("common.loadingItemList"))
              : null,
            !creditsReady
              ? m(
                  "p.is-size-7.has-text-grey.mb-3",
                  t("common.loadingAssetLicenseData"),
                )
              : null,
            m(
              "ul.tree-list",
              getLicenseConfig().map((license) =>
                m("li", { key: license.key, class: "mb-2" }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: state.enabledLicenses[license.key],
                      disabled: !liteReady,
                      onchange: (e) => {
                        state.enabledLicenses[license.key] = e.target.checked;
                      },
                    }),
                    ` ${license.label} `,
                    m(
                      "a.is-size-7",
                      {
                        href: license.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      },
                      t("filters.showLicense", {
                        label: license.urlLabel ? " " + license.urlLabel : "",
                      }),
                    ),
                  ]),
                ]),
              ),
            ),
            hasIncompatibleItems
              ? [
                  m("div.notification.is-warning.is-light.p-3.mt-2", [
                    m("p.is-size-7", [
                      m(
                        "strong",
                        t("compatibility.selectedIncompatible", {
                          count: incompatibleSelections.length,
                        }),
                      ),
                      t("compatibility.withLicenseSelection"),
                      m("span.has-text-grey", t("compatibility.markedAbove")),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.mt-2",
                    {
                      onclick: removeIncompatibleItems,
                      title: t("filters.removeIncompatibleTitle", {
                        count: incompatibleSelections.length,
                      }),
                    },
                    t("filters.removeIncompatibleButton", {
                      count: incompatibleSelections.length,
                    }),
                  ),
                ]
              : null,
          ])
        : null,
    ]);
  },
};

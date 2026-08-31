// License Filters component
import m from "mithril";
import type { LicenseFiltersModel } from "../../models/license-filters.ts";

type LicenseFiltersState = { isExpanded: boolean };

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
          m("span.title.is-6.is-inline", "License Filters"),
          m("span.is-size-7.has-text-grey.ml-2", model.summary),
        ],
      ),
      vnode.state.isExpanded
        ? m("div.content.mt-3", [
            !model.liteReady
              ? m("p.is-size-7.has-text-grey.mb-3", "Loading item list…")
              : null,
            !model.creditsReady
              ? m(
                  "p.is-size-7.has-text-grey.mb-3",
                  "Loading asset license data…",
                )
              : null,
            m(
              "ul.tree-list",
              model.options.map((license) =>
                m("li", { key: license.key, class: "mb-2" }, [
                  m("label.checkbox", [
                    m("input[type=checkbox]", {
                      checked: license.enabled,
                      disabled: !model.liteReady,
                      onchange: (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        license.setEnabled(target.checked);
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
                      `(Show license${license.urlLabel ? " " + license.urlLabel : ""})`,
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
                        `${model.incompatibleCount} selected item${model.incompatibleCount > 1 ? "s are" : " is"} incompatible`,
                      ),
                      " with your current license selection. ",
                      m("span.has-text-grey", "(marked with ⚠️ above)"),
                    ]),
                  ]),
                  m(
                    "button.button.is-small.is-warning.mt-2",
                    {
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

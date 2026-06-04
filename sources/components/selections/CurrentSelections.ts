// Current selections component
import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import {
  isItemLicenseCompatible,
  isItemAnimationCompatible,
} from "../../state/filters.ts";

type CurrentSelectionsAttrs = {
  catalog: Pick<
    CatalogReader,
    "isLiteReady" | "isCreditsReady" | "getItemLite" | "getItemMerged"
  >;
};

export const CurrentSelections: m.Component<CurrentSelectionsAttrs> = {
  view(vnode) {
    const { catalog } = vnode.attrs;
    if (!catalog.isLiteReady()) {
      return m("div", [
        m("h3.title.is-5", "Current Selections"),
        m("p.is-size-7.has-text-grey", "Loading item list…"),
      ]);
    }

    const selectionCount = Object.keys(state.selections).length;

    if (selectionCount === 0) {
      return m("div", [
        m("h3.title.is-5", "Current Selections"),
        m("p.has-text-grey", "No items selected yet"),
      ]);
    }

    const creditsReady = catalog.isCreditsReady();

    return m("div", [
      m("h3.title.is-5", "Current Selections"),
      m(
        "div.tags",
        Object.entries(state.selections).map(([selectionKey, selection]) => {
          const isLicenseCompatible = isItemLicenseCompatible(
            selection.itemId,
            catalog,
          );
          const isAnimCompatible = isItemAnimationCompatible(
            selection.itemId,
            catalog,
          );
          const isCompatible = isLicenseCompatible && isAnimCompatible;
          const metaResult = catalog.getItemMerged(selection.itemId);
          const meta = metaResult.isOk() ? metaResult.value : null;

          const allLicenses = new Set<string>();
          if (meta) {
            for (const credit of meta.credits) {
              for (const lic of credit.licenses) {
                allLicenses.add(lic.trim());
              }
            }
          }
          const licensesText = !creditsReady
            ? "License info loading…"
            : allLicenses.size > 0
              ? `Licenses: ${Array.from(allLicenses).join(", ")}`
              : "No license info";

          const supportedAnims = meta?.animations ?? [];
          const animsText =
            supportedAnims.length > 0
              ? `Animations: ${supportedAnims.join(", ")}`
              : "No animation info";

          let tooltipText = "";
          if (!isCompatible) {
            const issues: string[] = [];
            if (!isLicenseCompatible) issues.push("licenses");
            if (!isAnimCompatible) issues.push("animations");
            tooltipText = `⚠️ Incompatible with selected ${issues.join(" and ")}\n`;
          }
          tooltipText += `${licensesText}\n${animsText}`;

          return m(
            "span.tag.is-medium",
            {
              key: selectionKey,
              class: isCompatible ? "is-info" : "is-warning",
              title: creditsReady ? tooltipText : undefined,
            },
            [
              m("span", selection.name),
              !isCompatible ? m("span.ml-1", "⚠️") : null,
              m("button.delete.is-small", {
                onclick: () => {
                  delete state.selections[selectionKey];
                },
              }),
            ],
          );
        }),
      ),
    ]);
  },
};

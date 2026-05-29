// Current selections component
import m from "mithril";
import type { CatalogReader } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import {
  isItemLicenseCompatible,
  isItemAnimationCompatible,
} from "../../state/filters.ts";
import {
  t,
  getAnimationListDisplayName,
  getSelectionDisplayName,
} from "../../../lang/i18n.ts";

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
        m("h3.title.is-5", t("currentSelections.title")),
        m("p.is-size-7.has-text-grey", t("currentSelections.loadingItemList")),
      ]);
    }

    const selectionCount = Object.keys(state.selections).length;

    if (selectionCount === 0) {
      return m("div", [
        m("h3.title.is-5", t("currentSelections.title")),
        m("p.has-text-grey", t("currentSelections.noItemsSelected")),
      ]);
    }

    const creditsReady = catalog.isCreditsReady();

    return m("div", [
      m("h3.title.is-5", t("currentSelections.title")),
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
            ? t("currentSelections.licenseInfoLoading")
            : allLicenses.size > 0
              ? `${t("currentSelections.licenses")}${Array.from(allLicenses).join(", ")}`
              : t("currentSelections.noLicenseInfo");

          const supportedAnims = meta?.animations ?? [];
          const animsText =
            supportedAnims.length > 0
              ? `${t("currentSelections.animations")}${getAnimationListDisplayName(supportedAnims)}`
              : t("currentSelections.noAnimationInfo");

          let tooltipText = "";
          if (!isCompatible) {
            tooltipText = `⚠️ ${t("currentSelections.incompatible")}\n`;
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
              m("span", getSelectionDisplayName(selection.name)),
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

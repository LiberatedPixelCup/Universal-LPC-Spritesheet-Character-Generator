// Current selections component
import m from "mithril";
import { isCreditsReady, isLiteReady } from "../../state/catalog.ts";
import { getItemMerged } from "../../state/catalog.ts";
import { state } from "../../state/state.ts";
import {
  isItemLicenseCompatible,
  isItemAnimationCompatible,
} from "../../state/filters.ts";
import { t } from "../../i18n/index.ts";
import {
  translateAnimationList,
  translateSelectionName,
} from "../../i18n/metadata.ts";

export const CurrentSelections = {
  view: function () {
    if (!isLiteReady()) {
      return m("div", [
        m("h3.title.is-5", t("selections.title")),
        m("p.is-size-7.has-text-grey", t("common.loadingItemList")),
      ]);
    }

    const selectionCount = Object.keys(state.selections).length;

    if (selectionCount === 0) {
      return m("div", [
        m("h3.title.is-5", t("selections.title")),
        m("p.has-text-grey", t("common.noItemsSelectedYet")),
      ]);
    }

    const creditsReady = isCreditsReady();

    return m("div", [
      m("h3.title.is-5", t("selections.title")),
      m(
        "div.tags",
        Object.entries(state.selections).map(([selectionKey, selection]) => {
          const isLicenseCompatible = isItemLicenseCompatible(selection.itemId);
          const isAnimCompatible = isItemAnimationCompatible(selection.itemId);
          const isCompatible = isLicenseCompatible && isAnimCompatible;
          const metaResult = getItemMerged(selection.itemId);
          const meta = metaResult.isOk() ? metaResult.value : null;

          // Get all licenses for this item
          const allLicenses = new Set();
          if (meta) {
            for (const credit of meta.credits) {
              for (const lic of credit.licenses) {
                allLicenses.add(lic.trim());
              }
            }
          }
          const licensesText = !creditsReady
            ? t("common.loadingAssetLicenseData")
            : allLicenses.size > 0
              ? t("common.licenses", {
                  items: Array.from(allLicenses).join(", "),
                })
              : t("common.noLicenseInfo");

          // Get supported animations for this item
          const supportedAnims = meta?.animations ?? [];
          const animsText =
            supportedAnims.length > 0
              ? t("common.animations", {
                  items: translateAnimationList(supportedAnims),
                })
              : t("common.noAnimationInfo");

          // Build tooltip text
          let tooltipText = "";
          if (!isCompatible) {
            const issues = [];
            if (!isLicenseCompatible)
              issues.push(t("compatibility.issues.licenses"));
            if (!isAnimCompatible)
              issues.push(t("compatibility.issues.animations"));
            tooltipText = `${t("compatibility.incompatibleWithSelected", {
              issues: issues.join(t("compatibility.issues.and")),
            })}\n`;
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
              m("span", translateSelectionName(selection, meta)),
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

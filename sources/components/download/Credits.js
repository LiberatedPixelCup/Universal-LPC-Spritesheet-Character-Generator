// Credits/Attribution component
import m from "mithril";
import { state } from "../../state/state.ts";
import {
  getAllCredits,
  creditsToCsv,
  creditsToTxt,
} from "../../utils/credits.ts";
import { CollapsibleSection } from "../CollapsibleSection.js";
import { downloadFile } from "../../canvas/download.js";
import { t } from "../../i18n/index.ts";

export const Credits = {
  view: function () {
    // Collect credits from all selected items
    const allCredits = getAllCredits(state.selections, state.bodyType);

    return m(
      CollapsibleSection,
      {
        title: t("credits.title"),
        storageKey: "credits",
        defaultOpen: true,
        boxClass: "box",
        id: "credits-section",
      },
      [
        m("p.is-size-7.mb-2", [
          t("credits.mustCredit"),
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md",
              target: "_blank",
            },
            t("credits.detailedInstructions"),
          ),
        ]),
        m("p.is-size-7.mb-3", [
          t("credits.licenseInfoPrefix"),
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/raw/refs/heads/master/CREDITS.csv",
              target: "_blank",
            },
            t("common.here"),
          ),
        ]),

        !state.previewBootstrapRenderDone
          ? m("p.has-text-grey", t("common.loadingSelections"))
          : allCredits.length > 0
            ? [
                m(
                  "div.content.has-background-light.p-3",
                  allCredits.map((credit) =>
                    m("div.mb-3", { key: credit.file }, [
                      m("strong.is-size-6", credit.fileName),
                      credit.notes ? m("p.is-size-7", credit.notes) : null,
                      m("p.is-size-7", [
                        m("strong", t("common.licensesLabel")),
                        credit.licenses.join(", "),
                      ]),
                      m("p.is-size-7", [
                        m("strong", t("common.authors")),
                        credit.authors.join(", "),
                      ]),
                    ]),
                  ),
                ),
                m("div.buttons.mt-3", [
                  m(
                    "button.button.is-small",
                    {
                      onclick: () =>
                        downloadFile(creditsToTxt(allCredits), "credits.txt"),
                    },
                    t("common.downloadTxt"),
                  ),
                  m(
                    "button.button.is-small",
                    {
                      onclick: () =>
                        downloadFile(creditsToCsv(allCredits), "credits.csv"),
                    },
                    t("common.downloadCsv"),
                  ),
                ]),
              ]
            : m("p.has-text-grey", t("common.noItemsSelected")),
      ],
    );
  },
};

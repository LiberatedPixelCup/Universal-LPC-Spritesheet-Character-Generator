// Credits/Attribution component
import m from "mithril";
import { state } from "../../state/state.ts";
import {
  getAllCredits,
  creditsToCsv,
  creditsToTxt,
} from "../../utils/credits.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import { downloadFile } from "../../canvas/download.ts";
import { t } from "../../../lang/i18n.ts";

export const Credits: m.Component = {
  view() {
    const allCredits = getAllCredits(state.selections, state.bodyType);

    return m(
      CollapsibleSection,
      {
        title: t("credits.title"),
        defaultOpen: true,
        boxClass: "box",
        id: "credits-section",
      },
      [
        m("p.is-size-7.mb-2", [
          t("credits.mustCredit") + " ",
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
          t("credits.licenseInfo"),
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/raw/refs/heads/master/CREDITS.csv",
              target: "_blank",
            },
            t("credits.here"),
          ),
        ]),

        !state.previewBootstrapRenderDone
          ? m("p.has-text-grey", t("credits.loadingSelections"))
          : allCredits.length > 0
            ? [
                m(
                  "div.content.has-background-light.p-3",
                  allCredits.map((credit) =>
                    m("div.mb-3", { key: credit.file }, [
                      m("strong.is-size-6", credit.fileName),
                      credit.notes ? m("p.is-size-7", credit.notes) : null,
                      m("p.is-size-7", [
                        m("strong", t("credits.licenses")),
                        credit.licenses.join(", "),
                      ]),
                      m("p.is-size-7", [
                        m("strong", t("credits.authors")),
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
                    t("credits.downloadTxt"),
                  ),
                  m(
                    "button.button.is-small",
                    {
                      onclick: () =>
                        downloadFile(creditsToCsv(allCredits), "credits.csv"),
                    },
                    t("credits.downloadCsv"),
                  ),
                ]),
              ]
            : m("p.has-text-grey", t("credits.noItemsSelected")),
      ],
    );
  },
};

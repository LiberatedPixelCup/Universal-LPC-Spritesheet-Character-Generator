import m from "mithril";
import type { CreditsModel } from "../../models/credits.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";

const CreditsContent: m.Component<{
  createModel: () => CreditsModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    if (model.kind === "loading") {
      return m(
        "div.loading-shell-credits",
        m("p.lpc-helper-text", "Loading selections…"),
      );
    }
    if (model.kind === "empty") {
      return m("p.lpc-helper-text", "No items selected");
    }

    return [
      m(
        "div.content.lpc-credits-list",
        model.credits.map((credit) =>
          m("div.lpc-credit-entry", { key: credit.key }, [
            m("strong.lpc-credit-file", credit.fileName),
            credit.notes ? m("p.lpc-credit-meta", credit.notes) : null,
            m("p.lpc-credit-meta", [
              m("strong", "Licenses: "),
              credit.licenses.join(", "),
            ]),
            m("p.lpc-credit-meta", [
              m("strong", "Authors: "),
              credit.authors.join(", "),
            ]),
          ]),
        ),
      ),
      m("div.buttons.lpc-credits-actions", [
        m(
          "button.button.is-small",
          { type: "button", onclick: model.downloadTxt },
          "Download TXT",
        ),
        m(
          "button.button.is-small",
          { type: "button", onclick: model.downloadCsv },
          "Download CSV",
        ),
      ]),
    ];
  },
};

export const Credits: m.Component<{
  createModel: () => CreditsModel;
}> = {
  view(vnode) {
    return m(
      CollapsibleSection,
      {
        title: "Credits & Attribution",
        defaultOpen: true,
        boxClass: "box lpc-credits-panel",
        id: "credits-section",
      },
      [
        m("p.lpc-credits-intro", [
          "You must credit the authors of this artwork. ",
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "Detailed attribution instructions",
          ),
        ]),
        m("p.lpc-credits-intro", [
          "License information for all spritesheets in this generator is available ",
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/raw/refs/heads/master/CREDITS.csv",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "here",
          ),
        ]),
        m(CreditsContent, { createModel: vnode.attrs.createModel }),
      ],
    );
  },
};

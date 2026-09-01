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
        m("p.has-text-grey", "Loading selections…"),
      );
    }
    if (model.kind === "empty") {
      return m("p.has-text-grey", "No items selected");
    }

    return [
      m(
        "div.content.has-background-light.p-3",
        model.credits.map((credit) =>
          m("div.mb-3", { key: credit.key }, [
            m("strong.is-size-6", credit.fileName),
            credit.notes ? m("p.is-size-7", credit.notes) : null,
            m("p.is-size-7", [
              m("strong", "Licenses: "),
              credit.licenses.join(", "),
            ]),
            m("p.is-size-7", [
              m("strong", "Authors: "),
              credit.authors.join(", "),
            ]),
          ]),
        ),
      ),
      m("div.buttons.mt-3", [
        m(
          "button.button.is-small",
          { onclick: model.downloadTxt },
          "Download TXT",
        ),
        m(
          "button.button.is-small",
          { onclick: model.downloadCsv },
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
        boxClass: "box",
        id: "credits-section",
      },
      [
        m("p.is-size-7.mb-2", [
          "You must credit the authors of this artwork. ",
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md",
              target: "_blank",
            },
            "Detailed attribution instructions",
          ),
        ]),
        m("p.is-size-7.mb-3", [
          "License information for all spritesheets in this generator is available ",
          m(
            "a",
            {
              href: "https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator/raw/refs/heads/master/CREDITS.csv",
              target: "_blank",
            },
            "here",
          ),
        ]),
        m(CreditsContent, { createModel: vnode.attrs.createModel }),
      ],
    );
  },
};

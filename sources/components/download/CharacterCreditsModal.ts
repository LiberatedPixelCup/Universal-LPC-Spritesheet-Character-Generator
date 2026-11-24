import m from "mithril";
import { DownloadDialog } from "./DownloadDialog.ts";
import type { CreditsModel } from "../../models/credits.ts";

export type CharacterCreditsModalAttrs = {
  createModel: () => CreditsModel;
  onClose: () => void;
};

export const CharacterCreditsModal: m.Component<CharacterCreditsModalAttrs> = {
  view(vnode) {
    const { createModel, onClose } = vnode.attrs;
    const model = createModel();

    return m(DownloadDialog, {
      titleId: "credits-dialog-title",
      onClose,
      renderCard: (close) =>
        m("div.modal-card.lpc-modal-card.lpc-credits-modal-card", [
          m("header.modal-card-head.lpc-modal-header", [
            m(
              "h3.modal-card-title#credits-dialog-title",
              "Character Credits & Attribution",
            ),
            m("button.delete", {
              type: "button",
              "aria-label": "Close credits dialog",
              onclick: close,
            }),
          ]),
          m("section.modal-card-body.lpc-modal-body", [
            m("p.lpc-credits-intro.mb-3", [
              "You must credit the authors of the artwork used in this character. ",
              m(
                "a",
                {
                  href: "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/blob/master/README.md",
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "Attribution Guidelines",
              ),
              m("span.lpc-sep", " · "),
              m(
                "a",
                {
                  href: "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator",
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "Original LPC Generator",
              ),
              m("span.lpc-sep", " · "),
              m(
                "a",
                {
                  href: "https://github.com/teakay1311/OpenSpritesheet",
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                "OpenSpritesheet GitHub",
              ),
            ]),
            model.kind === "loading" &&
              m(
                "div.loading-shell-credits",
                m("p.lpc-helper-text", "Loading credits…"),
              ),
            model.kind === "failed" &&
              m(
                "p.lpc-helper-text.is-danger",
                { role: "alert" },
                model.message,
              ),
            model.kind === "empty" &&
              m(
                "p.lpc-helper-text",
                "No items selected for current character.",
              ),
            model.kind === "ready" && [
              m(
                "div.content.lpc-credits-list.mb-4",
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
                  "button.button.is-small.is-primary.lpc-btn-primary",
                  { type: "button", onclick: model.downloadTxt },
                  "Download TXT",
                ),
                m(
                  "button.button.is-small",
                  { type: "button", onclick: model.downloadCsv },
                  "Download CSV",
                ),
              ]),
            ],
          ]),
          m("footer.modal-card-foot.lpc-modal-footer", [
            m(
              "button.button.is-small",
              {
                type: "button",
                onclick: close,
              },
              "Close",
            ),
          ]),
        ]),
    });
  },
};

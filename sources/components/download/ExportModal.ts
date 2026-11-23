import m from "mithril";
import type { State } from "../../state/state.ts";
import type { DownloadModel } from "../../models/download.ts";

export type ExportModalAttrs = {
  state: State;
  createModel: () => DownloadModel;
  onClose: () => void;
};

export const ExportModal: m.Component<ExportModalAttrs> = {
  view(vnode) {
    const { state, createModel, onClose } = vnode.attrs;
    const model = createModel();

    return m(
      "div.modal.is-active.lpc-modal",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "export-dialog-title",
      },
      [
        m("div.modal-background", { onclick: onClose }),
        m("div.modal-card.lpc-modal-card", [
          m("header.modal-card-head.lpc-modal-header", [
            m("h3.modal-card-title#export-dialog-title", "Export Spritesheet"),
            m("button.delete", {
              type: "button",
              "aria-label": "Close export dialog",
              onclick: onClose,
            }),
          ]),
          m("section.modal-card-body.lpc-modal-body", [
            m("div.lpc-export-section", [
              m("h4.title.is-6.mb-2", "Full Spritesheet"),
              m(
                "button.button.is-primary.lpc-btn-primary.is-fullwidth.mb-4",
                {
                  type: "button",
                  disabled: model.pngDisabled,
                  title: model.pngTitle,
                  onclick: () => {
                    model.saveSpritesheet();
                  },
                },
                "Spritesheet (PNG)",
              ),
            ]),
            m("div.lpc-export-section", [
              m("h4.title.is-6.mb-2", "ZIP Archives"),
              m("div.buttons.are-small.is-flex.is-flex-direction-column", [
                m(
                  "button.button.is-fullwidth.mb-2",
                  {
                    type: "button",
                    disabled: model.zipDisabled,
                    title: model.zipTitle,
                    onclick: async () => {
                      await model.exportZipByAnimation();
                    },
                  },
                  [
                    m("span", "ZIP: Split by animation"),
                    model.zipByAnimationRunning &&
                      m("span.loading.ml-2", { "aria-label": "Exporting" }),
                  ],
                ),
                m(
                  "button.button.is-fullwidth.mb-2",
                  {
                    type: "button",
                    disabled: model.zipDisabled,
                    title: model.zipTitle,
                    onclick: async () => {
                      await model.exportZipByItem();
                    },
                  },
                  [
                    m("span", "ZIP: Split by item"),
                    model.zipByItemRunning &&
                      m("span.loading.ml-2", { "aria-label": "Exporting" }),
                  ],
                ),
                m(
                  "button.button.is-fullwidth.mb-2",
                  {
                    type: "button",
                    disabled: model.zipDisabled,
                    title: model.zipTitle,
                    onclick: async () => {
                      await model.exportZipByAnimationAndItem();
                    },
                  },
                  [
                    m("span", "ZIP: Split by animation and item"),
                    model.zipByAnimationAndItemRunning &&
                      m("span.loading.ml-2", { "aria-label": "Exporting" }),
                  ],
                ),
                m(
                  "button.button.is-fullwidth.mb-2",
                  {
                    type: "button",
                    disabled: model.zipDisabled,
                    title: model.zipTitle,
                    onclick: async () => {
                      await model.exportZipByAnimationAndFrame();
                    },
                  },
                  [
                    m("span", "ZIP: Split by animation and frame"),
                    model.zipIndividualFramesRunning &&
                      m("span.loading.ml-2", { "aria-label": "Exporting" }),
                  ],
                ),
              ]),
            ]),
            state.lastRenderError &&
              m("div.notification.is-danger.is-light.py-2.px-3.mt-3", [
                m("strong", "Render Error: "),
                state.lastRenderError,
              ]),
            model.metadataError &&
              m(
                "p.lpc-helper-text.is-danger",
                { role: "alert" },
                model.metadataError,
              ),
            state.zipExportError &&
              m("div.notification.is-danger.is-light.py-2.px-3.mt-3", [
                m("strong", "Error: "),
                state.zipExportError,
              ]),
          ]),
          m("footer.modal-card-foot.lpc-modal-footer", [
            m(
              "button.button.is-small",
              {
                type: "button",
                onclick: onClose,
              },
              "Close",
            ),
          ]),
        ]),
      ],
    );
  },
};

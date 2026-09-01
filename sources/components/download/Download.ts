import m from "mithril";
import type {
  ClipboardCommandResult,
  DownloadModel,
} from "../../models/download.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";

function reportClipboardResult(
  result: ClipboardCommandResult,
  successMessage: string,
  errorLogMessage: string,
  failureMessage: string,
): void {
  if (result.kind === "success") {
    alert(successMessage);
  } else if (result.kind === "failure") {
    console.error(errorLogMessage, result.error);
    alert(failureMessage);
  }
}

const DownloadContent: m.Component<{
  createModel: () => DownloadModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return m(
      "div.buttons.is-flex.is-flex-wrap-wrap",
      { id: "download-buttons" },
      [
        m(
          "button.button.is-small.is-primary",
          { onclick: model.saveSpritesheet },
          "Spritesheet (PNG)",
        ),
        m(
          "button.button.is-small",
          { onclick: model.downloadCreditsTxt },
          "Credits (TXT)",
        ),
        m(
          "button.button.is-small",
          { onclick: model.downloadCreditsCsv },
          "Credits (CSV)",
        ),
        m(
          "button.button.is-small.is-info",
          {
            disabled: model.zipDisabled,
            title: model.zipTitle,
            onclick: model.exportZipByAnimation,
          },
          "ZIP: Split by animation",
        ),
        model.zipByAnimationRunning ? m("span.loading") : null,
        m(
          "button.button.is-small.is-info",
          {
            disabled: model.zipDisabled,
            title: model.zipTitle,
            onclick: model.exportZipByItem,
          },
          "ZIP: Split by item",
        ),
        model.zipByItemRunning ? m("span.loading") : null,
        m(
          "button.button.is-small.is-info",
          {
            disabled: model.zipDisabled,
            title: model.zipTitle,
            onclick: model.exportZipByAnimationAndItem,
          },
          "ZIP: Split by animation and item",
        ),
        model.zipByAnimationAndItemRunning ? m("span.loading") : null,
        m(
          "button.button.is-small.is-info",
          {
            disabled: model.zipDisabled,
            title: model.zipTitle,
            onclick: model.exportZipByAnimationAndFrame,
          },
          "ZIP: Split by animation and frame",
        ),
        model.zipIndividualFramesRunning ? m("span.loading") : null,
        m(
          "button.button.is-small.is-link",
          {
            onclick: async () =>
              reportClipboardResult(
                await model.exportJsonToClipboard(),
                "Exported to clipboard!",
                "Failed to copy to clipboard:",
                "Failed to copy to clipboard. Please check browser permissions.",
              ),
          },
          "Export to Clipboard (JSON)",
        ),
        m(
          "button.button.is-small.is-link",
          {
            onclick: async () =>
              reportClipboardResult(
                await model.importJsonFromClipboard(),
                "Imported successfully!",
                "Failed to import from clipboard:",
                "Failed to import. Please check clipboard content and browser permissions.",
              ),
          },
          "Import from Clipboard (JSON)",
        ),
      ],
    );
  },
};

export const Download: m.Component<{
  createModel: () => DownloadModel;
}> = {
  view(vnode) {
    return m(
      CollapsibleSection,
      { title: "Download", defaultOpen: true },
      m(DownloadContent, { createModel: vnode.attrs.createModel }),
    );
  },
};

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

function renderZipAction(
  label: string,
  disabled: boolean,
  title: string | undefined,
  running: boolean,
  onclick: () => Promise<void>,
) {
  return m("div.lpc-zip-action", [
    m(
      "button.button.is-small",
      {
        type: "button",
        disabled,
        title,
        onclick,
      },
      label,
    ),
    m(
      "span.lpc-action-status",
      { "aria-live": "polite" },
      running ? m("span.loading", { "aria-label": "Exporting ZIP" }) : null,
    ),
  ]);
}

const DownloadContent: m.Component<{
  createModel: () => DownloadModel;
}> = {
  view(vnode) {
    const model = vnode.attrs.createModel();
    return m("div.lpc-download-groups", { id: "download-buttons" }, [
      m("div.lpc-download-group.lpc-download-primary", [
        m("div.lpc-download-row", [
          m(
            "button.button.is-small.is-primary.lpc-btn-primary",
            { type: "button", onclick: model.saveSpritesheet },
            "Spritesheet (PNG)",
          ),
        ]),
      ]),
      m("div.lpc-download-group.lpc-download-zip", [
        m("span.lpc-group-label", "ZIP Exports"),
        m("div.lpc-zip-list", [
          renderZipAction(
            "ZIP: Split by animation",
            model.zipDisabled,
            model.zipTitle,
            model.zipByAnimationRunning,
            model.exportZipByAnimation,
          ),
          renderZipAction(
            "ZIP: Split by item",
            model.zipDisabled,
            model.zipTitle,
            model.zipByItemRunning,
            model.exportZipByItem,
          ),
          renderZipAction(
            "ZIP: Split by animation and item",
            model.zipDisabled,
            model.zipTitle,
            model.zipByAnimationAndItemRunning,
            model.exportZipByAnimationAndItem,
          ),
          renderZipAction(
            "ZIP: Split by animation and frame",
            model.zipDisabled,
            model.zipTitle,
            model.zipIndividualFramesRunning,
            model.exportZipByAnimationAndFrame,
          ),
        ]),
      ]),
      m("div.lpc-download-group.lpc-download-credits", [
        m("span.lpc-group-label", "Credits"),
        m("div.lpc-download-row", [
          m(
            "button.button.is-small",
            { type: "button", onclick: model.downloadCreditsTxt },
            "Credits (TXT)",
          ),
          m(
            "button.button.is-small",
            { type: "button", onclick: model.downloadCreditsCsv },
            "Credits (CSV)",
          ),
        ]),
      ]),
      m("div.lpc-download-group.lpc-download-json", [
        m("span.lpc-group-label", "Clipboard JSON"),
        m("div.lpc-download-row", [
          m(
            "button.button.is-small",
            {
              type: "button",
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
            "button.button.is-small",
            {
              type: "button",
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
        ]),
      ]),
    ]);
  },
};

export const Download: m.Component<{
  createModel: () => DownloadModel;
}> = {
  view(vnode) {
    return m(
      CollapsibleSection,
      {
        title: "Download",
        defaultOpen: true,
        boxClass: "box lpc-download-panel",
      },
      m(DownloadContent, { createModel: vnode.attrs.createModel }),
    );
  },
};

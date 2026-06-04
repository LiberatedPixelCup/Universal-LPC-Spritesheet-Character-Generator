// Download component
import m from "mithril";
import { state } from "../../state/state.ts";
import { drawCalls } from "../../canvas/renderer.ts";
import {
  getAllCredits,
  creditsToCsv,
  creditsToTxt,
} from "../../utils/credits.ts";
import { CollapsibleSection } from "../CollapsibleSection.ts";
import { downloadFile, downloadAsPNG } from "../../canvas/download.ts";
import {
  importStateFromJSON,
  exportStateAsJSON,
  serializeLayersForJson,
} from "../../state/json.ts";
import {
  exportSplitAnimations,
  exportSplitItemSheets,
  exportSplitItemAnimations,
  exportIndividualFrames,
} from "../../state/zip.ts";
import { debugLog } from "../../utils/debug.ts";
import type { CatalogReader } from "../../state/catalog.ts";

const zipExportTitle = "Wait for layer data to finish loading";

type DownloadAttrs = {
  catalog: Pick<CatalogReader, "isLayersReady">;
};

export const Download: m.Component<DownloadAttrs> = {
  view(vnode) {
    const zipDisabled = !vnode.attrs.catalog.isLayersReady();

    const exportToClipboard = async (): Promise<void> => {
      if (!window.canvasRenderer) return;
      try {
        const json = exportStateAsJSON(
          state,
          serializeLayersForJson(drawCalls),
        );
        debugLog(json);
        await navigator.clipboard.writeText(json);
        alert("Exported to clipboard!");
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        alert("Failed to copy to clipboard. Please check browser permissions.");
      }
    };

    const importFromClipboard = async (): Promise<void> => {
      if (!window.canvasRenderer) return;
      try {
        const json = await navigator.clipboard.readText();
        debugLog(json);
        const imported = importStateFromJSON(json);
        Object.assign(state, imported);

        m.redraw();
        alert("Imported successfully!");
      } catch (err) {
        console.error("Failed to import from clipboard:", err);
        alert(
          "Failed to import. Please check clipboard content and browser permissions.",
        );
      }
    };

    const saveAsPNG = () => {
      if (!window.canvasRenderer) return;
      downloadAsPNG("character-spritesheet.png");
    };

    return m(
      CollapsibleSection,
      {
        title: "Download",
        defaultOpen: true,
      },
      [
        m("div.buttons.is-flex.is-flex-wrap-wrap", { id: "download-buttons" }, [
          m(
            "button.button.is-small.is-primary",
            { onclick: saveAsPNG },
            "Spritesheet (PNG)",
          ),
          m(
            "button.button.is-small",
            {
              onclick: () => {
                const allCredits = getAllCredits(
                  state.selections,
                  state.bodyType,
                );
                const txtContent = creditsToTxt(allCredits);
                downloadFile(txtContent, "credits.txt", "text/plain");
              },
            },
            "Credits (TXT)",
          ),
          m(
            "button.button.is-small",
            {
              onclick: () => {
                const allCredits = getAllCredits(
                  state.selections,
                  state.bodyType,
                );
                const csvContent = creditsToCsv(allCredits);
                downloadFile(csvContent, "credits.csv", "text/csv");
              },
            },
            "Credits (CSV)",
          ),
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitAnimations,
            },
            "ZIP: Split by animation",
          ),
          state.zipByAnimation.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemSheets,
            },
            "ZIP: Split by item",
          ),
          state.zipByItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemAnimations,
            },
            "ZIP: Split by animation and item",
          ),
          state.zipByAnimationAndItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportIndividualFrames,
            },
            "ZIP: Split by animation and frame",
          ),
          state.zipIndividualFrames && state.zipIndividualFrames.isRunning
            ? m("span.loading")
            : null,
          m(
            "button.button.is-small.is-link",
            { onclick: exportToClipboard },
            "Export to Clipboard (JSON)",
          ),
          m(
            "button.button.is-small.is-link",
            { onclick: importFromClipboard },
            "Import from Clipboard (JSON)",
          ),
        ]),
      ],
    );
  },
};

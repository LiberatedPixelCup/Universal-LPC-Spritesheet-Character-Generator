// Download component
import m from "mithril";
import { applyCurrentLocale, state } from "../../state/state.ts";
import { layers } from "../../canvas/renderer.js";
import {
  getAllCredits,
  creditsToCsv,
  creditsToTxt,
} from "../../utils/credits.ts";
import { CollapsibleSection } from "../CollapsibleSection.js";
import { downloadFile, downloadAsPNG } from "../../canvas/download.js";
import { importStateFromJSON, exportStateAsJSON } from "../../state/json.js";
import {
  exportSplitAnimations,
  exportSplitItemSheets,
  exportSplitItemAnimations,
  exportIndividualFrames,
} from "../../state/zip.js";
import { debugLog } from "../../utils/debug.js";
import { isLayersReady } from "../../state/catalog.ts";
import { t } from "../../i18n/index.ts";

const zipExportDisabled = () => !isLayersReady();

export const Download = {
  view: function () {
    const zipDisabled = zipExportDisabled();
    const zipExportTitle = t("download.waitForLayerData");
    // Export to clipboard
    const exportToClipboard = async () => {
      if (!window.canvasRenderer) return;
      try {
        const json = exportStateAsJSON(state, layers);
        debugLog(json);
        await navigator.clipboard.writeText(json);
        alert(t("download.copied"));
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        alert(t("download.copyFailed"));
      }
    };

    // Import from clipboard
    const importFromClipboard = async () => {
      if (!window.canvasRenderer) return;
      try {
        const json = await navigator.clipboard.readText();
        debugLog(json);
        const imported = importStateFromJSON(json);
        Object.assign(state, imported);
        applyCurrentLocale();

        m.redraw(); // Force Mithril to update the UI
        alert(t("download.imported"));
      } catch (err) {
        console.error("Failed to import from clipboard:", err);
        alert(t("download.importFailed"));
      }
    };

    // Save as PNG
    const saveAsPNG = () => {
      if (!window.canvasRenderer) return;

      // Export offscreen canvas directly
      downloadAsPNG("character-spritesheet.png");
    };

    return m(
      CollapsibleSection,
      {
        title: t("download.title"),
        storageKey: "download",
        defaultOpen: true,
      },
      [
        m("div.buttons.is-flex.is-flex-wrap-wrap", { id: "download-buttons" }, [
          m(
            "button.button.is-small.is-primary",
            { onclick: saveAsPNG },
            t("download.spritesheetPng"),
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
            t("common.creditsTxt"),
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
            t("common.creditsCsv"),
          ),
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitAnimations,
            },
            t("download.splitByAnimation"),
          ),
          state.zipByAnimation.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemSheets,
            },
            t("download.splitByItem"),
          ),
          state.zipByItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemAnimations,
            },
            t("download.splitByAnimationAndItem"),
          ),
          state.zipByAnimimationAndItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportIndividualFrames,
            },
            t("download.splitByAnimationAndFrame"),
          ),
          state.zipIndividualFrames && state.zipIndividualFrames.isRunning
            ? m("span.loading")
            : null,
          m(
            "button.button.is-small.is-link",
            { onclick: exportToClipboard },
            t("download.exportJson"),
          ),
          m(
            "button.button.is-small.is-link",
            { onclick: importFromClipboard },
            t("download.importJson"),
          ),
        ]),
      ],
    );
  },
};

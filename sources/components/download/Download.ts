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
import { t } from "../../../lang/i18n.ts";

type DownloadAttrs = {
  catalog: Pick<CatalogReader, "isLayersReady">;
};

export const Download: m.Component<DownloadAttrs> = {
  view(vnode) {
    const zipDisabled = !vnode.attrs.catalog.isLayersReady();
    const zipExportTitle = t("download.waitLoading");

    const exportToClipboard = async (): Promise<void> => {
      if (!window.canvasRenderer) return;
      try {
        const json = exportStateAsJSON(
          state,
          serializeLayersForJson(drawCalls),
        );
        debugLog(json);
        await navigator.clipboard.writeText(json);
        alert(t("download.exportedSuccess"));
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        alert(t("download.exportFailed"));
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
        alert(t("download.importedSuccess"));
      } catch (err) {
        console.error("Failed to import from clipboard:", err);
        alert(t("download.importFailed"));
      }
    };

    const saveAsPNG = () => {
      if (!window.canvasRenderer) return;
      downloadAsPNG("character-spritesheet.png");
    };

    return m(
      CollapsibleSection,
      {
        title: t("download.title"),
        defaultOpen: true,
      },
      [
        m("div.buttons.is-flex.is-flex-wrap-wrap", { id: "download-buttons" }, [
          m(
            "button.button.is-small.is-primary",
            { onclick: saveAsPNG },
            t("download.spritesheet"),
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
            t("download.creditsTxt"),
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
            t("download.creditsCsv"),
          ),
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitAnimations,
            },
            t("download.zipByAnimation"),
          ),
          state.zipByAnimation.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemSheets,
            },
            t("download.zipByItem"),
          ),
          state.zipByItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportSplitItemAnimations,
            },
            t("download.zipByAnimationAndItem"),
          ),
          state.zipByAnimationAndItem.isRunning ? m("span.loading") : null,
          m(
            "button.button.is-small.is-info",
            {
              disabled: zipDisabled,
              title: zipDisabled ? zipExportTitle : undefined,
              onclick: exportIndividualFrames,
            },
            t("download.zipByAnimationAndFrame"),
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

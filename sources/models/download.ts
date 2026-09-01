import { downloadAsPNG, downloadFile } from "../canvas/download.ts";
import { drawCalls } from "../canvas/renderer.ts";
import type { CatalogReader } from "../state/catalog.ts";
import {
  exportStateAsJSON,
  importStateFromJSON,
  serializeLayersForJson,
} from "../state/json.ts";
import type { State } from "../state/state.ts";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../state/zip.ts";
import { creditsToCsv, creditsToTxt, getAllCredits } from "../utils/credits.ts";
import { debugLog } from "../utils/debug.ts";

export type ClipboardCommandResult =
  | { readonly kind: "success" }
  | { readonly kind: "failure"; readonly error: unknown }
  | { readonly kind: "unavailable" };

export type DownloadModel = {
  readonly zipDisabled: boolean;
  readonly zipTitle?: string;
  readonly zipByAnimationRunning: boolean;
  readonly zipByItemRunning: boolean;
  readonly zipByAnimationAndItemRunning: boolean;
  readonly zipIndividualFramesRunning: boolean;
  saveSpritesheet(): void;
  downloadCreditsTxt(): void;
  downloadCreditsCsv(): void;
  exportZipByAnimation(): Promise<void>;
  exportZipByItem(): Promise<void>;
  exportZipByAnimationAndItem(): Promise<void>;
  exportZipByAnimationAndFrame(): Promise<void>;
  exportJsonToClipboard(): Promise<ClipboardCommandResult>;
  importJsonFromClipboard(): Promise<ClipboardCommandResult>;
};

const zipExportTitle = "Wait for layer data to finish loading";

export const downloadModelFactory = {
  create(catalog: CatalogReader, state: State): DownloadModel {
    const zipDisabled = !catalog.isLayersReady();
    return {
      zipDisabled,
      zipTitle: zipDisabled ? zipExportTitle : undefined,
      zipByAnimationRunning: state.zipByAnimation.isRunning,
      zipByItemRunning: state.zipByItem.isRunning,
      zipByAnimationAndItemRunning: state.zipByAnimationAndItem.isRunning,
      zipIndividualFramesRunning: state.zipIndividualFrames.isRunning,
      saveSpritesheet() {
        if (!window.canvasRenderer) return;
        downloadAsPNG("character-spritesheet.png");
      },
      downloadCreditsTxt() {
        const credits = getAllCredits(
          catalog,
          state.selections,
          state.bodyType,
        );
        downloadFile(creditsToTxt(credits), "credits.txt", "text/plain");
      },
      downloadCreditsCsv() {
        const credits = getAllCredits(
          catalog,
          state.selections,
          state.bodyType,
        );
        downloadFile(creditsToCsv(credits), "credits.csv", "text/csv");
      },
      exportZipByAnimation: () => exportSplitAnimations(catalog, state),
      exportZipByItem: () => exportSplitItemSheets(catalog, state),
      exportZipByAnimationAndItem: () =>
        exportSplitItemAnimations(catalog, state),
      exportZipByAnimationAndFrame: () =>
        exportIndividualFrames(catalog, state),
      async exportJsonToClipboard() {
        if (!window.canvasRenderer) return { kind: "unavailable" };
        try {
          const json = exportStateAsJSON(
            catalog,
            state,
            serializeLayersForJson(drawCalls),
          );
          debugLog(json);
          await navigator.clipboard.writeText(json);
          return { kind: "success" };
        } catch (error) {
          return { kind: "failure", error };
        }
      },
      async importJsonFromClipboard() {
        if (!window.canvasRenderer) return { kind: "unavailable" };
        try {
          const json = await navigator.clipboard.readText();
          debugLog(json);
          Object.assign(state, importStateFromJSON(catalog, state, json));
          return { kind: "success" };
        } catch (error) {
          return { kind: "failure", error };
        }
      },
    };
  },
};

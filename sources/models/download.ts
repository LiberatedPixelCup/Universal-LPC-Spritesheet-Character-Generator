import m from "mithril";
import { downloadAsPNG, downloadFile } from "../canvas/download.ts";
import { drawCalls } from "../canvas/renderer.ts";
import {
  getCatalogFailure,
  type CatalogReader,
  type ChunkName,
} from "../state/catalog.ts";
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
  | {
      readonly kind: "failure";
      readonly error: unknown;
      readonly message?: string;
    }
  | { readonly kind: "unavailable"; readonly message?: string };

export type DownloadModel = {
  readonly pngDisabled: boolean;
  readonly pngTitle?: string;
  readonly zipDisabled: boolean;
  readonly zipTitle?: string;
  readonly creditsDisabled?: boolean;
  readonly creditsTitle?: string;
  readonly copyTitle?: string;
  readonly importTitle?: string;
  readonly metadataError?: string;
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

const importChunks = ["index", "lite"] as const;
const imageChunks = [...importChunks, "layers"] as const;
const creditChunks = [...imageChunks, "credits"] as const;
const renderWaiting = "Wait for character rendering to complete";
const zipBusy = "Export currently in progress";

type ActionBlock = { kind: "failed" | "waiting"; message: string };

function metadataBlock(
  catalog: CatalogReader,
  chunks: readonly ChunkName[],
  waiting: string,
): ActionBlock | undefined {
  const failure = getCatalogFailure(catalog, ...chunks);
  if (failure) {
    return { kind: "failed", message: failure };
  }
  if (chunks.some((chunk) => catalog.chunkReady(chunk).isErr())) {
    return { kind: "waiting", message: waiting };
  }
  return undefined;
}

export function getImageExportBlock(
  catalog: CatalogReader,
  state: State,
): ActionBlock | undefined {
  const metadata = metadataBlock(
    catalog,
    imageChunks,
    "Wait for layer data to finish loading",
  );
  if (metadata?.kind === "failed") return metadata;
  if (state.isExportingZip) return { kind: "waiting", message: zipBusy };
  if (state.pendingCharacterRender || state.isRenderingCharacter) {
    return { kind: "waiting", message: renderWaiting };
  }
  if (state.lastRenderError) {
    return {
      kind: "failed",
      message: `Character render failed: ${state.lastRenderError}`,
    };
  }
  if (metadata) return metadata;

  const rendered = state.renderedCharacter;
  if (
    !state.canvasReadyForExport ||
    (rendered &&
      (rendered.selections !== JSON.stringify(state.selections) ||
        rendered.bodyType !== state.bodyType ||
        rendered.customImage !== state.customUploadedImage ||
        rendered.customZPos !== state.customImageZPos ||
        rendered.matchBodyColorEnabled !== state.matchBodyColorEnabled))
  )
    return { kind: "waiting", message: renderWaiting };
  return undefined;
}

function getCreditsBlock(catalog: CatalogReader): ActionBlock | undefined {
  return metadataBlock(
    catalog,
    creditChunks,
    "Wait for credits data to finish loading",
  );
}

function getArchiveBlock(
  catalog: CatalogReader,
  state: State,
): ActionBlock | undefined {
  const image = getImageExportBlock(catalog, state);
  if (image?.kind === "failed") return image;
  const credits = getCreditsBlock(catalog);
  return credits?.kind === "failed" ? credits : (image ?? credits);
}

function getImportBlock(
  catalog: CatalogReader,
  state: State,
): ActionBlock | undefined {
  const metadata = metadataBlock(
    catalog,
    importChunks,
    "Wait for item data to finish loading",
  );
  return (
    metadata ??
    (state.isExportingZip ? { kind: "waiting", message: zipBusy } : undefined)
  );
}

function blockedClipboard(block: ActionBlock): ClipboardCommandResult {
  return block.kind === "failed"
    ? {
        kind: "failure",
        error: new Error(block.message),
        message: block.message,
      }
    : { kind: "unavailable", message: block.message };
}

export const downloadModelFactory = {
  create(catalog: CatalogReader, state: State): DownloadModel {
    const image = getImageExportBlock(catalog, state);
    const archive = getArchiveBlock(catalog, state);
    const credits = getCreditsBlock(catalog);
    const importBlock = getImportBlock(catalog, state);

    async function exportZip(
      run: (catalog: CatalogReader, state: State) => Promise<void>,
    ) {
      if (!getArchiveBlock(catalog, state)) await run(catalog, state);
    }

    return {
      pngDisabled: Boolean(image),
      pngTitle: image?.message,
      zipDisabled: Boolean(archive),
      zipTitle: archive?.message,
      creditsDisabled: Boolean(credits),
      creditsTitle: credits?.message,
      copyTitle: archive?.message,
      importTitle: importBlock?.message,
      metadataError: getCatalogFailure(catalog, ...creditChunks),
      zipByAnimationRunning: state.zipByAnimation.isRunning,
      zipByItemRunning: state.zipByItem.isRunning,
      zipByAnimationAndItemRunning: state.zipByAnimationAndItem.isRunning,
      zipIndividualFramesRunning: state.zipIndividualFrames.isRunning,
      saveSpritesheet() {
        if (!window.canvasRenderer || getImageExportBlock(catalog, state))
          return;
        state.zipExportError = null;
        void downloadAsPNG("character-spritesheet.png").then((ok) => {
          if (!ok) {
            state.zipExportError = "Failed to export spritesheet PNG.";
            m.redraw();
          }
        });
      },
      downloadCreditsTxt() {
        if (getCreditsBlock(catalog)) return;
        const credits = getAllCredits(
          catalog,
          state.selections,
          state.bodyType,
        );
        downloadFile(creditsToTxt(credits), "credits.txt", "text/plain");
      },
      downloadCreditsCsv() {
        if (getCreditsBlock(catalog)) return;
        const credits = getAllCredits(
          catalog,
          state.selections,
          state.bodyType,
        );
        downloadFile(creditsToCsv(credits), "credits.csv", "text/csv");
      },
      exportZipByAnimation: () => exportZip(exportSplitAnimations),
      exportZipByItem: () => exportZip(exportSplitItemSheets),
      exportZipByAnimationAndItem: () => exportZip(exportSplitItemAnimations),
      exportZipByAnimationAndFrame: () => exportZip(exportIndividualFrames),
      async exportJsonToClipboard() {
        if (!window.canvasRenderer) return { kind: "unavailable" };
        const block = getArchiveBlock(catalog, state);
        if (block) return blockedClipboard(block);
        try {
          const json = exportStateAsJSON(
            catalog,
            state,
            serializeLayersForJson(drawCalls),
          );
          debugLog(json);
          if (window.electronAPI?.writeClipboardText) {
            await window.electronAPI.writeClipboardText(json);
          } else {
            await navigator.clipboard.writeText(json);
          }
          return { kind: "success" };
        } catch (error) {
          return { kind: "failure", error };
        }
      },
      async importJsonFromClipboard() {
        if (!window.canvasRenderer) return { kind: "unavailable" };
        const block = getImportBlock(catalog, state);
        if (block) return blockedClipboard(block);
        try {
          const json = window.electronAPI?.readClipboardText
            ? await window.electronAPI.readClipboardText()
            : await navigator.clipboard.readText();
          const currentBlock = getImportBlock(catalog, state);
          if (currentBlock) return blockedClipboard(currentBlock);
          debugLog(json);
          const imported = importStateFromJSON(catalog, state, json);
          Object.assign(state, imported);
          return { kind: "success" };
        } catch (error) {
          return { kind: "failure", error };
        }
      },
    };
  },
};

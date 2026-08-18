/**
 * Browser harness for `scripts/zip/zip-export-profile.ts`.
 * Loads selections from the URL hash (see `zip-profile-default-hash.ts`) so
 * layered gear and custom sprites are present; runs ZIP export(s) with real
 * canvas + optional real JSZip.
 *
 * Query: `only=splitAnimations` | `splitItemSheets` | `splitItemAnimations` | `individualFrames`
 * — omit to run all four. `quick=1` uses fake JSZip.
 *
 * @see scripts/zip/zip-export-profile.ts
 */

import {
  initCanvas,
  canvas as rendererCanvas,
  drawCalls,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  renderCharacter,
} from "../../sources/canvas/renderer.ts";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../../sources/state/zip.ts";
import {
  loadSelectionsFromHash,
  resetState,
} from "../../sources/state/hash.ts";
import { configureStateCatalog, state } from "../../sources/state/state.ts";
import {
  createCatalog,
  type AliasMetadata,
  type CategoryTree,
  type MetadataIndexes,
  type PaletteMetadata,
} from "../../sources/state/catalog.ts";
import type { ZipFolder } from "../../sources/utils/zip-helpers.ts";
import type { ZipExportProfilerMetadata } from "../../sources/performance-profiler.ts";
import { ZIP_PROFILE_DEFAULT_HASH } from "./zip-profile-default-hash.ts";

export const ZIP_PROFILE_EXPORT_KINDS = [
  "splitAnimations",
  "splitItemSheets",
  "splitItemAnimations",
  "individualFrames",
] as const;

type ZipProfileExportKind = (typeof ZIP_PROFILE_EXPORT_KINDS)[number];

type ZipProfileWindow = Window & {
  itemMetadata?: Record<string, unknown>;
  aliasMetadata?: AliasMetadata;
  categoryTree?: CategoryTree;
  metadataIndexes?: MetadataIndexes;
  paletteMetadata?: PaletteMetadata;
  __zipExportProfiles?: Record<string, ZipExportProfilerMetadata>;
  __lastZipExportProfile?: ZipExportProfilerMetadata;
};

function resolveProfileHashString(): string {
  const fromUrl = window.location.hash?.replace(/^#/, "")?.trim();
  if (fromUrl) {
    return fromUrl;
  }
  const opts = window.__ZIP_PROFILE_OPTS__;
  if (opts?.profileHash) {
    return opts.profileHash;
  }
  return ZIP_PROFILE_DEFAULT_HASH;
}

async function runProfiles(
  opts: {
    useRealJsZip?: boolean;
    only?: string | null;
  } = {},
): Promise<{
  profiles: Record<string, ZipExportProfilerMetadata>;
  selectionLabel: string;
  useRealJsZip: boolean;
  only: string;
}> {
  const useRealJsZip = opts.useRealJsZip ?? true;
  const only = opts.only ?? null;

  if (
    only !== null &&
    !(ZIP_PROFILE_EXPORT_KINDS as readonly string[]).includes(only)
  ) {
    throw new Error(
      `Invalid only=${JSON.stringify(only)}; expected one of: ${ZIP_PROFILE_EXPORT_KINDS.join(", ")}`,
    );
  }

  const run = (kind: ZipProfileExportKind) => only === null || only === kind;

  const w = window as ZipProfileWindow;
  if (
    !w.itemMetadata ||
    !w.aliasMetadata ||
    !w.categoryTree ||
    !w.metadataIndexes ||
    !w.paletteMetadata
  ) {
    throw new Error("Profile runner missing catalog metadata globals");
  }

  const catalog = createCatalog();
  catalog.loadCatalogFromFixtures({
    itemMetadata: w.itemMetadata,
    aliasMetadata: w.aliasMetadata,
    categoryTree: w.categoryTree,
    metadataIndexes: w.metadataIndexes,
    paletteMetadata: w.paletteMetadata,
  });
  configureStateCatalog(catalog);

  resetState();
  drawCalls.length = 0;

  loadSelectionsFromHash(catalog, resolveProfileHashString());

  window.alert = () => {};
  if (window.m?.redraw) {
    window.m.redraw = (() => {}) as typeof window.m.redraw;
  }

  const origCreateEl = document.createElement.bind(document);
  document.createElement = function (
    tag: string,
    options?: ElementCreationOptions,
  ) {
    if (tag === "a") {
      const el = origCreateEl.call(document, "a");
      el.click = () => {};
      return el;
    }
    return origCreateEl.call(document, tag, options);
  } as typeof document.createElement;
  const origCreateURL = URL.createObjectURL;
  const origRevokeURL = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:url";
  URL.revokeObjectURL = () => {};

  w.__zipExportProfiles = {};
  w.__lastZipExportProfile = undefined;

  window.canvasRenderer = {} as NonNullable<Window["canvasRenderer"]>;

  const RealJSZip = window.JSZip;
  if (!useRealJsZip) {
    const { createFakeJSZip } =
      await import("../../tests/helpers/fake-jszip.js");
    window.JSZip = function FakeJSZip() {
      return createFakeJSZip();
    } as unknown as new () => ZipFolder;
  }

  initCanvas();
  if (!rendererCanvas) {
    throw new Error("Canvas not initialized");
  }
  const ctx = rendererCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d context not available");
  }
  ctx.fillStyle = "#445566";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  await renderCharacter(catalog, state.selections, state.bodyType);

  if (run("splitAnimations")) {
    await exportSplitAnimations(catalog);
    state.zipByAnimation.isRunning = false;
  }

  if (run("splitItemSheets")) {
    await exportSplitItemSheets(catalog);
    state.zipByItem.isRunning = false;
  }

  if (run("splitItemAnimations")) {
    await exportSplitItemAnimations(catalog);
    state.zipByAnimationAndItem.isRunning = false;
  }

  if (run("individualFrames")) {
    await exportIndividualFrames(catalog);
    if (state.zipIndividualFrames) {
      state.zipIndividualFrames.isRunning = false;
    }
  }

  delete window.canvasRenderer;
  if (!useRealJsZip) {
    window.JSZip = RealJSZip;
  }
  document.createElement = origCreateEl;
  URL.createObjectURL = origCreateURL;
  URL.revokeObjectURL = origRevokeURL;

  const profiles = w.__zipExportProfiles || {};
  return {
    profiles,
    selectionLabel: "zip-profile-default-hash.js",
    useRealJsZip,
    only: only === null ? "all" : only,
  };
}

window.__ZIP_PROFILE_DATA__ = null;
window.__ZIP_PROFILE_READY__ = false;
window.__ZIP_PROFILE_ERROR__ = null;

const injected = window.__ZIP_PROFILE_OPTS__;
const params = new URLSearchParams(window.location.search);
const quick = injected
  ? injected.quick
  : params.get("quick") === "1" || params.get("quick") === "true";
const onlyParam = params.get("only");
const onlyFromUrl =
  onlyParam && onlyParam.trim() !== "" ? onlyParam.trim() : null;
const only = injected ? injected.only : onlyFromUrl;

runProfiles({ useRealJsZip: !quick, only })
  .then((data) => {
    window.__ZIP_PROFILE_DATA__ = data;
    window.__ZIP_PROFILE_READY__ = true;
    const el = document.getElementById("status");
    if (el) el.textContent = "Done (ZIP export profiling).";
  })
  .catch((err: unknown) => {
    window.__ZIP_PROFILE_ERROR__ =
      err instanceof Error ? String(err.stack || err) : String(err);
    window.__ZIP_PROFILE_READY__ = true;
    const el = document.getElementById("status");
    if (el) el.textContent = `Error: ${window.__ZIP_PROFILE_ERROR__}`;
    console.error(err);
  });

/* eslint-disable no-undef -- browser harness (window, document, m) */

/**
 * Browser harness for `scripts/zip/zip-export-profile.js`.
 * Loads selections from the URL hash (see `zip-profile-default-hash.js`) so
 * layered gear and custom sprites are present; runs ZIP export(s) with real
 * canvas + optional real JSZip.
 *
 * Query: `only=splitAnimations` | `splitItemSheets` | `splitItemAnimations` | `individualFrames`
 * — omit to run all four. `quick=1` uses fake JSZip.
 *
 * @see scripts/zip/zip-export-profile.js
 */

import {
  initCanvas,
  canvas as rendererCanvas,
  layers,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  renderCharacter,
} from "../../sources/canvas/renderer.js";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../../sources/state/zip.js";
import {
  loadSelectionsFromHash,
  resetState,
} from "../../sources/state/hash.js";
import { state } from "../../sources/state/state.js";
import { ZIP_PROFILE_DEFAULT_HASH } from "./zip-profile-default-hash.js";

/** @type {readonly string[]} */
export const ZIP_PROFILE_EXPORT_KINDS = [
  "splitAnimations",
  "splitItemSheets",
  "splitItemAnimations",
  "individualFrames",
];

function resolveProfileHashString() {
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

/**
 * @param {{ useRealJsZip?: boolean }} opts
 * @param {string | null} [opts.only] — one of {@link ZIP_PROFILE_EXPORT_KINDS}, or null for all
 */
async function runProfiles(opts = {}) {
  /** @type {boolean} — default true; pass `false` for fake JSZip (quick mode). */
  const useRealJsZip = opts.useRealJsZip ?? true;
  const only = opts.only ?? null;

  if (only !== null && !ZIP_PROFILE_EXPORT_KINDS.includes(only)) {
    throw new Error(
      `Invalid only=${JSON.stringify(only)}; expected one of: ${ZIP_PROFILE_EXPORT_KINDS.join(", ")}`,
    );
  }

  const run = (kind) => only === null || only === kind;

  resetState();
  layers.length = 0;

  loadSelectionsFromHash(resolveProfileHashString());

  window.alert = () => {};
  if (typeof m !== "undefined" && m.redraw) {
    m.redraw = () => {};
  }

  const origCreateEl = document.createElement;
  document.createElement = function (tag) {
    if (tag === "a") {
      const el = origCreateEl.call(document, "a");
      el.click = () => {};
      return el;
    }
    return origCreateEl.call(document, tag);
  };
  const origCreateURL = URL.createObjectURL;
  const origRevokeURL = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:url";
  URL.revokeObjectURL = () => {};

  window.__zipExportProfiles = {};
  window.__lastZipExportProfile = undefined;

  window.canvasRenderer = {};

  const RealJSZip = window.JSZip;
  if (!useRealJsZip) {
    const { createFakeJSZip } =
      await import("../../tests/helpers/fake-jszip.js");
    window.JSZip = function FakeJSZip() {
      return createFakeJSZip();
    };
  }

  initCanvas();
  const ctx = rendererCanvas.getContext("2d");
  ctx.fillStyle = "#445566";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  await renderCharacter(state.selections, state.bodyType);

  if (run("splitAnimations")) {
    await exportSplitAnimations();
    state.zipByAnimation.isRunning = false;
  }

  if (run("splitItemSheets")) {
    await exportSplitItemSheets();
    state.zipByItem.isRunning = false;
  }

  if (run("splitItemAnimations")) {
    await exportSplitItemAnimations();
    state.zipByAnimimationAndItem.isRunning = false;
  }

  if (run("individualFrames")) {
    await exportIndividualFrames();
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

  const profiles = window.__zipExportProfiles || {};
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
  .catch((err) => {
    window.__ZIP_PROFILE_ERROR__ = String(err?.stack || err);
    window.__ZIP_PROFILE_READY__ = true;
    const el = document.getElementById("status");
    if (el) el.textContent = `Error: ${window.__ZIP_PROFILE_ERROR__}`;
    console.error(err);
  });

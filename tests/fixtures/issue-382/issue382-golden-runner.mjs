/**
 * Browser harness used only by scripts/issue382-golden-playwright.mjs (fixture-builder).
 * The HTML page sets `<base href="/">` so relative `spritesheets/...` URLs resolve like
 * `tests_run.html` even though this file lives under `tests/fixtures/issue-382/`.
 *
 * @see scripts/fixture-builder.js
 * @see scripts/issue382-golden-playwright.mjs
 * @see issue382-golden-runner.html
 */

import {
  initCanvas,
  canvas as rendererCanvas,
  layers,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  renderCharacter,
} from "../../../sources/canvas/renderer.js";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../../../sources/state/zip.js";
import { resetState } from "../../../sources/state/hash.js";
import { state } from "../../../sources/state/state.js";
import { importStateFromJSON } from "../../../sources/state/json.js";
import issue382ItemMetadata from "./issue-382-itemdata.js";
import issue382Selections from "./issue-382-selections.js";
import { createFakeJSZip, sortedZipKeys } from "../../helpers/fake-jszip.js";

let fakeZip;

async function runGoldens() {
  resetState();
  layers.length = 0;

  window.itemMetadata = {
    ...(window.itemMetadata || {}),
    ...issue382ItemMetadata,
  };

  Object.assign(state, importStateFromJSON(JSON.stringify(issue382Selections)));

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

  window.canvasRenderer = {};
  window.JSZip = function FakeJSZip() {
    fakeZip = createFakeJSZip();
    return fakeZip;
  };

  initCanvas();
  const ctx = rendererCanvas.getContext("2d");
  ctx.fillStyle = "#445566";
  ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

  await renderCharacter(state.selections, state.bodyType);

  const out = {};

  await exportSplitAnimations();
  out.splitAnimations = sortedZipKeys(fakeZip);
  state.zipByAnimation.isRunning = false;

  await exportSplitItemSheets();
  out.splitItemSheets = sortedZipKeys(fakeZip);
  state.zipByItem.isRunning = false;

  await exportSplitItemAnimations();
  out.splitItemAnimations = sortedZipKeys(fakeZip);
  state.zipByAnimimationAndItem.isRunning = false;

  await exportIndividualFrames();
  out.individualFrames = sortedZipKeys(fakeZip);
  if (state.zipIndividualFrames) {
    state.zipIndividualFrames.isRunning = false;
  }

  delete window.canvasRenderer;
  delete window.JSZip;
  document.createElement = origCreateEl;
  URL.createObjectURL = origCreateURL;
  URL.revokeObjectURL = origRevokeURL;

  return out;
}

window.__ISSUE382_GOLDEN__ = null;
window.__ISSUE382_GOLDEN_READY__ = false;
window.__ISSUE382_GOLDEN_ERROR__ = null;

runGoldens()
  .then((goldens) => {
    window.__ISSUE382_GOLDEN__ = goldens;
    window.__ISSUE382_GOLDEN_READY__ = true;
    const el = document.getElementById("status");
    if (el) el.textContent = "Done (issue #382 golden paths).";
  })
  .catch((err) => {
    window.__ISSUE382_GOLDEN_ERROR__ = String(err?.stack || err);
    window.__ISSUE382_GOLDEN_READY__ = true;
    const el = document.getElementById("status");
    if (el) el.textContent = `Error: ${window.__ISSUE382_GOLDEN_ERROR__}`;
    console.error(err);
  });

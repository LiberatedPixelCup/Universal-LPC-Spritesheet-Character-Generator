/**
 * Browser harness used only by scripts/issue382-golden-playwright.js (fixture-builder).
 * The HTML page sets `<base href="/">` so relative `spritesheets/...` URLs resolve like
 * `tests_run.html` even though this file lives under `tests/fixtures/issue-382/`.
 *
 * @see scripts/fixture-builder.js
 * @see scripts/issue382-golden-playwright.js
 * @see issue382-golden-runner.html
 */

import {
  initCanvas,
  canvas as rendererCanvas,
  drawCalls,
  SHEET_HEIGHT,
  SHEET_WIDTH,
  renderCharacter,
} from "../../../sources/canvas/renderer.ts";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../../../sources/state/zip.ts";
import { resetState } from "../../../sources/state/hash.ts";
import { state } from "../../../sources/state/state.ts";
import { defaultCatalog } from "../../../sources/state/catalog.ts";
import { importStateFromJSON } from "../../../sources/state/json.ts";
import issue382ItemMetadata from "./issue-382-itemdata.js";
import issue382Selections from "./issue-382-selections.js";
import { createFakeJSZip, sortedZipKeys } from "../../helpers/fake-jszip.js";
import { seedBrowserCatalogMergedOnDist } from "../../browser-catalog-fixture.js";

let fakeZip;

function setStatus(text) {
  window.__ISSUE382_GOLDEN_STATUS__ = text;
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

async function runGoldens() {
  setStatus("Resetting state...");
  resetState();
  drawCalls.length = 0;

  setStatus("Seeding browser catalog...");
  await seedBrowserCatalogMergedOnDist(issue382ItemMetadata);

  setStatus("Importing selections...");
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

  setStatus("Rendering character...");
  await renderCharacter(defaultCatalog, state.selections, state.bodyType);

  const out = {};

  setStatus("Exporting split animations...");
  await exportSplitAnimations(defaultCatalog);
  out.splitAnimations = sortedZipKeys(fakeZip);
  state.zipByAnimation.isRunning = false;

  setStatus("Exporting split item sheets...");
  await exportSplitItemSheets(defaultCatalog);
  out.splitItemSheets = sortedZipKeys(fakeZip);
  state.zipByItem.isRunning = false;

  setStatus("Exporting split item animations...");
  await exportSplitItemAnimations(defaultCatalog);
  out.splitItemAnimations = sortedZipKeys(fakeZip);
  state.zipByAnimationAndItem.isRunning = false;

  setStatus("Exporting individual frames...");
  await exportIndividualFrames(defaultCatalog);
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
window.__ISSUE382_GOLDEN_STATUS__ = "Booting golden runner...";

runGoldens()
  .then((goldens) => {
    window.__ISSUE382_GOLDEN__ = goldens;
    window.__ISSUE382_GOLDEN_READY__ = true;
    setStatus("Done (issue #382 golden paths).");
  })
  .catch((err) => {
    window.__ISSUE382_GOLDEN_ERROR__ = String(err?.stack || err);
    window.__ISSUE382_GOLDEN_READY__ = true;
    setStatus(`Error: ${window.__ISSUE382_GOLDEN_ERROR__}`);
    console.error(err);
  });

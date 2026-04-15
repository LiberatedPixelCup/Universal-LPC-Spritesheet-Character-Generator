/**
 * Regression: ZIP export folder/file layout for a fixed character (issue #382).
 *
 * Fixtures live under `tests/fixtures/` (`issue-382-*.js`). Regenerate everything with:
 *   node scripts/fixture-builder.js path/to/exported-selections.json
 *
 * Golden zip path lists (`issue-382-zip-paths-*.js`) are captured in headless Chromium
 * via `issue382-golden-runner.html` (see `scripts/fixture-builder.js`).
 *
 * @see scripts/fixture-builder.js
 * @see scripts/issue382-golden-playwright.mjs
 * @see issue382-golden-runner.html
 */

import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
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
import { resetState } from "../../sources/state/hash.js";
import { state } from "../../sources/state/state.js";
import { importStateFromJSON } from "../../sources/state/json.js";
import issue382ItemMetadata from "../fixtures/issue-382/issue-382-itemdata.js";
import issue382Selections from "../fixtures/issue-382/issue-382-selections.js";
import { paths as issue382ZipPathsSplitAnimations } from "../fixtures/issue-382/issue-382-zip-paths-split-animations.js";
import { paths as issue382ZipPathsSplitItemSheets } from "../fixtures/issue-382/issue-382-zip-paths-split-item-sheets.js";
import { paths as issue382ZipPathsSplitItemAnimations } from "../fixtures/issue-382/issue-382-zip-paths-split-item-animations.js";
import { paths as issue382ZipPathsIndividualFrames } from "../fixtures/issue-382/issue-382-zip-paths-individual-frames.js";
import { createFakeJSZip, sortedZipKeys } from "../helpers/fake-jszip.js";

function applyImportedStateFromFixture() {
  Object.assign(state, importStateFromJSON(JSON.stringify(issue382Selections)));
}

describe("state/zip.js issue #382 regression (longsword + full outfit)", () => {
  let sandbox;
  let fakeZip;
  let alertStub;
  let origItemMetadata;

  beforeEach(async () => {
    resetState();
    layers.length = 0;

    origItemMetadata = window.itemMetadata;
    window.itemMetadata = {
      ...(window.itemMetadata || {}),
      ...issue382ItemMetadata,
    };

    applyImportedStateFromFixture();

    sandbox = sinon.createSandbox();
    window.canvasRenderer = {};
    window.JSZip = function FakeJSZip() {
      fakeZip = createFakeJSZip();
      return fakeZip;
    };

    sandbox.stub(URL, "createObjectURL").returns("blob:url");
    sandbox.stub(URL, "revokeObjectURL");
    const origCreate = document.createElement.bind(document);
    sandbox.stub(document, "createElement").callsFake((tag) => {
      if (tag === "a") {
        const el = origCreate("a");
        el.click = sandbox.stub();
        return el;
      }
      return origCreate(tag);
    });
    alertStub = sandbox.stub(window, "alert");
    if (typeof m !== "undefined" && m.redraw) {
      sandbox.stub(m, "redraw");
    }

    initCanvas();
    const ctx = rendererCanvas.getContext("2d");
    ctx.fillStyle = "#445566";
    ctx.fillRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);

    await renderCharacter(state.selections, state.bodyType);
  });

  afterEach(() => {
    sandbox.restore();
    delete window.canvasRenderer;
    delete window.JSZip;
    window.itemMetadata = origItemMetadata;
    state.zipByAnimation.isRunning = false;
    state.zipByItem.isRunning = false;
    state.zipByAnimimationAndItem.isRunning = false;
    if (state.zipIndividualFrames) {
      state.zipIndividualFrames.isRunning = false;
    }
  });

  it("exportSplitAnimations creates the expected zip paths", async () => {
    await exportSplitAnimations();
    expect(sortedZipKeys(fakeZip)).to.deep.equal(
      [...issue382ZipPathsSplitAnimations].sort(),
    );
    expect(alertStub.calledWith("Export complete!")).to.be.true;
  });

  it("exportSplitItemSheets creates the expected zip paths", async () => {
    await exportSplitItemSheets();
    expect(sortedZipKeys(fakeZip)).to.deep.equal(
      [...issue382ZipPathsSplitItemSheets].sort(),
    );
    expect(alertStub.calledWith("Export complete!")).to.be.true;
  });

  it("exportSplitItemAnimations creates the expected zip paths (custom folders include standard layers)", async () => {
    await exportSplitItemAnimations();
    expect(sortedZipKeys(fakeZip)).to.deep.equal(
      [...issue382ZipPathsSplitItemAnimations].sort(),
    );
    expect(alertStub.calledWith("Export complete!")).to.be.true;

    const slashFolder = [...fakeZip.files.keys()].filter((k) =>
      k.startsWith("custom/slash_oversize/"),
    );
    expect(slashFolder.length).to.be.at.least(2);
  });

  it("exportIndividualFrames creates the expected zip paths (golden list)", async () => {
    await exportIndividualFrames();
    expect(sortedZipKeys(fakeZip)).to.deep.equal(
      [...issue382ZipPathsIndividualFrames].sort(),
    );
    expect(alertStub.calledWith("Individual frames export complete!")).to.be
      .true;
  });
});

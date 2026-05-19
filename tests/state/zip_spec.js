import { expect } from "chai";
import sinon from "sinon";
import { ok } from "neverthrow";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  initCanvas,
  canvas as rendererCanvas,
  drawCalls,
  SHEET_WIDTH,
  SHEET_HEIGHT,
  renderCharacter,
} from "../../sources/canvas/renderer.ts";
import {
  addAnimationSliceToZip,
  addCanvasToZip,
  addStandardAnimationToZipCustomFolder,
} from "../../sources/utils/zip-helpers.ts";
import { getItemFileName } from "../../sources/utils/fileName.ts";
import { getSortedLayers } from "../../sources/state/meta.ts";
import {
  exportIndividualFrames,
  exportSplitAnimations,
  exportSplitItemAnimations,
  exportSplitItemSheets,
} from "../../sources/state/zip.ts";
import { resetState } from "../../sources/state/hash.ts";
import { state } from "../../sources/state/state.ts";
import { ANIMATIONS, DIRECTIONS } from "../../sources/state/constants.ts";
import { createFakeJSZip } from "../helpers/fake-jszip.js";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalogMergedOnDist,
} from "../browser-catalog-fixture.js";

/**
 * `noExport` on an entry in ANIMATIONS is handled differently per export:
 * - `exportSplitItemAnimations` skips `anim.noExport` (no `standard/<anim>/` tree for that id).
 * - `exportSplitAnimations` and `exportIndividualFrames` iterate every ANIMATIONS entry and do not
 *   skip `noExport` (e.g. `watering`, `1h_slash` are still exported).
 * It is unclear whether `noExport` should be applied consistently across all ZIP exports; for now
 * tests document the current behavior above.
 */

/** Minimal metadata so getSortedLayers / getItemFileName work when global itemMetadata was cleared by other specs. */
const ZIP_SPEC_ITEM_METADATA = {
  body: {
    name: "Body Color",
    type_name: "body",
    required: ["male", "female", "teen", "child", "muscular", "pregnant"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 10,
        male: "body/bodies/male/",
      },
    },
  },
  heads_human_male: {
    name: "Human Male",
    type_name: "head",
    required: ["male", "female", "teen", "muscular", "pregnant"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 100,
        male: "head/heads/human/male/",
      },
    },
  },
  longsword: {
    name: "Longsword",
    type_name: "weapon",
    required: ["male", "female", "teen", "muscular", "pregnant"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        custom_animation: "walk_128",
        zPos: 140,
        male: "weapon/sword/longsword_alt/walk/",
      },
    },
  },
};

/**
 * Item whose layers are exclusively custom_animation (no standard sheet rows).
 * LiberatedPixelCup#364 / PR "Fixed Item Split and Animation Split Exports":
 * export must fall back when getSortedLayers(id, true)._unsafeUnwrap() is empty.
 */
const CUSTOM_ANIMATION_ONLY_ITEM_METADATA = {
  custom_only_whip: {
    name: "Custom Whip",
    type_name: "weapon",
    required: ["male", "female", "teen", "child", "muscular", "pregnant"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 100,
        custom_animation: "wheelchair",
        male: "misc/body/wheelchair/",
      },
    },
  },
};

describe("state/zip.ts", () => {
  afterEach(async () => {
    await restoreAppCatalogAfterTest();
  });

  describe("exportSplitAnimations", () => {
    let sandbox;
    let fakeZip;
    let alertStub;

    beforeEach(() => {
      resetState();
      drawCalls.length = 0;

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
    });

    afterEach(() => {
      sandbox.restore();
      delete window.canvasRenderer;
      delete window.JSZip;
      state.zipByAnimation.isRunning = false;
    });

    it("calls addCanvasToZip for each standard animation with folder, file name, and extracted canvas (no crop rect)", async () => {
      const addSpy = sinon.spy(addCanvasToZip);

      await exportSplitAnimations({ addCanvasToZip: addSpy });

      const standardCalls = addSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "standard/");
      expect(standardCalls).to.have.lengthOf(ANIMATIONS.length);

      const firstFolder = standardCalls[0].args[0];
      for (let i = 0; i < ANIMATIONS.length; i++) {
        const expectedName = `${ANIMATIONS[i].value}.png`;
        const call = standardCalls.find((c) => c.args[1] === expectedName);
        expect(call, `call for ${expectedName}`).to.exist;
        const [folder, fileName, animCanvas] = call.args;
        expect(folder, `call ${i} folder`).to.equal(firstFolder);
        expect(fileName).to.equal(expectedName);
        expect(animCanvas).to.be.instanceOf(HTMLCanvasElement);
      }
    });

    it("writes metadata.json with standardAnimations.exported listing each successfully written standard animation id", async () => {
      await exportSplitAnimations();

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      expect(metadataEntry, "metadata.json should exist").to.exist;
      const metadata = JSON.parse(metadataEntry);
      const expectedIds = ANIMATIONS.map((a) => a.value);
      expect(metadata.standardAnimations.exported).to.deep.equal(expectedIds);
      expect(metadata.standardAnimations.failed).to.deep.equal([]);
    });

    it("records failed standard animations in metadata when a standard PNG write fails after prior successes", async () => {
      window.JSZip = function FakeJSZip() {
        fakeZip = createFakeJSZip({ failStandardFileAfter: 1 });
        return fakeZip;
      };

      await exportSplitAnimations();

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      const metadata = JSON.parse(metadataEntry);
      expect(metadata.standardAnimations.exported).to.deep.equal([
        ANIMATIONS[0].value,
      ]);
      expect(metadata.standardAnimations.failed).to.deep.equal(
        ANIMATIONS.slice(1).map((a) => a.value),
      );
      expect(alertStub.called).to.be.true;
    });

    it("noExport: still writes flat standard PNGs for animations marked noExport (e.g. watering, 1h_slash)", async () => {
      await exportSplitAnimations();

      expect(fakeZip.files.get("standard/watering.png")).to.exist;
      expect(fakeZip.files.get("standard/1h_slash.png")).to.exist;
    });

    it("includes character.json, credits credits.txt/credits.csv, and credits/metadata.json", async () => {
      await exportSplitAnimations();

      expect(fakeZip.files.get("character.json")).to.exist;
      expect(fakeZip.files.get("credits/credits.txt")).to.exist;
      expect(fakeZip.files.get("credits/credits.csv")).to.exist;
      expect(fakeZip.files.get("credits/metadata.json")).to.exist;
    });

    it("calls addAnimationSliceToZip for custom/<name>.png when addedCustomAnimations is non-empty after renderCharacter", async () => {
      await seedBrowserCatalogMergedOnDist(ZIP_SPEC_ITEM_METADATA);
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      const addSpy = sinon.spy(addAnimationSliceToZip);

      await renderCharacter(state.selections, "male");
      await exportSplitAnimations({ addAnimationSliceToZip: addSpy });

      const customPng = addSpy
        .getCalls()
        .find(
          (c) => c.args[0]?.root === "custom/" && c.args[1] === "walk_128.png",
        );
      expect(customPng, "custom walk_128 export should be attempted").to.exist;
    });
  });

  describe("exportSplitItemSheets", () => {
    let sandbox;
    let fakeZip;
    let alertStub;

    function nonEmptyItemCanvas() {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      c.getContext("2d").fillRect(0, 0, 32, 32);
      return c;
    }

    beforeEach(async () => {
      resetState();
      drawCalls.length = 0;

      await seedBrowserCatalogMergedOnDist(ZIP_SPEC_ITEM_METADATA);

      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
      };

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
    });

    afterEach(() => {
      sandbox.restore();
      delete window.canvasRenderer;
      delete window.JSZip;
      state.zipByItem.isRunning = false;
    });

    it("calls addCanvasToZip for each item layer with items folder, file name, and canvas (no crop rect)", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());
      const addSpy = sinon.spy(addCanvasToZip);

      await exportSplitItemSheets({
        renderSingleItem: renderStub,
        addCanvasToZip: addSpy,
      });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      expect(bodyLayers, "body item should have layers in itemMetadata").to.be
        .ok;
      expect(bodyLayers.length).to.be.at.least(1);

      const expectedFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );

      expect(addSpy.callCount).to.equal(bodyLayers.length);
      const itemsCalls = addSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "items/");
      expect(itemsCalls).to.have.lengthOf(bodyLayers.length);

      const [folder, zipName, canvas] = itemsCalls[0].args;
      expect(folder.root).to.equal("items/");
      expect(zipName).to.equal(expectedFileName);
      expect(canvas).to.be.instanceOf(HTMLCanvasElement);

      expect(renderStub.callCount).to.equal(bodyLayers.length);
      const renderCall = renderStub.firstCall;
      expect(renderCall.args[0]).to.equal("body");
      expect(renderCall.args[1]).to.equal("light");
      expect(renderCall.args[2]).to.equal(null);
      expect(renderCall.args[3]).to.equal(state.bodyType);
      expect(renderCall.args[4]).to.equal(state.selections);
      expect(renderCall.args[5]).to.equal(bodyLayers[0].layerNum);
    });

    it("writes PNG blobs under items/ when render succeeds", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());

      await exportSplitItemSheets({
        renderSingleItem: renderStub,
      });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      const expectedFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );

      expect(fakeZip.files.get(`items/${expectedFileName}`)).to.exist;
      expect(alertStub.calledWith("Export complete!")).to.be.true;
    });

    it("includes character.json and credits credits.txt/credits.csv but not credits/metadata.json", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());

      await exportSplitItemSheets({
        renderSingleItem: renderStub,
      });

      expect(fakeZip.files.get("character.json")).to.exist;
      expect(fakeZip.files.get("credits/credits.txt")).to.exist;
      expect(fakeZip.files.get("credits/credits.csv")).to.exist;
      expect(fakeZip.files.get("credits/metadata.json")).to.equal(undefined);
    });

    it("records later item layers as failed when items/ write fails after prior successes", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
      };

      window.JSZip = function FakeJSZip() {
        fakeZip = createFakeJSZip({ failItemsFileAfter: 1 });
        return fakeZip;
      };

      const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());

      await exportSplitItemSheets({ renderSingleItem: renderStub });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      const headLayers = getSortedLayers(
        "heads_human_male",
        true,
      )._unsafeUnwrap();
      const firstFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );
      const secondFileName = getItemFileName(
        "heads_human_male",
        "light",
        "Human male (light)",
        headLayers[0].layerNum,
      );

      expect(fakeZip.files.get(`items/${firstFileName}`)).to.exist;
      expect(fakeZip.files.get(`items/${secondFileName}`)).to.equal(undefined);
      expect(alertStub.called).to.be.true;
      const issueAlert = alertStub
        .getCalls()
        .find((c) =>
          String(c.args[0]).includes("Export completed with some issues"),
        );
      expect(issueAlert, "partial failure alert").to.exist;
      expect(String(issueAlert.args[0])).to.include(secondFileName);
    });

    it("verify custom only animations also export correctly", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      window.JSZip = function FakeJSZip() {
        fakeZip = createFakeJSZip();
        return fakeZip;
      };

      const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());

      await exportSplitItemSheets({ renderSingleItem: renderStub });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      const headLayers = getSortedLayers(
        "heads_human_male",
        true,
      )._unsafeUnwrap();
      const weaponLayers = getSortedLayers("longsword", true)._unsafeUnwrap();
      const realWeaponLayers = getSortedLayers("longsword")._unsafeUnwrap();
      const firstFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );
      const secondFileName = getItemFileName(
        "heads_human_male",
        "light",
        "Human male (light)",
        headLayers[0].layerNum,
      );
      const thirdFileName = getItemFileName(
        "longsword",
        "longsword",
        "Longsword (longsword)",
        realWeaponLayers[0].layerNum,
      );

      expect(fakeZip.files.get(`items/${firstFileName}`)).to.exist;
      expect(fakeZip.files.get(`items/${secondFileName}`)).to.exist;
      expect(weaponLayers.length).to.equal(0);
      expect(fakeZip.files.get(`items/${thirdFileName}`)).to.exist;
    });

    describe("issue #364 (custom-animation-only items)", () => {
      beforeEach(async () => {
        await seedBrowserCatalogMergedOnDist(
          CUSTOM_ANIMATION_ONLY_ITEM_METADATA,
        );
        state.selections = {
          only: {
            itemId: "custom_only_whip",
            variant: "light",
            name: "Custom Whip",
          },
        };
      });

      it("exportSplitItemSheets calls renderSingleItem and writes items/ when every layer is custom_animation (standard-only layer list empty)", async () => {
        expect(
          getSortedLayers("custom_only_whip", true)._unsafeUnwrap(),
          "precondition: standard-only layers must be empty for this fixture",
        ).to.have.length(0);
        expect(
          getSortedLayers("custom_only_whip", false)._unsafeUnwrap(),
        ).to.have.length(1);

        const renderStub = sandbox.stub().resolves(nonEmptyItemCanvas());
        const addSpy = sinon.spy(addCanvasToZip);

        await exportSplitItemSheets({
          renderSingleItem: renderStub,
          addCanvasToZip: addSpy,
        });

        const allLayers = getSortedLayers(
          "custom_only_whip",
          false,
        )._unsafeUnwrap();
        const expectedFileName = getItemFileName(
          "custom_only_whip",
          "light",
          "Custom Whip",
          allLayers[0].layerNum,
        );

        expect(renderStub.callCount).to.equal(allLayers.length);
        expect(addSpy.callCount).to.equal(allLayers.length);
        expect(fakeZip.files.get(`items/${expectedFileName}`)).to.exist;
        expect(alertStub.calledWith("Export complete!")).to.be.true;
      });
    });
  });

  describe("exportSplitItemAnimations", () => {
    let sandbox;
    let fakeZip;
    let alertStub;

    function nonEmptyAnimCanvas() {
      const c = document.createElement("canvas");
      c.width = 48;
      c.height = 48;
      c.getContext("2d").fillRect(0, 0, 48, 48);
      return c;
    }

    function solidColorCanvas(r, g, b, width = 8, height = 8) {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, width, height);
      return c;
    }

    function readTopLeftRgb(canvas) {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new TypeError("readTopLeftRgb expects an HTMLCanvasElement");
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2d context from canvas");
      }

      const data = ctx.getImageData(0, 0, 1, 1).data;
      return [data[0], data[1], data[2]];
    }

    describe("helper functions", () => {
      it("solidColorCanvas creates an 8x8 canvas by default", () => {
        const c = solidColorCanvas(1, 2, 3);
        expect(c).to.be.instanceOf(HTMLCanvasElement);
        expect(c.width).to.equal(8);
        expect(c.height).to.equal(8);
      });

      it("solidColorCanvas paints the requested RGB color", () => {
        const c = solidColorCanvas(12, 34, 56, 4, 4);
        expect(readTopLeftRgb(c)).to.deep.equal([12, 34, 56]);
      });

      it("readTopLeftRgb returns RGB values for a normal filled canvas", () => {
        const c = solidColorCanvas(200, 150, 100, 3, 3);
        expect(readTopLeftRgb(c)).to.deep.equal([200, 150, 100]);
      });

      it("readTopLeftRgb reads the top-left pixel specifically", () => {
        const c = document.createElement("canvas");
        c.width = 2;
        c.height = 2;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "rgb(5, 10, 15)";
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = "rgb(250, 240, 230)";
        ctx.fillRect(1, 1, 1, 1);

        expect(readTopLeftRgb(c)).to.deep.equal([5, 10, 15]);
      });

      it("readTopLeftRgb throws for null or undefined input", () => {
        expect(() => readTopLeftRgb(null)).to.throw(
          TypeError,
          "readTopLeftRgb expects an HTMLCanvasElement",
        );
        expect(() => readTopLeftRgb(undefined)).to.throw(
          TypeError,
          "readTopLeftRgb expects an HTMLCanvasElement",
        );
      });

      it("readTopLeftRgb throws for non-canvas input", () => {
        expect(() => readTopLeftRgb({})).to.throw(
          TypeError,
          "readTopLeftRgb expects an HTMLCanvasElement",
        );
      });

      it("readTopLeftRgb returns black for a blank transparent canvas", () => {
        const c = document.createElement("canvas");
        c.width = 2;
        c.height = 2;
        expect(readTopLeftRgb(c)).to.deep.equal([0, 0, 0]);
      });
    });

    beforeEach(async () => {
      resetState();
      drawCalls.length = 0;

      await seedBrowserCatalogMergedOnDist(ZIP_SPEC_ITEM_METADATA);

      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
      };

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
    });

    afterEach(() => {
      sandbox.restore();
      delete window.canvasRenderer;
      delete window.JSZip;
      state.zipByAnimationAndItem.isRunning = false;
    });

    it("calls addCanvasToZip for each matching item layer under standard/<anim>/ with file name and canvas (no crop rect)", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());
      const addSpy = sinon.spy(addCanvasToZip);

      await exportSplitItemAnimations({
        renderSingleItemAnimation: renderStub,
        addCanvasToZip: addSpy,
      });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      expect(bodyLayers, "body item should have layers in itemMetadata").to.be
        .ok;
      expect(bodyLayers.length).to.be.at.least(1);

      const walkCalls = addSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "standard/walk/");
      expect(walkCalls.length).to.equal(bodyLayers.length);

      const expectedFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );

      const [folder, zipName, canvas] = walkCalls[0].args;
      expect(folder.root).to.equal("standard/walk/");
      expect(zipName).to.equal(expectedFileName);
      expect(canvas).to.be.instanceOf(HTMLCanvasElement);

      expect(renderStub.callCount).to.equal(bodyLayers.length);
      const rc = renderStub.firstCall;
      expect(rc.args[0]).to.equal("body");
      expect(rc.args[1]).to.equal("light");
      expect(rc.args[2]).to.equal(null);
      expect(rc.args[3]).to.equal(state.bodyType);
      expect(rc.args[4]).to.equal("walk");
      expect(rc.args[5]).to.equal(state.selections);
      expect(rc.args[6]).to.equal(bodyLayers[0].layerNum);
    });

    it("writes metadata.json with standardAnimations.exported / failed maps per animation (walk only in fixture)", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());

      await exportSplitItemAnimations({
        renderSingleItemAnimation: renderStub,
      });

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      expect(metadataEntry, "metadata.json should exist").to.exist;
      const metadata = JSON.parse(metadataEntry);

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      const expectedFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );

      expect(metadata.standardAnimations.exported.walk).to.deep.equal([
        expectedFileName,
      ]);
      expect(metadata.standardAnimations.failed.walk).to.deep.equal([]);
      expect(alertStub.calledWith("Export complete!")).to.be.true;
    });

    it("noExport: does not create standard/<anim>/ trees for animations marked noExport (e.g. watering, 1h_slash)", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());

      await exportSplitItemAnimations({
        renderSingleItemAnimation: renderStub,
      });

      const keys = [...fakeZip.files.keys()];
      expect(keys.some((k) => k.startsWith("standard/watering/"))).to.be.false;
      expect(keys.some((k) => k.startsWith("standard/1h_slash/"))).to.be.false;
      expect(keys.some((k) => k.startsWith("standard/walk/"))).to.be.true;
    });

    it("includes character.json, credits credits.txt/credits.csv, and credits/metadata.json", async () => {
      const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());

      await exportSplitItemAnimations({
        renderSingleItemAnimation: renderStub,
      });

      expect(fakeZip.files.get("character.json")).to.exist;
      expect(fakeZip.files.get("credits/credits.txt")).to.exist;
      expect(fakeZip.files.get("credits/credits.csv")).to.exist;
      expect(fakeZip.files.get("credits/metadata.json")).to.exist;
    });

    it("records failed custom item in metadata when a second write under custom/ throws", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      window.JSZip = function FakeJSZip() {
        fakeZip = createFakeJSZip({ failCustomTreeAfter: 1 });
        return fakeZip;
      };

      const loadImageStub = sandbox.stub().resolves(nonEmptyAnimCanvas());

      await renderCharacter(state.selections, "male");
      await exportSplitItemAnimations({
        loadImage: loadImageStub,
      });

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      const metadata = JSON.parse(metadataEntry);
      const failedWalk = metadata.customAnimations.failed.walk_128;
      expect(
        failedWalk,
        "metadata should record a failed custom layer",
      ).to.be.an("array").that.is.not.empty;
      const exportedWalk = metadata.customAnimations.exported.walk_128;
      expect(
        exportedWalk,
        "at least one custom layer should succeed first",
      ).to.be.an("array").that.is.not.empty;
    });

    it("records failed item layers in metadata when a write under standard/<anim>/ fails after prior successes", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
      };

      window.JSZip = function FakeJSZip() {
        fakeZip = createFakeJSZip({ failStandardTreeAfter: 1 });
        return fakeZip;
      };

      const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());

      await exportSplitItemAnimations({
        renderSingleItemAnimation: renderStub,
      });

      const bodyLayers = getSortedLayers("body", true)._unsafeUnwrap();
      const headLayers = getSortedLayers(
        "heads_human_male",
        true,
      )._unsafeUnwrap();
      const bodyFileName = getItemFileName(
        "body",
        "light",
        "Body color (light)",
        bodyLayers[0].layerNum,
      );
      const headFileName = getItemFileName(
        "heads_human_male",
        "light",
        "Human male (light)",
        headLayers[0].layerNum,
      );

      expect(fakeZip.files.get(`standard/walk/${bodyFileName}`)).to.exist;
      expect(fakeZip.files.get(`standard/walk/${headFileName}`)).to.equal(
        undefined,
      );

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      const metadata = JSON.parse(metadataEntry);
      expect(metadata.standardAnimations.exported.walk).to.deep.equal([
        bodyFileName,
      ]);
      expect(metadata.standardAnimations.failed.walk).to.deep.equal([
        headFileName,
      ]);

      expect(alertStub.called).to.be.true;
      const issueAlert = alertStub
        .getCalls()
        .find((c) =>
          String(c.args[0]).includes("Export completed with some issues"),
        );
      expect(issueAlert, "partial failure alert").to.exist;
      expect(String(issueAlert.args[0])).to.include(headFileName);
    });

    it("includes all items in custom animations including items copied from base animations", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          recolor: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          recolor: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      const loadImageStub = sandbox.stub().resolves(nonEmptyAnimCanvas());
      const addAnimationSliceToZipSpy = sinon.spy(addAnimationSliceToZip);
      const addStandardAnimationToZipCustomFolderSpy = sinon.spy(
        addStandardAnimationToZipCustomFolder,
      );

      await renderCharacter(state.selections, "male");
      await exportSplitItemAnimations({
        loadImage: loadImageStub,
        addAnimationSliceToZip: addAnimationSliceToZipSpy,
        addStandardAnimationToZipCustomFolder:
          addStandardAnimationToZipCustomFolderSpy,
      });

      const bodyLayers = getSortedLayers("body")._unsafeUnwrap();
      expect(bodyLayers, "body item should have layers in itemMetadata").to.be
        .ok;
      expect(bodyLayers.length).to.be.at.least(1);

      const headLayers = getSortedLayers("heads_human_male")._unsafeUnwrap();
      expect(headLayers, "head item should have layers in itemMetadata").to.be
        .ok;
      expect(headLayers.length).to.be.at.least(1);

      const swordLayers = getSortedLayers("longsword")._unsafeUnwrap();
      expect(swordLayers, "longsword item should have layers in itemMetadata")
        .to.be.ok;
      expect(swordLayers.length).to.be.at.least(1);

      const stdToCustCalls = addStandardAnimationToZipCustomFolderSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "custom/walk_128/");
      expect(stdToCustCalls.length).to.equal(
        bodyLayers.length + headLayers.length,
      );

      const addCalls = addAnimationSliceToZipSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "custom/walk_128/");
      expect(addCalls.length).to.equal(swordLayers.length);

      const expectedFileNames = {
        body: getItemFileName(
          "body",
          "light",
          "Body Color (light)",
          bodyLayers[0].layerNum,
        ),
        head: getItemFileName(
          "heads_human_male",
          "light",
          "Human Male (light)",
          headLayers[0].layerNum,
        ),
        weapon: getItemFileName(
          "longsword",
          "longsword",
          "Longsword (longsword)",
          swordLayers[0].layerNum,
        ),
      };

      const [bodyFolder, bodyFile, bodyCanvas] = stdToCustCalls[0].args;
      expect(bodyFolder.root).to.equal("custom/walk_128/");
      expect(bodyFile).to.equal(expectedFileNames["body"]);
      expect(bodyCanvas).to.be.instanceOf(HTMLCanvasElement);

      const [headFolder, headFile, headCanvas] = stdToCustCalls[1].args;
      expect(headFolder.root).to.equal("custom/walk_128/");
      expect(headFile).to.equal(expectedFileNames["head"]);
      expect(headCanvas).to.be.instanceOf(HTMLCanvasElement);

      const [swordFolder, swordFile, swordCanvas] = addCalls[0].args;
      expect(swordFolder.root).to.equal("custom/walk_128/");
      expect(swordFile).to.equal(expectedFileNames["weapon"]);
      expect(swordCanvas).to.be.instanceOf(HTMLCanvasElement);
    });

    it("uses recolored images in custom animation exports instead of raw loaded images", async () => {
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          recolor: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          recolor: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      const rawLoadedCanvas = solidColorCanvas(0, 0, 255);
      const recoloredCanvas = solidColorCanvas(255, 0, 0);
      const loadImageStub = sandbox.stub().resolves(rawLoadedCanvas);
      const getImageToDrawStub = sandbox.stub().resolves(recoloredCanvas);
      const addAnimationSliceToZipSpy = sinon.spy(addAnimationSliceToZip);
      const addStandardAnimationToZipCustomFolderSpy = sinon.spy(
        addStandardAnimationToZipCustomFolder,
      );

      await renderCharacter(state.selections, "male");
      await exportSplitItemAnimations({
        loadImage: loadImageStub,
        getImageToDraw: getImageToDrawStub,
        addAnimationSliceToZip: addAnimationSliceToZipSpy,
        addStandardAnimationToZipCustomFolder:
          addStandardAnimationToZipCustomFolderSpy,
      });

      const stdToCustCalls = addStandardAnimationToZipCustomFolderSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "custom/walk_128/");
      const addCalls = addAnimationSliceToZipSpy
        .getCalls()
        .filter((c) => c.args[0]?.root === "custom/walk_128/");

      expect(stdToCustCalls, "expected extracted_frames custom exports").to.not
        .be.empty;
      expect(addCalls, "expected custom_sprite exports").to.not.be.empty;

      const extractedSourceCanvas = stdToCustCalls[0].args[2];
      const customSpriteSourceCanvas = addCalls[0].args[2];
      expect(readTopLeftRgb(extractedSourceCanvas)).to.deep.equal([255, 0, 0]);
      expect(readTopLeftRgb(customSpriteSourceCanvas)).to.deep.equal([
        255, 0, 0,
      ]);

      expect(getImageToDrawStub.called).to.be.true;
      expect(loadImageStub.called).to.be.true;
    });

    describe("issue #364 (custom-animation-only items)", () => {
      beforeEach(async () => {
        await seedBrowserCatalogMergedOnDist(
          CUSTOM_ANIMATION_ONLY_ITEM_METADATA,
        );
        state.selections = {
          only: {
            itemId: "custom_only_whip",
            variant: "light",
            name: "Custom Whip",
          },
        };
      });

      it("exportSplitItemAnimations calls renderSingleItemAnimation under standard/<anim>/ when every layer is custom_animation (standard-only layer list empty)", async () => {
        expect(
          getSortedLayers("custom_only_whip", true)._unsafeUnwrap(),
          "precondition: standard-only layers must be empty for this fixture",
        ).to.have.length(0);

        const renderStub = sandbox.stub().resolves(nonEmptyAnimCanvas());
        const addSpy = sinon.spy(addCanvasToZip);

        await exportSplitItemAnimations({
          renderSingleItemAnimation: renderStub,
          addCanvasToZip: addSpy,
        });

        const allLayers = getSortedLayers(
          "custom_only_whip",
          false,
        )._unsafeUnwrap();
        const walkCalls = addSpy
          .getCalls()
          .filter((c) => c.args[0]?.root === "standard/walk/");
        expect(walkCalls.length).to.equal(allLayers.length);
        expect(renderStub.callCount).to.equal(allLayers.length);
      });
    });
  });

  describe("exportIndividualFrames", () => {
    let sandbox;
    let fakeZip;
    let alertStub;

    const directions = DIRECTIONS;

    function smallAnimCanvas() {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      c.getContext("2d").fillRect(0, 0, 64, 64);
      return c;
    }

    function frameCanvas() {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      c.getContext("2d").fillRect(0, 0, 16, 16);
      return c;
    }

    beforeEach(() => {
      resetState();
      drawCalls.length = 0;

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
    });

    afterEach(() => {
      sandbox.restore();
      delete window.canvasRenderer;
      delete window.JSZip;
      if (state.zipIndividualFrames) {
        state.zipIndividualFrames.isRunning = false;
      }
    });

    it("calls extractFramesFromAnimation for each extracted animation with canvas, name, and directions", async () => {
      const extractStub = sandbox.stub().callsFake(() => smallAnimCanvas());
      const framesSpy = sinon.spy(() => {
        const fc = frameCanvas();
        return { up: [{ canvas: fc, frameNumber: 0 }] };
      });

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesSpy,
      });

      expect(extractStub.callCount).to.equal(ANIMATIONS.length);
      expect(framesSpy.callCount).to.equal(ANIMATIONS.length);
      const first = framesSpy.firstCall;
      expect(first.args[1]).to.equal(ANIMATIONS[0].value);
      expect(first.args[2]).to.deep.equal(directions);
      expect(first.args[0]).to.be.instanceOf(HTMLCanvasElement);
      expect(fakeZip.files.get(`standard/${ANIMATIONS[0].value}/up/0.png`)).to
        .exist;
    });

    it("writes metadata.json with structure.standard exported / failed and completes when extract succeeds", async () => {
      const extractStub = sandbox.stub().callsFake(() => smallAnimCanvas());
      const framesFake = sinon.spy(() => ({}));

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesFake,
      });

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      const metadata = JSON.parse(metadataEntry);
      expect(metadata.structure.standard.failed).to.deep.equal([]);
      expect(metadata.structure.standard.exported).to.deep.equal(
        ANIMATIONS.map((a) => a.value),
      );
      expect(alertStub.calledWith("Individual frames export complete!")).to.be
        .true;
    });

    it("records failed standard animations when extractAnimationFromCanvas throws for an animation", async () => {
      const extractStub = sandbox.stub().callsFake((name) => {
        if (name === "thrust") {
          throw new Error("simulated extract failure");
        }
        return smallAnimCanvas();
      });
      const framesFake = sinon.spy(() => ({}));

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesFake,
      });

      const metadataEntry = fakeZip.files.get("credits/metadata.json");
      const metadata = JSON.parse(metadataEntry);
      expect(metadata.structure.standard.failed).to.deep.equal(["thrust"]);
      expect(metadata.structure.standard.exported).to.not.include("thrust");
      expect(metadata.structure.standard.exported).to.include("spellcast");
      expect(metadata.structure.standard.exported).to.deep.equal(
        ANIMATIONS.filter((a) => a.value !== "thrust").map((a) => a.value),
      );
      const issueAlert = alertStub
        .getCalls()
        .find((c) =>
          String(c.args[0]).includes("Export completed with some issues"),
        );
      expect(issueAlert, "partial failure alert").to.exist;
      expect(String(issueAlert.args[0])).to.include("thrust");
    });

    it("noExport: still writes per-frame paths under standard/<anim>/ for animations marked noExport", async () => {
      const extractStub = sandbox.stub().callsFake(() => smallAnimCanvas());
      const framesSpy = sinon.spy(() => {
        const fc = frameCanvas();
        return { up: [{ canvas: fc, frameNumber: 0 }] };
      });

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesSpy,
      });

      expect(fakeZip.files.get("standard/watering/up/0.png")).to.exist;
      expect(fakeZip.files.get("standard/1h_slash/up/0.png")).to.exist;
    });

    it("includes character.json, credits credits.txt/credits.csv, and credits/metadata.json", async () => {
      const extractStub = sandbox.stub().callsFake(() => smallAnimCanvas());
      const framesFake = sinon.spy(() => ({}));

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesFake,
      });

      expect(fakeZip.files.get("character.json")).to.exist;
      expect(fakeZip.files.get("credits/credits.txt")).to.exist;
      expect(fakeZip.files.get("credits/credits.csv")).to.exist;
      expect(fakeZip.files.get("credits/metadata.json")).to.exist;
    });

    it("writes custom frame paths under custom/walk_128/ when renderCharacter adds that custom animation", async () => {
      await seedBrowserCatalogMergedOnDist(ZIP_SPEC_ITEM_METADATA);
      state.selections = {
        body: {
          itemId: "body",
          variant: "light",
          name: "Body color (light)",
        },
        head: {
          itemId: "heads_human_male",
          variant: "light",
          name: "Human male (light)",
        },
        weapon: {
          itemId: "longsword",
          variant: "longsword",
          name: "Longsword (longsword)",
        },
      };

      await renderCharacter(state.selections, "male");

      const extractStub = sandbox.stub().callsFake(() => smallAnimCanvas());
      const framesStub = sinon.stub().returns({});
      const extractCustomStub = sinon.stub().callsFake(() => ({
        up: [{ canvas: frameCanvas(), frameNumber: 1 }],
      }));

      await exportIndividualFrames({
        extractAnimationFromCanvas: extractStub,
        extractFramesFromAnimation: framesStub,
        extractFramesFromCustomAnimation: extractCustomStub,
        newAnimationFromSheet: () => ok(smallAnimCanvas()),
        canvasToBlob: () => Promise.resolve(new Blob(["x"])),
      });

      expect(fakeZip.files.get("custom/walk_128/up/1.png")).to.exist;
      const metadata = JSON.parse(fakeZip.files.get("credits/metadata.json"));
      expect(metadata.structure.custom.exported).to.include("walk_128");
    });
  });
});

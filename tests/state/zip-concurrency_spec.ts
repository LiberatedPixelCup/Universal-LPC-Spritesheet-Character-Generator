import { expect } from "chai";
import sinon, { type SinonSandbox } from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  configureStateCatalog,
  createState,
  resetStateDeps,
  selectItem,
  setStateDeps,
  type State,
} from "../../sources/state/state.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import { downloadModelFactory } from "../../sources/models/download.ts";
import { categoryTreeModelFactory } from "../../sources/models/category-tree.ts";
import { currentSelectionsModelFactory } from "../../sources/models/current-selections.ts";
import { licenseFiltersModelFactory } from "../../sources/models/license-filters.ts";
import { animationFiltersModelFactory } from "../../sources/models/animation-filters.ts";
import { syncPostZipState } from "../../sources/state/zip.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

describe("ZIP Concurrency and State Synchronization", function () {
  let state: State;
  let catalog: ReturnType<typeof createCatalog>["reader"];
  let catalogWriter: ReturnType<typeof createCatalog>["writer"];
  let sandbox: SinonSandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(catalogWriter, {});
    catalogWriter.registerLayersMetadata({});
    configureStateCatalog(catalog);
    state = createState();
  });

  afterEach(function () {
    resetStateDeps();
    sandbox.restore();
  });

  it("locks subsequent ZIP and PNG exports while a ZIP is running", function () {
    const model = downloadModelFactory.create(catalog, state);
    expect(model.zipDisabled).to.equal(false);

    // Simulate ZIP export start
    state.isExportingZip = true;
    const busyModel = downloadModelFactory.create(catalog, state);
    expect(busyModel.zipDisabled).to.equal(true);
    expect(busyModel.zipTitle).to.equal("Export currently in progress");
  });

  it("keeps PNG available when only credits fail and blocks stale renders", async function () {
    const { reader, writer } = createCatalog();
    writer.registerIndexMetadata({
      aliasMetadata: {},
      categoryTree: {},
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
    });
    writer.registerItemMetadata({});
    writer.registerLayersMetadata({});
    writer.recordChunkFailure("credits", new Error("credits unavailable"));
    const model = downloadModelFactory.create(reader, state);
    expect(model.pngDisabled).to.equal(false);
    expect(model.zipDisabled).to.equal(true);
    expect(model.creditsDisabled).to.equal(true);
    expect(model.copyTitle).to.include("credits data");
    state.renderedCharacter = {
      selections: JSON.stringify(state.selections),
      bodyType: state.bodyType,
      customImage: state.customUploadedImage,
      customZPos: state.customImageZPos,
      matchBodyColorEnabled: state.matchBodyColorEnabled,
    };
    state.bodyType = "female";
    const staleModel = downloadModelFactory.create(reader, state);
    expect(staleModel.pngDisabled).to.equal(true);
    expect(staleModel.zipTitle).to.include("credits data");
  });

  it("buffers hash updates and custom image results during export, syncing on completion", function () {
    state.isExportingZip = true;

    // Simulate Character A exporting, and hash changes to B then C
    state.pendingPostZipHash = "#sex=female";

    // Simulate QA overlay image result arrives during export
    state.customImageRequest = 1;
    const fakeCustomImage = {} as HTMLImageElement;
    state.pendingCustomImageResult = {
      requestId: 1,
      image: fakeCustomImage,
      zPos: 50,
    };

    // Export completes -> call syncPostZipState
    syncPostZipState(catalog, state);

    expect(state.pendingPostZipHash).to.equal(null);
    expect(state.bodyType).to.equal("female");
    expect(state.pendingCustomImageResult).to.equal(null);
    expect(state.customUploadedImage).to.equal(fakeCustomImage);
    expect(state.customImageZPos).to.equal(50);
  });

  it("restores defaults when pendingPostZipHash is empty or invalid and handles unprefixed hashes", function () {
    setStateDeps({ redraw: () => {} });

    state.isExportingZip = true;
    state.pendingPostZipHash = "";
    syncPostZipState(catalog, state);
    expect(state.pendingPostZipHash).to.equal(null);
    expect(Object.keys(state.selections).length).to.be.greaterThan(0);

    state.isExportingZip = true;
    state.pendingPostZipHash = "sex=female";
    syncPostZipState(catalog, state);
    expect(state.bodyType).to.equal("female");
    expect(state.selections).to.deep.equal({});
  });

  it("resets isExportingZip and synchronizes state even if ZIP export encounters an error", function () {
    state.isExportingZip = true;
    state.zipExportError = "Network error during archive generation";
    state.pendingPostZipHash = "#sex=male";

    syncPostZipState(catalog, state);

    expect(state.pendingPostZipHash).to.equal(null);
    expect(state.zipExportError).to.equal(
      "Network error during archive generation",
    );
  });

  it("keeps export disabled while character re-render is in flight or failed after sync", function () {
    state.isExportingZip = false;
    state.isRenderingCharacter = true;
    state.canvasReadyForExport = false;

    const renderingModel = downloadModelFactory.create(catalog, state);
    expect(renderingModel.zipDisabled).to.equal(true);
    expect(renderingModel.zipTitle).to.equal(
      "Wait for character rendering to complete",
    );

    // Render fails
    state.isRenderingCharacter = false;
    state.canvasReadyForExport = false;
    state.lastRenderError = "Canvas lost";
    const errorModel = downloadModelFactory.create(catalog, state);
    expect(errorModel.zipDisabled).to.equal(true);
    expect(errorModel.zipTitle).to.equal(
      "Character render failed: Canvas lost",
    );

    // Once render finishes cleanly
    state.lastRenderError = null;
    state.canvasReadyForExport = true;
    const readyModel = downloadModelFactory.create(catalog, state);
    expect(readyModel.zipDisabled).to.equal(false);
  });

  it("blocks state mutations from tree, body type, selections, and filter removals while ZIP is running", function () {
    const { reader: localCatalog, writer: localWriter } = createCatalog();
    seedCatalog(
      localWriter,
      {
        simple_item: {
          name: "Simple Item",
          type_name: "simple",
          required: ["male", "female"],
          animations: ["walk"],
          variants: [],
          recolors: [],
          matchBodyColor: false,
          path: ["body"],
          credits: [
            {
              file: "body/simple.png",
              authors: ["A"],
              licenses: ["GPL 3.0"],
              urls: [],
            },
          ],
          layers: {},
        },
        variant_item: {
          name: "Variant Item",
          type_name: "hat",
          required: ["male", "female"],
          animations: ["walk"],
          variants: ["red"],
          recolors: [],
          matchBodyColor: false,
          path: ["body"],
          credits: [],
          layers: {},
        },
      },
      {
        categoryTree: {
          children: {
            body: {
              items: ["simple_item", "variant_item"],
            },
          },
        },
      },
    );
    configureStateCatalog(localCatalog);
    state = createState();
    state.expandedNodes = { body: true };
    state.selections = {
      simple: { itemId: "simple_item", name: "Simple Item" },
    };
    state.enabledLicenses = { CC0: true };
    state.enabledAnimations = { hurt: true };
    state.isExportingZip = true;

    selectItem(state, "variant_item", "red");
    expect(state.selections.hat).to.equal(undefined);

    const treeModel = categoryTreeModelFactory.create(localCatalog, state);
    expect(treeModel.isLoading).to.equal(false);
    if (!treeModel.isLoading) {
      treeModel.bodyTypes.select("female");
      expect(state.bodyType).to.equal("male");

      treeModel.setMatchBodyColor(false);
      expect(state.matchBodyColorEnabled).to.equal(true);

      const rootNode = treeModel.roots[0].createModel();
      const simpleModel = rootNode?.items.find((i) => i.kind === "simple");
      if (simpleModel?.kind === "simple") {
        simpleModel.select();
      }
      expect(state.selections.simple?.itemId).to.equal("simple_item");
    }

    const selectionsModel = currentSelectionsModelFactory.create(
      localCatalog,
      state,
    );
    expect(selectionsModel.kind).to.equal("ready");
    if (selectionsModel.kind === "ready") {
      selectionsModel.items[0].remove();
      expect(state.selections.simple?.itemId).to.equal("simple_item");
    }

    const licenseModel = licenseFiltersModelFactory.create(localCatalog, state);
    expect(licenseModel.removeIncompatible()).to.equal(0);
    expect(state.selections.simple?.itemId).to.equal("simple_item");

    const animationModel = animationFiltersModelFactory.create(
      localCatalog,
      state,
    );
    expect(animationModel.removeIncompatible()).to.equal(0);
    expect(state.selections.simple?.itemId).to.equal("simple_item");
  });
});

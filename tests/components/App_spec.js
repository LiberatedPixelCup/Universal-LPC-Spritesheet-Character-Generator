import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { App } from "../../sources/components/App.ts";
import { createApplicationModels } from "../../sources/models/application.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import {
  configureStateCatalog,
  createState,
  initState,
  resetStateDeps,
  setStateDeps,
} from "../../sources/state/state.ts";
let state;
import {
  getHash,
  getSetHashCalledTimes,
  resetHashCalledTimes,
  setHash,
} from "../../sources/state/hash.ts";
import {
  drawCalls,
  getCanvasRenderVersion,
  initCanvas,
  resetRenderCharacterQueueForTests,
} from "../../sources/canvas/renderer.ts";
import { setLoadImageForTests } from "../../sources/canvas/load-image.ts";
import { PerformanceProfiler } from "../../sources/performance-profiler.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

const TEST_BODY_ITEM = {
  name: "Test Body",
  type_name: "body",
  animations: ["walk"],
  required: ["male"],
  recolors: [],
  layers: {},
  credits: [],
};

describe("App", function () {
  let host;
  let previousRenderer;
  let previousTesting;
  let catalog;
  let catalogWriter;
  let models;
  let sandbox;
  let previousProfiler;
  let previousElectronAPI;

  function appView() {
    return m(App, {
      catalog,
      state,
      models,
    });
  }

  beforeEach(function () {
    state = createState();
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    previousTesting = window.isTesting;
    previousProfiler = window.profiler;
    previousElectronAPI = window.electronAPI;
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(catalogWriter, {});
    models = createApplicationModels(catalog, state);
    configureStateCatalog(catalog);
    sandbox = sinon.createSandbox();
    delete window.canvasRenderer;
    window.isTesting = true;
    setHash("");
    resetHashCalledTimes();
  });

  afterEach(function () {
    sandbox.restore();
    resetStateDeps();
    resetRenderCharacterQueueForTests();
    window.profiler = previousProfiler;
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    if (previousRenderer === undefined) {
      delete window.canvasRenderer;
    } else {
      window.canvasRenderer = previousRenderer;
    }
    window.isTesting = previousTesting;
    if (previousElectronAPI === undefined) {
      delete window.electronAPI;
    } else {
      window.electronAPI = previousElectronAPI;
    }
    resetHashCalledTimes();
  });

  it("renders Toolbar, Filters, Sidebar, and Preview", function () {
    m.mount(host, {
      view: appView,
    });

    assert.isOk(host.querySelector(".lpc-toolbar"));
    assert.isOk(host.querySelector(".lpc-toolbar-export-btn"));
    assert.isOk(host.querySelector("#lpc-sidebar"));
    assert.isOk(host.querySelector("#preview-column"));
    const titles = [...host.querySelectorAll("h3.collapsible-title")].map(
      (el) => el.textContent,
    );
    assert.include(titles, "Filters");
  });

  it("does not build filter models while Filters is collapsed", function () {
    const calls = { license: 0, animation: 0 };
    models = {
      ...createApplicationModels(catalog, state),
      createLicenseFiltersModel: () => {
        calls.license += 1;
        return {
          liteReady: true,
          creditsReady: true,
          summary: "(0/0 enabled)",
          options: [],
          incompatibleCount: 0,
          removeIncompatible: () => 0,
        };
      },
      createAnimationFiltersModel: () => {
        calls.animation += 1;
        return {
          liteReady: true,
          summary: "(All)",
          options: [],
          incompatibleCount: 0,
          removeIncompatible: () => 0,
        };
      },
    };
    m.mount(host, { view: appView });
    assert.strictEqual(calls.license, 0);
    assert.strictEqual(calls.animation, 0);

    const filtersTitle = [
      ...host.querySelectorAll("h3.collapsible-title"),
    ].find((element) => element.textContent === "Filters");
    filtersTitle
      .querySelector("button.collapsible-header")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.redraw.sync();

    assert.strictEqual(calls.license, 1);
    assert.strictEqual(calls.animation, 1);
    assert.lengthOf(host.querySelectorAll('input[type="search"]'), 1);
    assert.lengthOf(host.querySelectorAll(".category-tree-panel"), 1);
  });

  it("routes toolbar and native menu actions to the current Categories layout", function () {
    const media = Object.assign(new EventTarget(), { matches: false });
    sandbox
      .stub(window, "matchMedia")
      .callThrough()
      .withArgs("(min-width: 1100px)")
      .returns(media);
    const addChange = sandbox.spy(media, "addEventListener");
    const removeChange = sandbox.spy(media, "removeEventListener");
    let emitMenuAction;
    const unsubscribe = sandbox.spy(() => {
      emitMenuAction = undefined;
    });
    window.electronAPI = {
      isElectron: true,
      onMenuAction(callback) {
        emitMenuAction = callback;
        return unsubscribe;
      },
    };
    m.mount(host, { view: appView });
    const categories = host.querySelector(".lpc-categories-toggle");

    emitMenuAction("toggle-sidebar");
    m.redraw.sync();
    assert.isOk(host.querySelector(".lpc-drawer-backdrop nav"));
    assert.strictEqual(categories.getAttribute("aria-expanded"), "true");
    categories.click();
    m.redraw.sync();
    assert.isNull(host.querySelector(".lpc-drawer-backdrop"));

    categories.click();
    m.redraw.sync();
    const category = host.querySelector('.lpc-drawer-backdrop [role="tab"]');
    category.focus();
    assert.strictEqual(document.activeElement, category);
    media.matches = true;
    media.dispatchEvent(new Event("change"));
    m.redraw.sync();
    assert.isNull(host.querySelector(".lpc-drawer-backdrop"));
    assert.strictEqual(document.activeElement, categories);
    emitMenuAction("toggle-sidebar");
    m.redraw.sync();
    assert.isNull(host.querySelector(".lpc-workbench > nav"));
    assert.strictEqual(categories.getAttribute("aria-expanded"), "false");
    categories.click();
    m.redraw.sync();
    assert.isOk(host.querySelector(".lpc-workbench > nav"));

    m.mount(host, null);
    assert.lengthOf(addChange.args, 2);
    assert.sameDeepMembers(removeChange.args, addChange.args);
    assert.isTrue(unsubscribe.calledOnce);
    assert.isUndefined(emitMenuAction);
  });

  it("syncs the hash when selections change and skips render without canvasRenderer", function () {
    m.mount(host, {
      view: appView,
    });
    resetHashCalledTimes();

    seedCatalog(catalogWriter, {
      item1: TEST_BODY_ITEM,
    });
    state.selections = { body: { itemId: "item1", variant: null } };
    m.redraw.sync();

    assert.isAbove(getSetHashCalledTimes(), 0);
  });

  function enableProfiler() {
    sandbox.stub(globalThis, "requestAnimationFrame").returns(1);
    sandbox.stub(globalThis, "setInterval").returns(999);
    const profiler = new PerformanceProfiler({
      enabled: true,
      logSlowOperations: false,
    });
    window.profiler = profiler;
    return profiler;
  }

  async function waitForRenderCalls(profiler) {
    for (let i = 0; i < 20; i++) {
      if (profiler.snapshot().renderCharacter.calls.length > 0) {
        return;
      }
      await Promise.resolve();
    }
  }

  it("renders when canvasRenderer exists and selections change", async function () {
    const profiler = enableProfiler();
    initCanvas();
    window.canvasRenderer = {};
    m.mount(host, {
      view: appView,
    });
    seedCatalog(catalogWriter, {
      item1: TEST_BODY_ITEM,
    });
    state.selections = { body: { itemId: "item1", variant: null } };
    m.redraw.sync();
    await waitForRenderCalls(profiler);

    assert.isAbove(profiler.snapshot().renderCharacter.calls.length, 0);
  });

  it("renders again when only match body color changes", async function () {
    const profiler = enableProfiler();
    initCanvas();
    window.canvasRenderer = {};
    m.mount(host, { view: appView });

    state.matchBodyColorEnabled = !state.matchBodyColorEnabled;
    m.redraw.sync();
    await waitForRenderCalls(profiler);

    assert.isAbove(profiler.snapshot().renderCharacter.calls.length, 0);
  });

  for (const paletteFails of [false, true]) {
    it(`exports the latest empty outfit before a superseded palette ${paletteFails ? "fails" : "loads"}`, async function () {
      ({ reader: catalog, writer: catalogWriter } = createCatalog());
      catalogWriter.registerIndexMetadata({
        aliasMetadata: {},
        categoryTree: {},
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      catalogWriter.registerItemMetadata({
        item1: {
          ...TEST_BODY_ITEM,
          recolors: [
            {
              type_name: null,
              variants: ["light"],
              palettes: {},
              material: "skin",
            },
          ],
        },
      });
      catalogWriter.registerCreditsMetadata({});
      catalogWriter.registerLayersMetadata({
        item1: { layer_1: { male: "body/bodies/male/", zPos: 10 } },
      });
      models = createApplicationModels(catalog, state);
      let waiting;
      const reachedPalette = new Promise((resolve) => {
        waiting = resolve;
      });
      const paletteReady = catalog.ready.onPaletteReady;
      sandbox.stub(catalog.ready, "onPaletteReady").get(() => {
        waiting();
        return paletteReady;
      });
      initCanvas();
      window.canvasRenderer = {};
      const sprite = document.createElement("canvas");
      sprite.getContext("2d").fillRect(0, 0, 1, 1);
      setLoadImageForTests(async () => sprite);
      try {
        m.mount(host, { view: appView });
        state.selections = { body: { itemId: "item1", recolor: "light" } };
        m.redraw.sync();
        const oldRender = state.pendingCharacterRender;
        await reachedPalette;
        const beforeEmpty = getCanvasRenderVersion();
        state.selections = {};
        m.redraw.sync();
        await state.pendingCharacterRender;
        await Promise.allSettled([oldRender]);
        assert.isFalse(models.createDownloadModel().pngDisabled);
        assert.strictEqual(getCanvasRenderVersion(), beforeEmpty + 1);
        assert.isEmpty(drawCalls);

        if (paletteFails) {
          catalogWriter.recordChunkFailure(
            "palette",
            new Error("palette unavailable"),
          );
        } else {
          catalogWriter.registerPaletteMetadata({
            versions: {},
            materials: {},
          });
        }
        await Promise.allSettled([paletteReady]);
        assert.isNull(state.lastRenderError);
        assert.strictEqual(getCanvasRenderVersion(), beforeEmpty + 1);
        assert.isFalse(models.createDownloadModel().pngDisabled);
        assert.isEmpty(drawCalls);
      } finally {
        setLoadImageForTests(null);
        if (!catalog.isPaletteReady()) {
          catalogWriter.registerPaletteMetadata({
            versions: {},
            materials: {},
          });
        }
      }
    });
  }

  it("renders after initState hydrates selections when App is mounted", async function () {
    const profiler = enableProfiler();
    initCanvas();
    window.canvasRenderer = {};
    seedCatalog(catalogWriter, {
      item1: TEST_BODY_ITEM,
    });
    setStateDeps({
      loadSelectionsFromHash: (s) => {
        s.selections = { body: { itemId: "item1", variant: null } };
      },
    });
    m.mount(host, {
      view: appView,
    });

    await initState(state);
    m.redraw.sync();
    await waitForRenderCalls(profiler);

    assert.isAbove(profiler.snapshot().renderCharacter.calls.length, 0);
  });

  it("syncs the hash for bodyType changes without rewriting it for overlay changes", function () {
    m.mount(host, {
      view: appView,
    });
    resetHashCalledTimes();

    state.bodyType = "female";
    m.redraw.sync();
    const afterBody = getSetHashCalledTimes();
    assert.isAbove(afterBody, 0);

    state.customImageZPos = 10;
    m.redraw.sync();
    assert.strictEqual(getSetHashCalledTimes(), afterBody);
  });

  it("keeps a shared hash when changing the overlay after catalog failure", function () {
    const { reader: failedCatalog, writer } = createCatalog();
    const sharedHash = "#sex=male&head=human_male_light";
    setHash(sharedHash);
    resetHashCalledTimes();
    m.mount(host, {
      view: () =>
        m(App, {
          catalog: failedCatalog,
          state,
          models: createApplicationModels(failedCatalog, state),
        }),
    });

    writer.recordChunkFailure("index", new Error("index unavailable"));
    state.customImageZPos = 10;
    m.redraw.sync();

    assert.strictEqual(getSetHashCalledTimes(), 0);
    assert.strictEqual(getHash(), sharedHash);
    assert.isNull(state.pendingCharacterRender);
  });

  it("syncs Electron export state, guards export menu during ZIP, and shows lastRenderError", function () {
    let emitMenuAction;
    const updateExportState = sandbox.spy();
    window.electronAPI = {
      isElectron: true,
      onMenuAction(callback) {
        emitMenuAction = callback;
        return () => {};
      },
      updateExportState,
    };
    m.mount(host, { view: appView });
    assert.isTrue(updateExportState.calledWith(true));

    state.isExportingZip = true;
    m.redraw.sync();
    assert.isTrue(updateExportState.calledWith(false));
    emitMenuAction("export");
    m.redraw.sync();
    assert.isFalse(state.isExportModalOpen);

    state.isExportingZip = false;
    state.canvasReadyForExport = false;
    state.lastRenderError = "WebGL blew up";
    m.redraw.sync();
    emitMenuAction("export");
    m.redraw.sync();
    assert.isTrue(state.isExportModalOpen);
    assert.include(host.textContent, "Render Error:");
    assert.include(host.textContent, "WebGL blew up");
  });

  it("closes the Toolbar More menu on outside pointerdown and link clicks, with Character Credits (CSV) label", function () {
    m.mount(host, { view: appView });
    const moreBtn = host.querySelector(".lpc-more-toggle");
    moreBtn.click();
    m.redraw.sync();
    assert.isTrue(state.isMoreMenuOpen);
    assert.include(host.textContent, "Character Credits (CSV)");

    const dropdown = host.querySelector(".lpc-more-dropdown");
    dropdown.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    m.redraw.sync();
    assert.isTrue(state.isMoreMenuOpen);

    document.body.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    m.redraw.sync();
    assert.isFalse(state.isMoreMenuOpen);

    moreBtn.click();
    m.redraw.sync();
    const links = host.querySelectorAll(".lpc-dropdown-menu a");
    assert.strictEqual(links.length, 2);
    links[0].addEventListener("click", (e) => e.preventDefault());
    links[0].click();
    m.redraw.sync();
    assert.isFalse(state.isMoreMenuOpen);

    moreBtn.click();
    m.redraw.sync();
    links[1].addEventListener("click", (e) => e.preventDefault());
    links[1].click();
    m.redraw.sync();
    assert.isFalse(state.isMoreMenuOpen);
  });

  it("keeps Export and Credits modals mutually exclusive, disables CSV before credits load, guards Escape on open dialog, and moves focus on Preview tab arrows", function () {
    const { reader: unloadedCatalog, writer: unloadedWriter } = createCatalog();
    const unloadedModels = createApplicationModels(unloadedCatalog, state);
    m.mount(host, {
      view: () =>
        m(App, {
          catalog: unloadedCatalog,
          state,
          models: unloadedModels,
        }),
    });

    // Credits CSV item disabled before credits + layers load
    host.querySelector(".lpc-more-toggle").click();
    m.redraw.sync();
    const csvBtn = [...host.querySelectorAll(".lpc-dropdown-item")].find(
      (el) => el.textContent.trim() === "Character Credits (CSV)",
    );
    assert.isTrue(csvBtn.disabled);

    // Register metadata -> CSV enabled
    seedCatalog(unloadedWriter, {});
    m.redraw.sync();
    assert.isFalse(csvBtn.disabled);

    // Opening Export closes Credits, and opening Credits closes Export
    host.querySelector(".lpc-toolbar-export-btn").click();
    m.redraw.sync();
    assert.isTrue(state.isExportModalOpen);
    assert.isFalse(state.isCreditsModalOpen);

    host.querySelector(".lpc-more-toggle").click();
    m.redraw.sync();
    const creditsBtn = [...host.querySelectorAll(".lpc-dropdown-item")].find(
      (el) => el.textContent.trim() === "Character Credits…",
    );
    creditsBtn.click();
    m.redraw.sync();
    assert.isFalse(state.isExportModalOpen);
    assert.isTrue(state.isCreditsModalOpen);

    host.querySelector(".lpc-toolbar-export-btn").click();
    m.redraw.sync();
    assert.isTrue(state.isExportModalOpen);
    assert.isFalse(state.isCreditsModalOpen);

    // Escape does not close App's drawer/modal while a native <dialog open> is active
    state.isExportModalOpen = false;
    state.isAdvancedDrawerOpen = true;
    m.redraw.sync();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.appendChild(dialog);
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      m.redraw.sync();
      assert.isTrue(state.isAdvancedDrawerOpen);
    } finally {
      dialog.remove();
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    m.redraw.sync();
    assert.isFalse(state.isAdvancedDrawerOpen);

    // PreviewArea ArrowRight / ArrowLeft moves focus to the newly selected tab
    const animTab = host.querySelector("#tab-animation");
    animTab.focus();
    animTab.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    assert.strictEqual(state.activePreviewTab, "spritesheet");
    assert.strictEqual(document.activeElement.id, "tab-spritesheet");

    document.activeElement.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    assert.strictEqual(state.activePreviewTab, "animation");
    assert.strictEqual(document.activeElement.id, "tab-animation");
  });
});

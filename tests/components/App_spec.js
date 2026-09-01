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
  getSetHashCalledTimes,
  resetHashCalledTimes,
  setHash,
} from "../../sources/state/hash.ts";
import {
  initCanvas,
  resetRenderCharacterQueueForTests,
} from "../../sources/canvas/renderer.ts";
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
    resetHashCalledTimes();
  });

  it("renders Download, Filters, Credits, and Advanced Tools", function () {
    m.mount(host, {
      view: appView,
    });

    const titles = [...host.querySelectorAll("h3.collapsible-title")].map(
      (el) => el.textContent,
    );
    assert.include(titles, "Download");
    assert.include(titles, "Filters");
    assert.include(titles, "Credits & Attribution");
    assert.include(titles, "Advanced Tools");
  });

  it("does not build filter models while Filters is collapsed", function () {
    const calls = {
      search: 0,
      license: 0,
      animation: 0,
      currentSelections: 0,
    };
    models = {
      ...createApplicationModels(catalog, state),
      createSearchControlModel: () => {
        calls.search += 1;
        return { value: "", disabled: false, setValue() {} };
      },
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
      createCurrentSelectionsModel: () => {
        calls.currentSelections += 1;
        return { kind: "empty" };
      },
    };
    m.mount(host, { view: appView });
    assert.deepEqual(calls, {
      search: 1,
      license: 1,
      animation: 1,
      currentSelections: 1,
    });

    const filtersTitle = [
      ...host.querySelectorAll("h3.collapsible-title"),
    ].find((element) => element.textContent === "Filters");
    filtersTitle.parentElement.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    m.redraw.sync();

    assert.deepEqual(calls, {
      search: 1,
      license: 1,
      animation: 1,
      currentSelections: 1,
    });
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

  it("syncs the hash when bodyType or custom overlay state changes", function () {
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
    assert.isAbove(getSetHashCalledTimes(), afterBody);
  });
});

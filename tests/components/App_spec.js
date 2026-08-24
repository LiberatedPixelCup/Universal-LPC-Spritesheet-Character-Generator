import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { App } from "../../sources/components/App.ts";
import { createApplicationModels } from "../../sources/models/application.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import {
  configureStateCatalog,
  createState,
} from "../../sources/state/state.ts";
let state;
import {
  getSetHashCalledTimes,
  resetHashCalledTimes,
  setHash,
} from "../../sources/state/hash.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

describe("App", function () {
  let host;
  let previousRenderer;
  let previousTesting;
  let catalog;
  let catalogWriter;
  let models;

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
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    seedCatalog(catalogWriter, {});
    models = createApplicationModels(catalog, state);
    configureStateCatalog(catalog);
    delete window.canvasRenderer;
    window.isTesting = true;
    setHash("");
    resetHashCalledTimes();
  });

  afterEach(function () {
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

  it("does not build current selections while Filters is collapsed", function () {
    let currentSelectionsCalls = 0;
    models = {
      currentSelections: () => {
        currentSelectionsCalls += 1;
        return { kind: "empty" };
      },
    };
    m.mount(host, { view: appView });
    assert.strictEqual(currentSelectionsCalls, 1);

    const filtersTitle = [
      ...host.querySelectorAll("h3.collapsible-title"),
    ].find((element) => element.textContent === "Filters");
    filtersTitle.parentElement.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    m.redraw.sync();

    assert.strictEqual(currentSelectionsCalls, 1);
  });

  it("syncs the hash when selections change and skips render without canvasRenderer", function () {
    m.mount(host, {
      view: appView,
    });
    resetHashCalledTimes();

    seedCatalog(catalogWriter, {
      item1: {
        name: "Test Body",
        type_name: "body",
        animations: ["walk"],
        layers: {},
        credits: [],
      },
    });
    state.selections = { body: { itemId: "item1", variant: null } };
    m.redraw.sync();

    assert.isAbove(getSetHashCalledTimes(), 0);
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

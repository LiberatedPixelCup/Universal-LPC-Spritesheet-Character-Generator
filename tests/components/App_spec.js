import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { App } from "../../sources/components/App.ts";
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

  beforeEach(function () {
    state = createState();
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    previousTesting = window.isTesting;
    catalog = createCatalog();
    seedCatalog(catalog, {});
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
      view: () => m(App, { catalog, state }),
    });

    const titles = [...host.querySelectorAll("h3.collapsible-title")].map(
      (el) => el.textContent,
    );
    assert.include(titles, "Download");
    assert.include(titles, "Filters");
    assert.include(titles, "Credits & Attribution");
    assert.include(titles, "Advanced Tools");
  });

  it("syncs the hash when selections change and skips render without canvasRenderer", function () {
    m.mount(host, {
      view: () => m(App, { catalog, state }),
    });
    resetHashCalledTimes();

    seedCatalog(catalog, {
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
      view: () => m(App, { catalog, state }),
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

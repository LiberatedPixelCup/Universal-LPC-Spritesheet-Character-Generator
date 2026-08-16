import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { App } from "../../sources/components/App.ts";
import { defaultCatalog } from "../../sources/state/catalog.ts";
import { state } from "../../sources/state/state.ts";
import {
  getSetHashCalledTimes,
  resetHashCalledTimes,
  resetState as resetHashState,
  setHash,
} from "../../sources/state/hash.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";

describe("App", function () {
  let host;
  let previousRenderer;
  let previousTesting;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    previousTesting = window.isTesting;
    delete window.canvasRenderer;
    window.isTesting = true;
    setHash("");
    resetHashCalledTimes();
    state.selections = {};
    state.bodyType = "male";
    state.customUploadedImage = null;
    state.customImageZPos = 0;
  });

  afterEach(async function () {
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
    resetHashState();
    resetHashCalledTimes();
    state.selections = {};
    state.bodyType = "male";
    state.customUploadedImage = null;
    state.customImageZPos = 0;
    await restoreAppCatalogAfterTest();
  });

  it("renders Download, Filters, Credits, and Advanced Tools", function () {
    m.mount(host, {
      view: () => m(App, { catalog: defaultCatalog }),
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
      view: () => m(App, { catalog: defaultCatalog }),
    });
    resetHashCalledTimes();

    seedBrowserCatalog({
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
      view: () => m(App, { catalog: defaultCatalog }),
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

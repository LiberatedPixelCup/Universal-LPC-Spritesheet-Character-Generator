import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { Download } from "../../../sources/components/download/Download.ts";
import { defaultCatalog } from "../../../sources/state/catalog.ts";
import { state } from "../../../sources/state/state.ts";
import { restoreAppCatalogAfterTest } from "../../browser-catalog-fixture.js";

const ZIP_TITLE = "Wait for layer data to finish loading";

function buttonByText(host, text) {
  return [...host.querySelectorAll("button")].find(
    (btn) => btn.textContent.trim() === text,
  );
}

function zipButtons(host) {
  return [...host.querySelectorAll("button")].filter((btn) =>
    btn.textContent.includes("ZIP:"),
  );
}

describe("Download", function () {
  let host;
  let previousRenderer;
  let alertStub;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    previousRenderer = window.canvasRenderer;
    window.canvasRenderer = {};
    alertStub = sinon.stub(window, "alert");
    state.zipByAnimation = { isRunning: false };
    state.zipByItem = { isRunning: false };
    state.zipByAnimationAndItem = { isRunning: false };
    state.zipIndividualFrames = { isRunning: false };
    state.bodyType = "male";
    state.selections = {};
  });

  afterEach(async function () {
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    window.canvasRenderer = previousRenderer;
    alertStub.restore();
    sinon.restore();
    state.zipByAnimation = { isRunning: false };
    state.zipByItem = { isRunning: false };
    state.zipByAnimationAndItem = { isRunning: false };
    state.zipIndividualFrames = { isRunning: false };
    state.bodyType = "male";
    state.selections = {};
    state.selectedAnimation = "walk";
    await restoreAppCatalogAfterTest();
  });

  it("disables ZIP buttons until layer data is ready", function () {
    m.mount(host, {
      view: () => m(Download, { catalog: { isLayersReady: () => false } }),
    });

    const zips = zipButtons(host);
    assert.strictEqual(zips.length, 4);
    for (const btn of zips) {
      assert.strictEqual(btn.disabled, true);
      assert.strictEqual(btn.title, ZIP_TITLE);
    }
  });

  it("enables ZIP buttons when layer data is ready", function () {
    m.mount(host, {
      view: () => m(Download, { catalog: { isLayersReady: () => true } }),
    });

    const zips = zipButtons(host);
    assert.strictEqual(zips.length, 4);
    for (const btn of zips) {
      assert.strictEqual(btn.disabled, false);
      assert.strictEqual(btn.title, "");
    }
  });

  it("shows a loading spinner for each running zip export", function () {
    state.zipByAnimation.isRunning = true;
    state.zipByItem.isRunning = true;
    state.zipByAnimationAndItem.isRunning = true;
    state.zipIndividualFrames.isRunning = true;
    m.mount(host, {
      view: () => m(Download, { catalog: { isLayersReady: () => true } }),
    });

    assert.strictEqual(host.querySelectorAll("span.loading").length, 4);
  });

  it("renders PNG, credits, and clipboard buttons", function () {
    m.mount(host, {
      view: () => m(Download, { catalog: defaultCatalog }),
    });

    assert.notEqual(buttonByText(host, "Spritesheet (PNG)"), null);
    assert.notEqual(buttonByText(host, "Credits (TXT)"), null);
    assert.notEqual(buttonByText(host, "Credits (CSV)"), null);
    assert.notEqual(buttonByText(host, "Export to Clipboard (JSON)"), null);
    assert.notEqual(buttonByText(host, "Import from Clipboard (JSON)"), null);
  });

  it("exports JSON to the clipboard", async function () {
    const writeText = sinon.stub().resolves();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText, readText: sinon.stub() },
    });

    m.mount(host, {
      view: () => m(Download, { catalog: defaultCatalog }),
    });
    buttonByText(host, "Export to Clipboard (JSON)").click();
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(writeText.calledOnce, true);
    const json = JSON.parse(writeText.firstCall.args[0]);
    assert.strictEqual(json.version, 2);
    assert.strictEqual(json.bodyType, "male");
    assert.strictEqual(alertStub.calledOnce, true);
  });

  it("imports JSON from the clipboard into state", async function () {
    const readText = sinon.stub().resolves(
      JSON.stringify({
        version: 2,
        bodyType: "female",
        selections: { body: { itemId: "1" } },
        selectedAnimation: "idle",
      }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: sinon.stub(), readText },
    });

    m.mount(host, {
      view: () => m(Download, { catalog: defaultCatalog }),
    });
    buttonByText(host, "Import from Clipboard (JSON)").click();
    await Promise.resolve();
    await Promise.resolve();

    assert.strictEqual(state.bodyType, "female");
    assert.strictEqual(state.selections.body.itemId, "1");
    assert.strictEqual(state.selectedAnimation, "idle");
    assert.strictEqual(alertStub.calledOnce, true);
  });

  it("downloads credits.txt and credits.csv", function () {
    const createObjectURLStub = sinon
      .stub(URL, "createObjectURL")
      .returns("blob:url");
    sinon.stub(URL, "revokeObjectURL");
    const nativeCreate = document.createElement.bind(document);
    const anchors = [];
    sinon.stub(document, "createElement").callsFake((tag) => {
      const el = nativeCreate(tag);
      if (tag === "a") {
        el.click = sinon.stub();
        anchors.push(el);
      }
      return el;
    });

    m.mount(host, {
      view: () => m(Download, { catalog: defaultCatalog }),
    });
    buttonByText(host, "Credits (TXT)").click();
    buttonByText(host, "Credits (CSV)").click();

    assert.strictEqual(createObjectURLStub.calledTwice, true);
    assert.deepEqual(
      anchors.map((a) => a.download),
      ["credits.txt", "credits.csv"],
    );
  });
});

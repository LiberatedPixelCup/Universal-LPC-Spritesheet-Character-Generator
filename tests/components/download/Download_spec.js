import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { Download } from "../../../sources/components/download/Download.ts";
import { downloadModelFactory } from "../../../sources/models/download.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { createState } from "../../../sources/state/state.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

const ZIP_TITLE = "Wait for layer data to finish loading";

function buttonByText(host, text) {
  return [...host.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === text,
  );
}

function zipButtons(host) {
  return [...host.querySelectorAll("button")].filter((button) =>
    button.textContent.includes("ZIP:"),
  );
}

function createModel(overrides = {}) {
  return {
    zipDisabled: false,
    zipByAnimationRunning: false,
    zipByItemRunning: false,
    zipByAnimationAndItemRunning: false,
    zipIndividualFramesRunning: false,
    saveSpritesheet() {},
    downloadCreditsTxt() {},
    downloadCreditsCsv() {},
    exportZipByAnimation: async () => {},
    exportZipByItem: async () => {},
    exportZipByAnimationAndItem: async () => {},
    exportZipByAnimationAndFrame: async () => {},
    exportJsonToClipboard: async () => ({ kind: "unavailable" }),
    importJsonFromClipboard: async () => ({ kind: "unavailable" }),
    ...overrides,
  };
}

describe("Download", function () {
  let host;
  let alertStub;
  let previousRenderer;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    alertStub = sinon.stub(window, "alert");
    previousRenderer = window.canvasRenderer;
    window.canvasRenderer = {};
  });

  afterEach(function () {
    m.mount(host, null);
    host.remove();
    alertStub.restore();
    sinon.restore();
    window.canvasRenderer = previousRenderer;
  });

  it("renders readiness and running snapshots", function () {
    m.render(
      host,
      m(Download, {
        createModel: () =>
          createModel({
            zipDisabled: true,
            zipTitle: ZIP_TITLE,
            zipByAnimationRunning: true,
            zipByItemRunning: true,
            zipByAnimationAndItemRunning: true,
            zipIndividualFramesRunning: true,
          }),
      }),
    );

    for (const button of zipButtons(host)) {
      assert.isTrue(button.disabled);
      assert.strictEqual(button.title, ZIP_TITLE);
    }
    assert.strictEqual(host.querySelectorAll("span.loading").length, 4);
  });

  it("invokes every supplied download command", function () {
    const commands = {
      saveSpritesheet: sinon.spy(),
      downloadCreditsTxt: sinon.spy(),
      downloadCreditsCsv: sinon.spy(),
      exportZipByAnimation: sinon.spy(),
      exportZipByItem: sinon.spy(),
      exportZipByAnimationAndItem: sinon.spy(),
      exportZipByAnimationAndFrame: sinon.spy(),
    };
    m.render(host, m(Download, { createModel: () => createModel(commands) }));

    buttonByText(host, "Spritesheet (PNG)").click();
    buttonByText(host, "Credits (TXT)").click();
    buttonByText(host, "Credits (CSV)").click();
    buttonByText(host, "ZIP: Split by animation").click();
    buttonByText(host, "ZIP: Split by item").click();
    buttonByText(host, "ZIP: Split by animation and item").click();
    buttonByText(host, "ZIP: Split by animation and frame").click();

    for (const command of Object.values(commands))
      assert.isTrue(command.calledOnce);
  });

  it("shows clipboard result messages while preserving the unavailable no-op", async function () {
    const exportJsonToClipboard = sinon.stub().resolves({ kind: "success" });
    const error = new Error("bad import");
    const importJsonFromClipboard = sinon
      .stub()
      .onFirstCall()
      .resolves({ kind: "failure", error })
      .onSecondCall()
      .resolves({ kind: "unavailable" });
    const consoleError = sinon.stub(console, "error");
    m.render(
      host,
      m(Download, {
        createModel: () =>
          createModel({ exportJsonToClipboard, importJsonFromClipboard }),
      }),
    );

    buttonByText(host, "Export to Clipboard (JSON)").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.isTrue(alertStub.calledWith("Exported to clipboard!"));

    buttonByText(host, "Import from Clipboard (JSON)").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.isTrue(
      alertStub.calledWith(
        "Failed to import. Please check clipboard content and browser permissions.",
      ),
    );
    assert.isTrue(
      consoleError.calledWith("Failed to import from clipboard:", error),
    );

    const alertCount = alertStub.callCount;
    buttonByText(host, "Import from Clipboard (JSON)").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(alertStub.callCount, alertCount);
  });

  it("does not build the model while the section is collapsed", function () {
    let calls = 0;
    m.mount(host, {
      view: () =>
        m(Download, {
          createModel: () => {
            calls += 1;
            return createModel();
          },
        }),
    });
    assert.strictEqual(calls, 1);

    host.querySelector("h3.collapsible-title").parentElement.click();
    m.redraw.sync();
    assert.strictEqual(calls, 1);
    m.redraw.sync();
    assert.strictEqual(calls, 1);

    host.querySelector("h3.collapsible-title").parentElement.click();
    m.redraw.sync();
    assert.strictEqual(calls, 2);
  });

  it("redraws after a returned import Promise resolves", async function () {
    const observed = { bodyType: "male" };
    m.mount(host, {
      view: () => [
        m(Download, {
          createModel: () =>
            createModel({
              importJsonFromClipboard: async () => {
                await Promise.resolve();
                observed.bodyType = "female";
                return { kind: "success" };
              },
            }),
        }),
        m("span#observed-body-type", observed.bodyType),
      ],
    });

    buttonByText(host, "Import from Clipboard (JSON)").click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    assert.strictEqual(
      host.querySelector("#observed-body-type").textContent,
      "female",
    );
  });

  it("factory snapshots readiness and running states", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    state.zipByAnimation.isRunning = true;
    state.zipByItem.isRunning = true;
    state.zipByAnimationAndItem.isRunning = true;
    state.zipIndividualFrames.isRunning = true;

    const loadingModel = downloadModelFactory.create(catalog, state);
    assert.isTrue(loadingModel.zipDisabled);
    assert.strictEqual(loadingModel.zipTitle, ZIP_TITLE);
    assert.isTrue(loadingModel.zipByAnimationRunning);
    assert.isTrue(loadingModel.zipByItemRunning);
    assert.isTrue(loadingModel.zipByAnimationAndItemRunning);
    assert.isTrue(loadingModel.zipIndividualFramesRunning);

    writer.registerLayersMetadata({});
    const readyModel = downloadModelFactory.create(catalog, state);
    assert.isFalse(readyModel.zipDisabled);
    assert.isUndefined(readyModel.zipTitle);
  });

  it("factory exports and imports JSON through the clipboard", async function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    seedCatalog(writer, {});
    const writeText = sinon.stub().resolves();
    const readText = sinon.stub().resolves(
      JSON.stringify({
        version: 2,
        bodyType: "female",
        selections: {},
        selectedAnimation: "idle",
      }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText, readText },
    });

    const model = downloadModelFactory.create(catalog, state);
    assert.deepEqual(await model.exportJsonToClipboard(), { kind: "success" });
    assert.strictEqual(JSON.parse(writeText.firstCall.args[0]).version, 2);
    assert.deepEqual(await model.importJsonFromClipboard(), {
      kind: "success",
    });
    assert.strictEqual(state.bodyType, "female");
    assert.strictEqual(state.selectedAnimation, "idle");
  });

  it("factory reports clipboard failures and unavailable rendering", async function () {
    const { reader: catalog } = createCatalog();
    const state = createState();
    const error = new Error("clipboard denied");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: sinon.stub().rejects(error),
        readText: sinon.stub().rejects(error),
      },
    });
    const model = downloadModelFactory.create(catalog, state);

    assert.deepEqual(await model.exportJsonToClipboard(), {
      kind: "failure",
      error,
    });
    assert.deepEqual(await model.importJsonFromClipboard(), {
      kind: "failure",
      error,
    });

    delete window.canvasRenderer;
    assert.deepEqual(await model.exportJsonToClipboard(), {
      kind: "unavailable",
    });
    assert.deepEqual(await model.importJsonFromClipboard(), {
      kind: "unavailable",
    });
    model.saveSpritesheet();
  });

  it("factory delegates credits and ZIP commands", async function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    seedCatalog(writer, {});
    const createObjectURL = sinon
      .stub(URL, "createObjectURL")
      .returns("blob:url");
    sinon.stub(URL, "revokeObjectURL");
    const nativeCreate = document.createElement.bind(document);
    sinon.stub(document, "createElement").callsFake((tag) => {
      const element = nativeCreate(tag);
      if (tag === "a") element.click = sinon.stub();
      return element;
    });
    delete window.JSZip;

    const model = downloadModelFactory.create(catalog, state);
    model.downloadCreditsTxt();
    model.downloadCreditsCsv();
    assert.isTrue(createObjectURL.calledTwice);
    await model.exportZipByAnimation();
    await model.exportZipByItem();
    await model.exportZipByAnimationAndItem();
    await model.exportZipByAnimationAndFrame();
    assert.strictEqual(alertStub.callCount, 4);
  });
});

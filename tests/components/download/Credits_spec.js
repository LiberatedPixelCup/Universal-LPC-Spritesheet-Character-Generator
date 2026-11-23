import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { Credits } from "../../../sources/components/download/Credits.ts";
import { creditsModelFactory } from "../../../sources/models/credits.ts";
import { createCatalog } from "../../../sources/state/catalog.ts";
import { createState } from "../../../sources/state/state.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

function buttonByText(host, text) {
  return [...host.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === text,
  );
}

describe("Credits", function () {
  let host;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    sinon.restore();
    m.mount(host, null);
    host.remove();
  });

  it("renders loading and empty snapshots", function () {
    m.render(host, m(Credits, { createModel: () => ({ kind: "loading" }) }));
    assert.include(host.textContent, "Loading selections…");

    m.render(host, m(Credits, { createModel: () => ({ kind: "empty" }) }));
    assert.include(host.textContent, "No items selected");
  });

  it("renders supplied credits and invokes download commands", function () {
    const downloadTxt = sinon.spy();
    const downloadCsv = sinon.spy();
    m.render(
      host,
      m(Credits, {
        createModel: () => ({
          kind: "ready",
          credits: [
            {
              key: "eyes/human",
              fileName: "eyes/human/adult/walk.png",
              notes: "Eye assets",
              licenses: ["CC-BY-SA"],
              authors: ["Alex"],
            },
          ],
          downloadTxt,
          downloadCsv,
        }),
      }),
    );

    assert.include(host.textContent, "eyes/human/adult/walk.png");
    assert.include(host.textContent, "Eye assets");
    assert.include(host.textContent, "CC-BY-SA");
    assert.include(host.textContent, "Alex");
    buttonByText(host, "Download TXT").click();
    buttonByText(host, "Download CSV").click();
    assert.isTrue(downloadTxt.calledOnce);
    assert.isTrue(downloadCsv.calledOnce);
  });

  it("does not build credits while the section is collapsed", function () {
    let calls = 0;
    m.mount(host, {
      view: () =>
        m(Credits, {
          createModel: () => {
            calls += 1;
            return { kind: "empty" };
          },
        }),
    });
    assert.strictEqual(calls, 1);

    host.querySelector("button.collapsible-header").click();
    m.redraw.sync();
    assert.strictEqual(calls, 1);
    m.redraw.sync();
    assert.strictEqual(calls, 1);

    host.querySelector("button.collapsible-header").click();
    m.redraw.sync();
    assert.strictEqual(calls, 2);
  });

  it("factory moves from loading to empty", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    assert.strictEqual(
      creditsModelFactory.create(catalog, state).kind,
      "loading",
    );

    seedCatalog(writer, {});
    state.previewBootstrapRenderDone = true;
    assert.strictEqual(
      creditsModelFactory.create(catalog, state).kind,
      "empty",
    );
  });

  it("factory stays loading until both credits and layers chunks are ready", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    writer.registerIndexMetadata({
      aliasMetadata: {},
      categoryTree: {},
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
    });
    writer.registerItemMetadata({
      item1: {
        name: "Item 1",
        type_name: "body",
        required: ["male"],
        animations: ["walk"],
        recolors: [],
        matchBodyColor: false,
        variants: ["light"],
        path: ["body"],
      },
    });
    state.previewBootstrapRenderDone = true;
    state.selections = { body: { itemId: "item1", name: "Item 1" } };

    assert.strictEqual(
      creditsModelFactory.create(catalog, state).kind,
      "loading",
    );
    writer.registerCreditsMetadata({ item1: [] });
    assert.strictEqual(
      creditsModelFactory.create(catalog, state).kind,
      "loading",
    );
    writer.registerLayersMetadata({ item1: {} });
    assert.strictEqual(
      creditsModelFactory.create(catalog, state).kind,
      "empty",
    );
  });

  it("downloads credits for current selections from an already-open dialog", async function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    seedCatalog(
      writer,
      Object.fromEntries(
        ["previous", "current"].map((itemId) => [
          itemId,
          {
            animations: ["walk"],
            layers: { layer_1: { male: `eyes/${itemId}/` } },
            credits: [
              {
                file: `eyes/${itemId}`,
                authors: [itemId],
                licenses: ["CC-BY-SA"],
                urls: [],
              },
            ],
          },
        ]),
      ),
    );
    state.previewBootstrapRenderDone = true;
    state.selections = { slot: { itemId: "previous" } };
    const model = creditsModelFactory.create(catalog, state);
    assert.strictEqual(model.kind, "ready");
    const createObjectURL = sinon
      .stub(URL, "createObjectURL")
      .returns("blob:url");
    sinon.stub(URL, "revokeObjectURL");
    sinon.stub(HTMLAnchorElement.prototype, "click");

    state.selections = { slot: { itemId: "current" } };
    model.downloadTxt();
    model.downloadCsv();

    for (const [blob] of createObjectURL.args) {
      const content = await blob.text();
      assert.include(content, "eyes/current/walk.png");
      assert.notInclude(content, "eyes/previous/walk.png");
    }
    assert.isTrue(createObjectURL.calledTwice);
  });

  it("factory derives rows and downloads both formats", function () {
    const { reader: catalog, writer } = createCatalog();
    const state = createState();
    seedCatalog(writer, {
      item1: {
        animations: ["walk"],
        layers: { layer_1: { male: "eyes/human/adult/" } },
        credits: [
          {
            file: "eyes/human",
            authors: ["Alex"],
            licenses: ["CC-BY-SA"],
            urls: ["https://example.org"],
            notes: "Eye assets",
          },
        ],
      },
    });
    state.previewBootstrapRenderDone = true;
    state.selections = { slot: { itemId: "item1", name: "Eyes" } };
    state.selectedAnimation = "climb";

    const createObjectURL = sinon
      .stub(URL, "createObjectURL")
      .returns("blob:url");
    sinon.stub(URL, "revokeObjectURL");
    const nativeCreate = document.createElement.bind(document);
    const anchors = [];
    sinon.stub(document, "createElement").callsFake((tag) => {
      const element = nativeCreate(tag);
      if (tag === "a") {
        element.click = sinon.stub();
        anchors.push(element);
      }
      return element;
    });

    const model = creditsModelFactory.create(catalog, state);
    assert.strictEqual(model.kind, "ready");
    assert.strictEqual(model.credits[0].fileName, "eyes/human/adult/walk.png");
    model.downloadTxt();
    model.downloadCsv();
    assert.isTrue(createObjectURL.calledTwice);
    assert.strictEqual(createObjectURL.secondCall.args[0].type, "text/csv");
    assert.deepEqual(
      anchors.map((anchor) => anchor.download),
      ["credits.txt", "credits.csv"],
    );
  });
});

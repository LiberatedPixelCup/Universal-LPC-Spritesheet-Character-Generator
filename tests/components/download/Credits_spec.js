import m from "mithril";
import { assert } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { Credits } from "../../../sources/components/download/Credits.ts";
import { defaultCatalog } from "../../../sources/state/catalog.ts";
import { state } from "../../../sources/state/state.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

function buttonByText(host, text) {
  return [...host.querySelectorAll("button")].find(
    (btn) => btn.textContent.trim() === text,
  );
}

describe("Credits", function () {
  let host;

  beforeEach(function () {
    host = document.createElement("div");
    document.body.appendChild(host);
    state.previewBootstrapRenderDone = true;
    state.selections = {};
    state.bodyType = "male";
    state.selectedAnimation = "walk";
  });

  afterEach(async function () {
    sinon.restore();
    m.mount(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    state.previewBootstrapRenderDone = false;
    state.selections = {};
    state.bodyType = "male";
    state.selectedAnimation = "walk";
    await restoreAppCatalogAfterTest();
  });

  it("shows loading copy before bootstrap render is done", function () {
    state.previewBootstrapRenderDone = false;
    m.mount(host, {
      view: () => m(Credits, { catalog: defaultCatalog }),
    });

    assert.include(host.textContent, "Loading selections…");
    assert.strictEqual(buttonByText(host, "Download TXT"), undefined);
  });

  it("shows empty copy when ready but nothing is credited", function () {
    seedBrowserCatalog({});
    m.mount(host, {
      view: () => m(Credits, { catalog: defaultCatalog }),
    });

    assert.include(host.textContent, "No items selected");
    assert.strictEqual(buttonByText(host, "Download TXT"), undefined);
  });

  it("lists credits and downloads TXT/CSV files", function () {
    seedBrowserCatalog({
      item1: {
        animations: ["walk"],
        layers: {
          layer_1: { male: "eyes/human/adult/" },
        },
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
    state.selections = { slot: { itemId: "item1", variant: null } };

    m.mount(host, {
      view: () => m(Credits, { catalog: defaultCatalog }),
    });

    assert.include(host.textContent, "eyes/human/adult/walk.png");
    assert.include(host.textContent, "CC-BY-SA");
    assert.include(host.textContent, "Alex");
    assert.include(host.textContent, "Eye assets");

    const nativeCreate = document.createElement.bind(document);
    const anchors = [];
    sinon.stub(URL, "createObjectURL").returns("blob:url");
    sinon.stub(URL, "revokeObjectURL");
    sinon.stub(document, "createElement").callsFake((tag) => {
      const el = nativeCreate(tag);
      if (tag === "a") {
        el.click = sinon.stub();
        anchors.push(el);
      }
      return el;
    });

    buttonByText(host, "Download TXT").click();
    buttonByText(host, "Download CSV").click();
    assert.deepEqual(
      anchors.map((a) => a.download),
      ["credits.txt", "credits.csv"],
    );
  });
});

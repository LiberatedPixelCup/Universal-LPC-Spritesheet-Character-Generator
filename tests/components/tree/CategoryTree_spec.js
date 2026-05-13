import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { CategoryTree } from "../../../sources/components/tree/CategoryTree.ts";
import { state } from "../../../sources/state/state.ts";
import {
  resetCatalogForTests,
  registerFromIndexModule,
  registerFromPaletteModule,
} from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { resetState } from "../../../sources/state/filters.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

describe("CategoryTree", function () {
  let host;

  beforeEach(function () {
    resetState();
    state.expandedNodes = {};
    state.searchQuery = "";
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(async function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
    resetState();
    await restoreAppCatalogAfterTest();
  });

  it("shows loading panel until the category index is ready", function () {
    resetCatalogForTests();

    m.render(host, m(CategoryTree));

    assert.ok(host.querySelector(".category-tree-loading-overlay"));
    assert.strictEqual(
      host
        .querySelector(".category-tree-loading-overlay")
        .getAttribute("aria-busy"),
      "true",
    );
    assert.include(host.textContent, "Available Items");
    assert.include(host.textContent, "Loading category index…");
    assert.strictEqual(host.querySelector("button"), null);
  });

  it("disables Expand Selected while the item list (lite) is not ready", function () {
    resetCatalogForTests();
    registerFromIndexModule({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: {
        byTypeName: {},
        hashMatch: { itemsByTypeName: {} },
      },
    });
    registerFromPaletteModule({
      paletteMetadata: { versions: {}, materials: {} },
    });

    m.render(host, m(CategoryTree));

    const expandBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    assert.notEqual(expandBtn, null);
    assert.isTrue(expandBtn.disabled);
    assert.strictEqual(expandBtn.getAttribute("title"), "Loading item list…");
  });

  it("renders toolbar, match-body-color control, body selector, and category items", function () {
    seedBrowserCatalog(
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.expandedNodes.Gear = true;

    m.render(host, m(CategoryTree));

    assert.strictEqual(
      host.querySelector("h3.title")?.textContent?.trim(),
      "Available Items",
    );

    const labels = [...host.querySelectorAll("button")].map((b) =>
      b.textContent.trim(),
    );
    assert.includeMembers(labels, [
      "Reset all",
      "Collapse All",
      "Expand Selected",
      "CompactDisplay",
    ]);

    const expandSelected = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    assert.isFalse(expandSelected.disabled);

    const matchCb = host.querySelector("#match-body-color-checkbox");
    assert.notEqual(matchCb, null);
    assert.strictEqual(
      matchCb.getAttribute("aria-describedby"),
      "match-body-color-label",
    );
    assert.include(host.textContent, "Match body color");

    assert.ok(
      [...host.querySelectorAll(".tree-label")].some((el) =>
        el.textContent.includes("Gear"),
      ),
    );
    assert.ok(
      [...host.querySelectorAll(".tree-node")].some((el) =>
        el.textContent.includes("Category Tree Hat"),
      ),
    );
  });

  it("Expand Selected expands paths for the current selection", function () {
    seedBrowserCatalog(
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.selections.hat = {
      itemId: "ct_hat_1",
      name: "Category Tree Hat",
    };
    state.expandedNodes = {};

    m.render(host, m(CategoryTree));

    const expandBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Expand Selected",
    );
    expandBtn.click();

    assert.isTrue(state.expandedNodes.Gear);
    assert.isTrue(state.expandedNodes.ct_hat_1);
  });

  it("Collapse All clears expanded nodes", function () {
    seedBrowserCatalog(
      {
        ct_hat_1: {
          name: "Category Tree Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          path: ["Gear"],
        },
      },
      {
        categoryTree: {
          items: [],
          children: {
            Gear: { items: ["ct_hat_1"], children: {} },
          },
        },
      },
    );
    state.expandedNodes = { Gear: true };

    m.render(host, m(CategoryTree));

    const collapseBtn = [...host.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Collapse All",
    );
    collapseBtn.click();

    assert.deepEqual(state.expandedNodes, {});
  });
});

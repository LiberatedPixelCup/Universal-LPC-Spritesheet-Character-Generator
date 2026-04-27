import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { TreeNode } from "../../../sources/components/tree/TreeNode.js";
import { state } from "../../../sources/state/state.js";
import {
  resetCatalogForTests,
  registerFromIndexModule,
  registerFromPaletteModule,
} from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import {
  resetState,
  setEnabledAnimations,
} from "../../../sources/state/filters.js";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

describe("TreeNode", function () {
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

  it("renders nothing when the node is restricted to other body types", function () {
    seedBrowserCatalog({
      tn_hidden: {
        name: "Female only",
        type_name: "hat",
        required: ["female"],
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    state.bodyType = "male";
    state.expandedNodes.Armor = true;

    const node = {
      required: ["female"],
      items: ["tn_hidden"],
      children: {},
    };

    m.render(host, m(TreeNode, { name: "Armor", node }));

    assert.strictEqual(host.querySelector(".tree-label"), null);
    assert.strictEqual(host.textContent.trim(), "");
  });

  it("renders nothing when search is active and nothing in the subtree matches", function () {
    seedBrowserCatalog({
      tn_alpha: {
        name: "Alpha Helm",
        type_name: "hat",
        required: [...BODY_TYPES],
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    state.searchQuery = "zzz";

    m.render(
      host,
      m(TreeNode, {
        name: "Headgear",
        node: { items: ["tn_alpha"], children: {} },
      }),
    );

    assert.strictEqual(host.querySelector(".tree-label"), null);
  });

  it("shows skeleton rows for item ids until lite metadata is registered", function () {
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

    state.expandedNodes.Warehouse = true;

    m.render(
      host,
      m(TreeNode, {
        name: "Warehouse",
        node: { items: ["pending-id"], children: {} },
      }),
    );

    const sk = host.querySelector(".skeleton-row");
    assert.notEqual(sk, null);
    assert.strictEqual(sk.getAttribute("aria-hidden"), "true");
  });

  it("renders display label, simple item row, and expand/collapse from the category row", function () {
    seedBrowserCatalog(
      {
        tn_hat: {
          name: "TreeNode Hat",
          type_name: "hat",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
        },
      },
      {
        categoryTree: { items: [], children: {} },
      },
    );

    m.render(
      host,
      m(TreeNode, {
        name: "outer_category",
        node: {
          label: "Custom Label",
          items: ["tn_hat"],
          children: {},
        },
      }),
    );

    const label = host.querySelector(".tree-label");
    assert.notEqual(label, null);
    assert.include(label.textContent, "Custom Label");
    assert.ok(label.querySelector("span.tree-arrow.collapsed"));

    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.isTrue(state.expandedNodes.outer_category);
    m.render(
      host,
      m(TreeNode, {
        name: "outer_category",
        node: {
          label: "Custom Label",
          items: ["tn_hat"],
          children: {},
        },
      }),
    );

    const itemRow = host.querySelector(".tree-node");
    assert.notEqual(itemRow, null);
    assert.include(itemRow.textContent, "TreeNode Hat");

    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.strictEqual(state.expandedNodes.outer_category, false);
  });

  it("capitalizes the category key when label is omitted", function () {
    seedBrowserCatalog({}, { categoryTree: { items: [], children: {} } });

    m.render(
      host,
      m(TreeNode, {
        name: "armor",
        node: { items: [], children: {} },
      }),
    );

    assert.include(host.querySelector(".tree-label").textContent, "Armor");
  });

  it("auto-expands when search matches an item name", function () {
    seedBrowserCatalog({
      tn_search_hat: {
        name: "Unique Search Hat",
        type_name: "hat",
        required: [...BODY_TYPES],
        animations: ["walk"],
        credits: [],
        layers: {},
      },
    });
    state.searchQuery = "Uniq";

    m.render(
      host,
      m(TreeNode, {
        name: "Gear",
        node: { items: ["tn_search_hat"], children: {} },
      }),
    );

    assert.ok(host.querySelector("span.tree-arrow.expanded"));
    assert.ok(
      [...host.querySelectorAll(".tree-node")].some((el) =>
        el.textContent.includes("Unique Search Hat"),
      ),
    );
  });

  it("selects and clears a simple item via the tree row", function () {
    seedBrowserCatalog(
      {
        tn_pick: {
          name: "Pickable Cape",
          type_name: "cape",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
        },
      },
      { categoryTree: { items: [], children: {} } },
    );
    state.expandedNodes.capes = true;

    m.render(
      host,
      m(TreeNode, {
        name: "capes",
        node: { items: ["tn_pick"], children: {} },
      }),
    );

    const row = host.querySelector(".tree-node");
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(state.selections.cape, {
      itemId: "tn_pick",
      name: "Pickable Cape",
    });

    m.render(
      host,
      m(TreeNode, {
        name: "capes",
        node: { items: ["tn_pick"], children: {} },
      }),
    );
    host
      .querySelector(".tree-node")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(state.selections, {});
  });

  it("shows animation mismatch styling on the category row and blocks expand", function () {
    seedBrowserCatalog({}, { categoryTree: { items: [], children: {} } });
    setEnabledAnimations(["run"]);

    m.render(
      host,
      m(TreeNode, {
        name: "AnimCat",
        node: {
          animations: ["walk"],
          items: [],
          children: {},
        },
      }),
    );

    const label = host.querySelector(".tree-label");
    assert.ok(label.classList.contains("has-text-grey"));
    assert.include(label.textContent, "⚠️");

    label.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.strictEqual(state.expandedNodes.AnimCat, undefined);
  });

  it("nests child TreeNodes under pathPrefix", function () {
    seedBrowserCatalog({}, { categoryTree: { items: [], children: {} } });
    state.expandedNodes.parent = true;
    state.expandedNodes["parent-child"] = true;

    m.render(
      host,
      m(TreeNode, {
        name: "parent",
        node: {
          items: [],
          children: {
            child: { items: [], children: {} },
          },
        },
      }),
    );

    assert.ok(host.textContent.includes("Child"));
    assert.isTrue(state.expandedNodes["parent-child"]);
  });
});

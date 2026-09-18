import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { TreeNode as TreeNodeComponent } from "../../../sources/components/tree/TreeNode.ts";
import { treeNodeModelFactory } from "../../../sources/models/category-tree.ts";
import {
  configureStateCatalog,
  createState,
} from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { setEnabledAnimations } from "../../../sources/state/filters.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

const TreeNode = {
  view: (vnode) =>
    m(TreeNodeComponent, {
      createModel: () =>
        treeNodeModelFactory.create(
          vnode.attrs.catalog,
          vnode.attrs.state,
          vnode.attrs.name,
          vnode.attrs.node,
          vnode.attrs.pathPrefix,
        ),
    }),
};

describe("TreeNode", function () {
  let host;
  let catalog;
  let catalogWriter;

  beforeEach(function () {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    configureStateCatalog(catalog);
    state = createState();
    state.expandedNodes = {};
    state.searchQuery = "";
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  it("renders nothing when the node is restricted to other body types", function () {
    seedCatalog(catalogWriter, {
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

    m.render(host, m(TreeNode, { name: "Armor", node, catalog, state }));

    assert.strictEqual(host.querySelector(".tree-label"), null);
    assert.strictEqual(host.textContent.trim(), "");
  });

  it("renders nothing when search is active and nothing in the subtree matches", function () {
    seedCatalog(catalogWriter, {
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
        catalog,
        state,
        name: "Headgear",
        node: { items: ["tn_alpha"], children: {} },
      }),
    );

    assert.strictEqual(host.querySelector(".tree-label"), null);
  });

  it("shows skeleton rows for item ids until lite metadata is registered", function () {
    catalogWriter.registerIndexMetadata({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: {
        byTypeName: {},
        hashMatch: { itemsByTypeName: {} },
      },
    });
    catalogWriter.registerPaletteMetadata({ versions: {}, materials: {} });

    state.expandedNodes.Warehouse = true;

    m.render(
      host,
      m(TreeNode, {
        catalog,
        state,
        name: "Warehouse",
        node: { items: ["pending-id"], children: {} },
      }),
    );

    const sk = host.querySelector(".skeleton-row");
    assert.notEqual(sk, null);
    assert.strictEqual(sk.getAttribute("aria-hidden"), "true");
  });

  it("renders display label, simple item row, and expand/collapse from the category row", function () {
    seedCatalog(
      catalogWriter,
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
        catalog,
        state,
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
        catalog,
        state,
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
    seedCatalog(
      catalogWriter,
      {},
      { categoryTree: { items: [], children: {} } },
    );

    m.render(
      host,
      m(TreeNode, {
        catalog,
        state,
        name: "armor",
        node: { items: [], children: {} },
      }),
    );

    assert.include(host.querySelector(".tree-label").textContent, "Armor");
  });

  it("auto-expands when search matches an item name", function () {
    seedCatalog(catalogWriter, {
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
        catalog,
        state,
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
    seedCatalog(
      catalogWriter,
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
        catalog,
        state,
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
        catalog,
        state,
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
    seedCatalog(
      catalogWriter,
      {},
      { categoryTree: { items: [], children: {} } },
    );
    setEnabledAnimations(state, ["run"]);

    m.render(
      host,
      m(TreeNode, {
        catalog,
        state,
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
    seedCatalog(
      catalogWriter,
      {},
      { categoryTree: { items: [], children: {} } },
    );
    state.expandedNodes.parent = true;
    state.expandedNodes["parent-child"] = true;

    m.render(
      host,
      m(TreeNode, {
        catalog,
        state,
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

import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { ItemWithVariants } from "../../../sources/components/tree/ItemWithVariants.js";
import { state } from "../../../sources/state/state.ts";
import { getItemMerged } from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { resetState } from "../../../sources/state/filters.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

describe("ItemWithVariants", function () {
  let host;

  beforeEach(function () {
    resetState();
    state.expandedNodes = {};
    state.compactDisplay = false;
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

  function seedVariantItem() {
    seedBrowserCatalog(
      {
        iwv_cloak: {
          name: "Variant Cloak",
          type_name: "cloak",
          required: [...BODY_TYPES],
          variants: ["dark_blue", "red"],
          animations: ["walk"],
          credits: [],
          layers: {},
        },
      },
      { categoryTree: { items: [], children: {} } },
    );
    return getItemMerged("iwv_cloak").unwrapOr(null);
  }

  it("renders the item row with a collapsed tree label", function () {
    const meta = seedVariantItem();

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "Licenses: CC0\nAnimations: walk",
        showItemTooltips: true,
      }),
    );

    const label = host.querySelector(".tree-label");
    assert.notEqual(label, null);
    assert.include(label.textContent, "Variant Cloak");
    assert.ok(label.querySelector("span.tree-arrow.collapsed"));
    assert.strictEqual(host.querySelector(".variants-container"), null);
  });

  it("applies search-result and warning styling from attrs", function () {
    const meta = seedVariantItem();

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: true,
        isCompatible: false,
        tooltipText: "⚠️ Incompatible\nAnimations: walk",
        showItemTooltips: true,
      }),
    );

    const root = host.firstElementChild;
    assert.ok(root.classList.contains("search-result"));
    assert.ok(root.classList.contains("has-text-grey"));
    assert.include(host.querySelector(".tree-label").textContent, "⚠️");
  });

  it("shows variant rows when expanded and labels use variant display names", function () {
    const meta = seedVariantItem();
    state.expandedNodes.iwv_cloak = true;

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "tip",
        showItemTooltips: true,
      }),
    );

    assert.strictEqual(host.querySelectorAll(".variant-item").length, 2);
    assert.ok(host.textContent.includes("Dark blue"));
    assert.ok(host.textContent.includes("Red"));
  });

  // TODO (unimplemented): Enable when the category row reliably receives clicks after variant
  // canvases mount. With the grid open, each canvas uses oncreate + Promise.all + m.redraw(); in
  // Testem, a subsequent native click() on `.tree-label` often did not run Mithril's toggle
  // (expand-from-collapsed — e.g. Body Color — still works). Intended checks:
  //   assert.strictEqual(state.expandedNodes.iwv_cloak, false);
  //   assert.strictEqual(host.querySelectorAll(".variant-item").length, 0);
  it("row label collapses when expanded (expandedNodes keyed by item id)", function () {
    this.skip();
  });

  it("uses body-body as expandedNodes key when the display name is Body Color", function () {
    seedBrowserCatalog(
      {
        iwv_body_color: {
          name: "Body Color",
          type_name: "body",
          required: [...BODY_TYPES],
          variants: ["light", "amber"],
          animations: ["walk"],
          credits: [],
          layers: {},
        },
      },
      { categoryTree: { items: [], children: {} } },
    );
    const meta = getItemMerged("iwv_body_color").unwrapOr(null);

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_body_color",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "",
        showItemTooltips: false,
      }),
    );

    host.querySelector(".tree-label").click();
    m.redraw.sync();

    assert.isTrue(state.expandedNodes["body-body"]);
    assert.strictEqual(state.expandedNodes.iwv_body_color, undefined);
  });

  it("selects and deselects a variant via selectItem", function () {
    const meta = seedVariantItem();

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "tip",
        showItemTooltips: true,
      }),
    );
    state.expandedNodes.iwv_cloak = true;
    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "tip",
        showItemTooltips: true,
      }),
    );

    const firstVariant = host.querySelector(".variant-item");
    firstVariant.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.redraw.sync();

    assert.deepEqual(state.selections.cloak, {
      itemId: "iwv_cloak",
      variant: "dark_blue",
      subId: null,
      recolor: null,
      name: "Variant Cloak (dark blue)",
    });

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "tip",
        showItemTooltips: true,
      }),
    );
    host
      .querySelector(".variant-item")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.redraw.sync();

    assert.deepEqual(state.selections, {});
  });

  it("does not select when the item is marked incompatible", function () {
    const meta = seedVariantItem();

    state.expandedNodes.iwv_cloak = true;
    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: false,
        tooltipText: "bad",
        showItemTooltips: true,
      }),
    );

    host
      .querySelector(".variant-item")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    m.redraw.sync();

    assert.deepEqual(state.selections, {});
  });

  it("uses compact canvas sizing when compactDisplay is enabled", function () {
    const meta = seedVariantItem();
    state.compactDisplay = true;
    state.expandedNodes.iwv_cloak = true;

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_cloak",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "tip",
        showItemTooltips: true,
      }),
    );

    const canvas = host.querySelector("canvas.variant-canvas");
    assert.notEqual(canvas, null);
    assert.strictEqual(canvas.getAttribute("width"), "32");
    assert.strictEqual(canvas.getAttribute("height"), "32");
    assert.ok(canvas.className.includes("compact-display"));
  });
});

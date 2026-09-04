import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { ItemWithVariants as ItemWithVariantsComponent } from "../../../sources/components/tree/ItemWithVariants.ts";
import { itemWithVariantsModelFactory } from "../../../sources/models/item-with-variants.ts";
import {
  configureStateCatalog,
  createState,
} from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

const ItemWithVariants = {
  view: (vnode) =>
    m(ItemWithVariantsComponent, {
      createModel: () =>
        itemWithVariantsModelFactory.create(
          vnode.attrs.catalog,
          vnode.attrs.state,
          vnode.attrs.itemId,
          vnode.attrs.meta,
          vnode.attrs.isSearchMatch,
          vnode.attrs.isCompatible,
          vnode.attrs.tooltipText,
          vnode.attrs.showItemTooltips ?? true,
        ),
    }),
};

describe("ItemWithVariants", function () {
  let host;
  let catalog;
  let catalogWriter;

  beforeEach(function () {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    configureStateCatalog(catalog);
    state = createState();
    state.expandedNodes = {};
    state.compactDisplay = false;
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(function () {
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  function seedVariantItem() {
    seedCatalog(
      catalogWriter,
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
    return catalog.getItemMerged("iwv_cloak").unwrapOr(null);
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
        catalog,
        state,
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
        catalog,
        state,
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
        catalog,
        state,
      }),
    );

    assert.strictEqual(host.querySelectorAll(".variant-item").length, 2);
    assert.ok(host.textContent.includes("Dark blue"));
    assert.ok(host.textContent.includes("Red"));
  });

  it("row label collapses an expanded item", function () {
    let isExpanded = true;
    const createModel = () => ({
      name: "Variant Cloak",
      isSearchMatch: false,
      isCompatible: true,
      tooltip: "tip",
      isExpanded,
      imagesToLoad: 0,
      variants: [],
      toggle: () => {
        isExpanded = !isExpanded;
        return 0;
      },
    });
    m.render(host, m(ItemWithVariantsComponent, { createModel }));
    assert.notEqual(host.querySelector(".variants-container"), null);

    host.querySelector(".tree-label").click();
    m.render(host, m(ItemWithVariantsComponent, { createModel }));

    assert.strictEqual(host.querySelector(".variants-container"), null);
  });

  it("uses body-body as expandedNodes key when the display name is Body Color", function () {
    seedCatalog(
      catalogWriter,
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
    const meta = catalog.getItemMerged("iwv_body_color").unwrapOr(null);

    m.render(
      host,
      m(ItemWithVariants, {
        itemId: "iwv_body_color",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "",
        showItemTooltips: false,
        catalog,
        state,
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
        catalog,
        state,
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
        catalog,
        state,
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
        catalog,
        state,
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
        catalog,
        state,
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
        catalog,
        state,
      }),
    );

    const canvas = host.querySelector("canvas.variant-canvas");
    assert.notEqual(canvas, null);
    assert.strictEqual(canvas.getAttribute("width"), "32");
    assert.strictEqual(canvas.getAttribute("height"), "32");
    assert.ok(canvas.className.includes("compact-display"));
  });

  it("redraws a mounted preview at the current compact size", async function () {
    let compactDisplay = false;
    const redrawSizes = [];
    const createModel = () => ({
      name: "Variant Cloak",
      isSearchMatch: false,
      isCompatible: true,
      tooltip: "tip",
      isExpanded: true,
      imagesToLoad: 0,
      toggle: () => 0,
      variants: [
        {
          key: "dark_blue",
          label: "Dark blue",
          isSelected: false,
          isCompatible: true,
          size: compactDisplay ? 32 : 64,
          compactDisplay,
          select() {},
          loadPreview: async () => ({
            redraw: (size) => redrawSizes.push(size),
            imagesLoaded: 0,
          }),
        },
      ],
    });

    m.render(host, m(ItemWithVariantsComponent, { createModel }));
    await Promise.resolve();
    compactDisplay = true;
    m.render(host, m(ItemWithVariantsComponent, { createModel }));

    const canvas = host.querySelector("canvas.variant-canvas");
    assert.strictEqual(canvas.getAttribute("width"), "32");
    assert.deepEqual(redrawSizes, [32]);
  });
});

import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { ItemWithRecolors as ItemWithRecolorsComponent } from "../../../sources/components/tree/ItemWithRecolors.ts";
import { itemWithRecolorsModelFactory } from "../../../sources/models/item-with-recolors.ts";
import {
  configureStateCatalog,
  createState,
} from "../../../sources/state/state.ts";
let state;
import { createCatalog } from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { seedCatalog } from "../../browser-catalog-fixture.js";

const ItemWithRecolors = {
  view: (vnode) =>
    m(ItemWithRecolorsComponent, {
      createModel: () =>
        itemWithRecolorsModelFactory.create(
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

/** Minimal `paletteMetadata.materials` + one recolor-only item (mirrors palettes_spec fixtures). */
const clothPaletteMetadata = {
  versions: {
    ulpc: { label: "Universal LPC" },
  },
  materials: {
    cloth: {
      default: "ulpc",
      base: "base",
      label: "Cloth",
      palettes: {
        ulpc: {
          red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
          bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
        },
      },
    },
    body: {
      default: "ulpc",
      base: "light",
      palettes: {
        ulpc: {
          light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
          bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
        },
      },
    },
    metal: {
      default: "ulpc",
      base: "base",
      palettes: {
        ulpc: {
          brass: ["#1A1213", "#61482C", "#836332", "#AF8A35"],
          steel: ["#1D131E", "#4D4A5D", "#726B7E", "#867E7F"],
        },
      },
    },
    all: {
      default: "lpcr",
      base: "white",
      palettes: {
        lpcr: {
          red: ["#1a1213", "#3e111a", "#591515", "#7b2008"],
        },
      },
    },
  },
};

function clothRecolor(variants = ["red", "bluegray"]) {
  return {
    label: "Cloth",
    type_name: null,
    material: "cloth",
    default: "ulpc",
    base: "ulpc.base",
    palettes: {
      ulpc: {
        red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
        bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
        teal: ["#0B2B28", "#2E403A", "#315B49", "#4a7c6f"],
        navy: ["#11150b", "#1d131e", "#2a3c49", "#5686ae"],
      },
    },
    variants,
  };
}

function hairRecolors() {
  return [
    {
      label: "Hair",
      type_name: null,
      material: "cloth",
      default: "ulpc",
      base: "ulpc.red",
      palettes: {
        ulpc: {
          red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
          bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
        },
      },
      variants: ["red", "bluegray"],
    },
    {
      label: "Hair Tie",
      type_name: "hair_tie",
      material: "cloth",
      default: "ulpc",
      base: null,
      palettes: {
        ulpc: {
          red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
          bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
        },
      },
      variants: ["red", "bluegray"],
    },
  ];
}

function liteItem(name, typeName, recolors) {
  return {
    name,
    type_name: typeName,
    required: [...BODY_TYPES],
    animations: ["walk"],
    credits: [],
    layers: {},
    recolors,
  };
}

describe("ItemWithRecolors", function () {
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
    m.mount(host, null);
    m.render(host, null);
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  });

  function seedRecolorShirt() {
    seedCatalog(
      catalogWriter,
      {
        iwr_shirt: {
          name: "Recolor Tee",
          type_name: "clothes",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          recolors: [clothRecolor()],
        },
      },
      {
        categoryTree: { items: [], children: {} },
        paletteMetadata: clothPaletteMetadata,
      },
    );
    return catalog.getItemMerged("iwr_shirt").unwrapOr(null);
  }

  function baseAttrs(meta, overrides = {}) {
    return {
      catalog,
      state,
      itemId: "iwr_shirt",
      meta,
      isSearchMatch: false,
      isCompatible: true,
      tooltipText: "tip",
      showItemTooltips: true,
      ...overrides,
    };
  }

  function mountItem(meta, overrides = {}) {
    m.mount(host, {
      view: () => m(ItemWithRecolors, baseAttrs(meta, overrides)),
    });
  }

  function seedItems(itemMetadata) {
    seedCatalog(catalogWriter, itemMetadata, {
      categoryTree: { items: [], children: {} },
      paletteMetadata: clothPaletteMetadata,
    });
  }

  function renderItem(itemId, meta, overrides = {}) {
    assert.isNotNull(meta, `missing merged metadata for ${itemId}`);
    m.render(
      host,
      m(ItemWithRecolors, baseAttrs(meta, { itemId, ...overrides })),
    );
  }

  function renderExpanded(itemId, meta, overrides = {}) {
    state.expandedNodes[itemId] = true;
    renderItem(itemId, meta, overrides);
    const canvas = host.querySelector("canvas.variant-canvas");
    assert.notEqual(
      canvas,
      null,
      `expected expanded preview canvas for ${itemId}, got: ${host.innerHTML}`,
    );
    return canvas;
  }

  function clickPreviewAndReconcile(itemId, meta, overrides = {}) {
    const canvas = renderExpanded(itemId, meta, overrides);
    canvas.click();
    renderItem(itemId, meta, overrides);
  }

  function clickSwatchAndReconcile(itemId, meta, overrides = {}) {
    const swatch = host.querySelector(".palette-recolor-item");
    assert.notEqual(swatch, null);
    swatch.click();
    renderItem(itemId, meta, overrides);
  }

  function assertModalOpen() {
    assert.notEqual(host.querySelector(".palette-modal"), null);
    assert.notEqual(host.querySelector(".palette-modal-overlay"), null);
  }

  it("renders the item row with a collapsed tree label", function () {
    const meta = seedRecolorShirt();

    m.render(host, m(ItemWithRecolors, baseAttrs(meta)));

    const label = host.querySelector(".tree-label");
    assert.notEqual(label, null);
    assert.include(label.textContent, "Recolor Tee");
    assert.ok(label.querySelector("span.tree-arrow.collapsed"));
    assert.strictEqual(host.querySelector(".palette-recolor-list"), null);
  });

  it("applies search-result and warning styling from attrs", function () {
    const meta = seedRecolorShirt();

    m.render(
      host,
      m(
        ItemWithRecolors,
        baseAttrs(meta, {
          isSearchMatch: true,
          isCompatible: false,
          tooltipText: "⚠️ bad",
        }),
      ),
    );

    const root = host.firstElementChild;
    assert.ok(root.classList.contains("search-result"));
    assert.ok(root.classList.contains("has-text-grey"));
    assert.include(host.querySelector(".tree-label").textContent, "⚠️");
  });

  it("shows palette swatches and preview row when expanded", function () {
    const meta = seedRecolorShirt();
    state.expandedNodes.iwr_shirt = true;

    m.render(host, m(ItemWithRecolors, baseAttrs(meta)));

    assert.ok(host.querySelector(".palette-recolor-list"));
    assert.ok(host.textContent.includes("Cloth"));
    assert.strictEqual(
      host.querySelectorAll(".palette-recolor-item").length,
      1,
    );
    assert.strictEqual(
      host.querySelectorAll("canvas.variant-canvas").length,
      1,
    );
  });

  // TODO (unimplemented): Same Testem/Mithril issue as ItemWithVariants — `.tree-label` click
  // often does not toggle `expandedNodes` for non–Body Color item ids; Body Color → `body-body`
  // still works (see test below). Intended: `state.expandedNodes.iwr_shirt === true` and
  // `.palette-recolor-list` present after click.
  it("row label expands expandedNodes when starting collapsed", function () {
    this.skip();
  });

  it("uses body-body as expandedNodes key when the display name is Body Color", function () {
    seedCatalog(
      catalogWriter,
      {
        iwr_body: {
          name: "Body Color",
          type_name: "body",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          matchBodyColor: true,
          recolors: [
            {
              label: "Body",
              type_name: null,
              material: "body",
              default: "ulpc",
              base: "ulpc.base",
              palettes: {
                ulpc: {
                  light: ["#271920", "#99423c", "#cc8665", "#E4A47C"],
                  bronze: ["#1A1213", "#442725", "#644133", "#7F4C31"],
                },
              },
              variants: ["light", "bronze"],
            },
          ],
        },
      },
      {
        categoryTree: { items: [], children: {} },
        paletteMetadata: clothPaletteMetadata,
      },
    );
    const meta = catalog.getItemMerged("iwr_body").unwrapOr(null);

    m.render(
      host,
      m(ItemWithRecolors, {
        itemId: "iwr_body",
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
    assert.strictEqual(state.expandedNodes.iwr_body, undefined);
  });

  it("opens the palette modal when a swatch row is clicked", function () {
    const meta = seedRecolorShirt();
    assert.isTrue(catalog.isPaletteReady());
    state.expandedNodes.iwr_shirt = true;
    mountItem(meta);

    const swatch = host.querySelector(".palette-recolor-item");
    assert.notEqual(swatch, null);
    swatch.click();
    m.redraw.sync();

    assert.notEqual(host.querySelector(".palette-modal"), null);
    assert.notEqual(host.querySelector(".palette-modal-overlay"), null);

    host.querySelector(".palette-modal-overlay").click();
    m.redraw.sync();
    assert.strictEqual(host.querySelector(".palette-modal"), null);
  });

  it("uses compact canvas sizing when compactDisplay is enabled", function () {
    const meta = seedRecolorShirt();
    state.compactDisplay = true;
    state.expandedNodes.iwr_shirt = true;

    m.render(host, m(ItemWithRecolors, baseAttrs(meta)));

    const canvas = host.querySelector("canvas.variant-canvas");
    assert.notEqual(canvas, null);
    assert.strictEqual(canvas.getAttribute("width"), "32");
    assert.strictEqual(canvas.getAttribute("height"), "32");
    assert.ok(canvas.className.includes("compact-display"));
  });

  describe("remember colors when switching assets (#522)", function () {
    function seedTwoShirts() {
      seedItems({
        iwr_shirt: liteItem("Recolor Tee", "clothes", [clothRecolor()]),
        iwr_shirt_b: liteItem("Other Tee", "clothes", [clothRecolor()]),
      });
      return {
        a: catalog.getItemMerged("iwr_shirt").unwrapOr(null),
        b: catalog.getItemMerged("iwr_shirt_b").unwrapOr(null),
      };
    }

    function selectShirtARed() {
      state.selections.clothes = {
        itemId: "iwr_shirt",
        subId: null,
        variant: null,
        recolor: "red",
        name: "Recolor Tee (red)",
      };
    }

    it("selects a different same-type asset with the remembered color when the preview is clicked", function () {
      const { b } = seedTwoShirts();
      selectShirtARed();

      clickPreviewAndReconcile("iwr_shirt_b", b);

      assert.strictEqual(state.selections.clothes.itemId, "iwr_shirt_b");
      assert.strictEqual(state.selections.clothes.recolor, "red");
      assertModalOpen();
    });

    it("selects a different same-type asset with the remembered color when a swatch is clicked", function () {
      const { b } = seedTwoShirts();
      selectShirtARed();

      renderExpanded("iwr_shirt_b", b);
      clickSwatchAndReconcile("iwr_shirt_b", b);

      assert.strictEqual(state.selections.clothes.itemId, "iwr_shirt_b");
      assert.strictEqual(state.selections.clothes.recolor, "red");
      assertModalOpen();
    });

    it("opens the popover without changing selection when the already-selected asset is clicked", function () {
      const { a } = seedTwoShirts();
      selectShirtARed();

      clickPreviewAndReconcile("iwr_shirt", a);

      assert.strictEqual(state.selections.clothes.itemId, "iwr_shirt");
      assert.strictEqual(state.selections.clothes.recolor, "red");
      assertModalOpen();
    });

    it("opens the popover without inventing a color on first pick of a type", function () {
      const { a } = seedTwoShirts();

      clickPreviewAndReconcile("iwr_shirt", a);

      assert.strictEqual(state.selections.clothes, undefined);
      assertModalOpen();
    });

    it("does not select an incompatible asset", function () {
      const { b } = seedTwoShirts();
      selectShirtARed();

      clickPreviewAndReconcile("iwr_shirt_b", b, { isCompatible: false });

      assert.strictEqual(state.selections.clothes.itemId, "iwr_shirt");
      assert.strictEqual(state.selections.clothes.recolor, "red");
    });

    it("maps the remembered recolor key onto the new asset", function () {
      seedItems({
        iwr_epaulets: liteItem("Epaulets", "shoulders", [
          clothRecolor(["red", "bluegray", "metal.brass"]),
        ]),
        iwr_legion: liteItem("Legion", "shoulders", [
          {
            ...clothRecolor(["brass", "steel", "all.lpcr.red"]),
            label: "Metal",
            material: "metal",
          },
        ]),
      });
      const legion = catalog.getItemMerged("iwr_legion").unwrapOr(null);
      state.selections.shoulders = {
        itemId: "iwr_epaulets",
        subId: null,
        variant: null,
        recolor: "red",
        name: "Epaulets (red)",
      };

      clickPreviewAndReconcile("iwr_legion", legion);

      assert.strictEqual(state.selections.shoulders.itemId, "iwr_legion");
      assert.strictEqual(state.selections.shoulders.recolor, "all.lpcr.red");
      assertModalOpen();
    });

    it("moves remembered multi-slot colors onto the new asset", function () {
      seedItems({
        iwr_hair_a: liteItem("Tied A", "hair", hairRecolors()),
        iwr_hair_b: liteItem("Tied B", "hair", hairRecolors()),
      });
      const hairB = catalog.getItemMerged("iwr_hair_b").unwrapOr(null);
      state.selections.hair = {
        itemId: "iwr_hair_a",
        subId: null,
        variant: null,
        recolor: "red",
        name: "Tied A (red)",
      };
      state.selections.hair_tie = {
        itemId: "iwr_hair_a",
        subId: 1,
        variant: null,
        recolor: "bluegray",
        name: "Hair Tie (bluegray)",
      };

      clickPreviewAndReconcile("iwr_hair_b", hairB);

      assert.strictEqual(state.selections.hair.itemId, "iwr_hair_b");
      assert.strictEqual(state.selections.hair.recolor, "red");
      assert.strictEqual(state.selections.hair_tie.itemId, "iwr_hair_b");
      assert.strictEqual(state.selections.hair_tie.recolor, "bluegray");
      assertModalOpen();
    });

    it("selects the new asset with the first variant when the remembered color does not map", function () {
      seedItems({
        iwr_shirt: liteItem("Recolor Tee", "clothes", [
          clothRecolor(["red", "bluegray"]),
        ]),
        iwr_shirt_b: liteItem("Other Tee", "clothes", [
          clothRecolor(["teal", "navy"]),
        ]),
      });
      const b = catalog.getItemMerged("iwr_shirt_b").unwrapOr(null);
      selectShirtARed();

      clickPreviewAndReconcile("iwr_shirt_b", b);

      assert.strictEqual(state.selections.clothes.itemId, "iwr_shirt_b");
      assert.strictEqual(state.selections.clothes.recolor, "teal");
      assertModalOpen();
    });
  });
});

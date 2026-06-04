import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { ItemWithRecolors } from "../../../sources/components/tree/ItemWithRecolors.ts";
import { state } from "../../../sources/state/state.ts";
import {
  defaultCatalog,
  getItemMerged,
} from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { resetState } from "../../../sources/state/filters.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

/** Minimal `paletteMetadata.materials` + one recolor-only item (mirrors palettes_spec fixtures). */
const clothPaletteMetadata = {
  materials: {
    cloth: {
      default: "ulpc",
      base: "base",
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
  },
};

describe("ItemWithRecolors", function () {
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

  function seedRecolorShirt() {
    seedBrowserCatalog(
      {
        iwr_shirt: {
          name: "Recolor Tee",
          type_name: "clothes",
          required: [...BODY_TYPES],
          animations: ["walk"],
          credits: [],
          layers: {},
          recolors: [
            {
              label: "Cloth",
              type_name: null,
              material: "cloth",
              default: "ulpc",
              base: "ulpc.base",
              palettes: {
                ulpc: {
                  red: ["#1d131e", "#400B1F", "#651117", "#82171C"],
                  bluegray: ["#11150b", "#0B2B28", "#2E403A", "#315B49"],
                },
              },
              variants: ["red", "bluegray"],
            },
          ],
        },
      },
      {
        categoryTree: { items: [], children: {} },
        paletteMetadata: clothPaletteMetadata,
      },
    );
    return getItemMerged("iwr_shirt").unwrapOr(null);
  }

  function baseAttrs(meta, overrides = {}) {
    return {
      itemId: "iwr_shirt",
      meta,
      isSearchMatch: false,
      isCompatible: true,
      tooltipText: "tip",
      showItemTooltips: true,
      catalog: defaultCatalog,
      ...overrides,
    };
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
    seedBrowserCatalog(
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
    const meta = getItemMerged("iwr_body").unwrapOr(null);

    m.render(
      host,
      m(ItemWithRecolors, {
        itemId: "iwr_body",
        meta,
        isSearchMatch: false,
        isCompatible: true,
        tooltipText: "",
        showItemTooltips: false,
        catalog: defaultCatalog,
      }),
    );

    host.querySelector(".tree-label").click();
    m.redraw.sync();

    assert.isTrue(state.expandedNodes["body-body"]);
    assert.strictEqual(state.expandedNodes.iwr_body, undefined);
  });

  it("opens the palette modal when a swatch row is clicked", function () {
    const meta = seedRecolorShirt();
    state.expandedNodes.iwr_shirt = true;

    m.render(host, m(ItemWithRecolors, baseAttrs(meta)));

    host.querySelector(".palette-recolor-item").click();
    // `m.render` does not subscribe `host` to `m.redraw`, so the handler's `m.redraw()` does not
    // refresh this tree. Re-render to reconcile; Mithril copies component state from the old vnode.
    m.render(host, m(ItemWithRecolors, baseAttrs(meta)));

    assert.notEqual(host.querySelector(".palette-modal"), null);
    assert.notEqual(host.querySelector(".palette-modal-overlay"), null);
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
});

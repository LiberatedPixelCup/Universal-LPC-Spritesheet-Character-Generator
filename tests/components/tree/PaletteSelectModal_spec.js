import m from "mithril";
import { assert } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { PaletteSelectModal } from "../../../sources/components/tree/PaletteSelectModal.ts";
import { state } from "../../../sources/state/state.ts";
import {
  defaultCatalog,
  isLayersReady,
  isLiteReady,
  isPaletteReady,
  resetCatalogForTests,
  registerFromCreditsModule,
  registerFromIndexModule,
  registerFromItemModule,
  registerFromPaletteModule,
} from "../../../sources/state/catalog.ts";
import { BODY_TYPES } from "../../../sources/state/constants.ts";
import { resetState } from "../../../sources/state/filters.ts";
import { buildItemsByTypeNameLite } from "../../../sources/state/resolve-hash-param.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../../browser-catalog-fixture.js";

const PSM_SHIRT = "psm_shirt";

/** Full palette metadata: `versions` labels + material labels for modal headings. */
const modalPaletteMetadata = {
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
  },
};

function splitItemMetadataForRegisters(itemMetadata) {
  const itemMetadataLite = {};
  const itemCredits = {};
  const itemLayers = {};
  for (const [itemId, meta] of Object.entries(itemMetadata)) {
    const { layers, credits, ...lite } = meta;
    itemMetadataLite[itemId] = lite;
    itemCredits[itemId] = credits ?? [];
    itemLayers[itemId] = layers ?? {};
  }
  return { itemMetadataLite, itemCredits, itemLayers };
}

function psmShirtItem() {
  return {
    [PSM_SHIRT]: {
      name: "Modal Tee",
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
  };
}

/** `opt` shape matches `getPaletteOptions` but `versions` use `material.version` (modal `split`). */
function clothOptFromPaletteOptions() {
  return {
    idx: 0,
    label: "Cloth",
    default: "ulpc",
    material: "cloth",
    type_name: null,
    matchBodyColor: false,
    versions: ["cloth.ulpc"],
    selectionColor: null,
    sourceColors: null,
    colors: ["#1d131e", "#400B1F", "#651117", "#82171C"],
  };
}

function clothOptWithSourceFromPaletteOptions() {
  return {
    ...clothOptFromPaletteOptions(),
    versions: ["cloth.custom", "cloth.ulpc"],
    sourceColors: ["#1d131e", "#54242E", "#6C3536", "#8c288b"],
  };
}

function rootViewNodeStub() {
  return { state: {} };
}

describe("PaletteSelectModal", function () {
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

  function modalAttrs(overrides = {}) {
    const base = {
      itemId: PSM_SHIRT,
      opt: clothOptFromPaletteOptions(),
      selectedColors: {},
      compactDisplay: state.compactDisplay,
      rootViewNode: rootViewNodeStub(),
      onClose: () => {},
      onSelect: () => {},
      catalog: defaultCatalog,
    };
    return { ...base, ...overrides };
  }

  it("shows loading palette copy when the palette chunk is not registered", function () {
    resetCatalogForTests();

    m.render(host, m(PaletteSelectModal, modalAttrs()));

    assert.strictEqual(isPaletteReady(), false);
    assert.include(host.textContent, "Loading palette data…");
    assert.notEqual(host.querySelector(".palette-modal-overlay"), null);
    assert.strictEqual(
      host.querySelector(".palette-modal")?.getAttribute("data-previews-ready"),
      "false",
    );
  });

  it("shows loading layer copy when lite is ready but layers are not", function () {
    resetCatalogForTests();
    const itemMetadata = psmShirtItem();
    const byTypeName = buildItemsByTypeNameLite(itemMetadata);
    registerFromIndexModule({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: {
        byTypeName,
        hashMatch: { itemsByTypeName: byTypeName },
      },
    });
    registerFromPaletteModule({
      paletteMetadata: modalPaletteMetadata,
    });
    const { itemMetadataLite, itemCredits } =
      splitItemMetadataForRegisters(itemMetadata);
    registerFromItemModule({ itemMetadata: itemMetadataLite });
    registerFromCreditsModule({ itemCredits });
    assert.strictEqual(isPaletteReady(), true);
    assert.strictEqual(isLiteReady(), true);
    assert.strictEqual(isLayersReady(), false);

    m.render(host, m(PaletteSelectModal, modalAttrs()));

    assert.include(host.textContent, "Loading layer data…");
    assert.strictEqual(
      host.querySelector(".palette-modal")?.getAttribute("data-previews-ready"),
      "false",
    );
  });

  it("renders header, version row, and variant tiles when catalog data is ready", async function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    const rootViewNode = rootViewNodeStub();
    const attrs = modalAttrs({ rootViewNode });
    m.render(host, m(PaletteSelectModal, attrs));

    assert.include(
      host.querySelector(".palette-modal h4")?.textContent,
      "Cloth",
    );
    assert.strictEqual(
      host.querySelectorAll(".palette-modal-version-block").length,
      1,
    );
    assert.ok(
      host.querySelector(".palette-modal .tree-label .tree-arrow.expanded"),
    );
    assert.strictEqual(
      host.querySelectorAll(".palette-modal .variant-item").length,
      2,
    );

    await new Promise((r) => requestAnimationFrame(r));
    m.render(host, m(PaletteSelectModal, attrs));
    assert.strictEqual(
      host.querySelector(".palette-modal")?.getAttribute("data-previews-ready"),
      "true",
    );
  });

  it("invokes onClose when the overlay is clicked", function () {
    resetCatalogForTests();
    let closed = 0;
    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          onClose: () => {
            closed++;
          },
        }),
      ),
    );

    host.querySelector(".palette-modal-overlay").click();
    assert.strictEqual(closed, 1);
  });

  it("invokes onClose when the header close button is clicked", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });
    let closed = 0;
    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          onClose: () => {
            closed++;
          },
        }),
      ),
    );

    const btn = host.querySelector(".palette-modal header button");
    assert.notEqual(btn, null);
    btn.click();
    assert.strictEqual(closed, 1);
  });

  it("invokes onSelect with the recolor key when a variant tile is clicked", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    let selected = null;
    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          onSelect: (key) => {
            selected = key;
          },
        }),
      ),
    );

    host.querySelector(".palette-modal .variant-item").click();
    assert.strictEqual(selected, "red");
  });

  it("uses compact canvas dimensions when compactDisplay is enabled", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });
    state.compactDisplay = true;

    m.render(host, m(PaletteSelectModal, modalAttrs({ compactDisplay: true })));

    const canvas = host.querySelector(".palette-modal canvas.variant-canvas");
    assert.notEqual(canvas, null);
    assert.strictEqual(canvas.getAttribute("width"), "32");
    assert.strictEqual(canvas.getAttribute("height"), "32");
    assert.ok(canvas.className.includes("compact-display"));
  });

  it("does not render a source tile when sourceColors is missing", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    m.render(host, m(PaletteSelectModal, modalAttrs()));

    const labels = Array.from(
      host.querySelectorAll(".variant-display-name"),
    ).map((el) => el.textContent?.trim().toLowerCase());

    assert.isFalse(labels.includes("source"));
  });

  it("renders a source tile first when sourceColors is provided", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          opt: clothOptWithSourceFromPaletteOptions(),
        }),
      ),
    );

    const labels = Array.from(
      host.querySelectorAll(".variant-display-name"),
    ).map((el) => el.textContent?.trim());

    assert.strictEqual(labels[0], "Source");
  });

  it("invokes onSelect with source when source tile is clicked", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    let selected = null;
    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          opt: clothOptWithSourceFromPaletteOptions(),
          onSelect: (key) => {
            selected = key;
          },
        }),
      ),
    );

    const sourceLabel = Array.from(
      host.querySelectorAll(".variant-display-name"),
    ).find((el) => el.textContent?.trim().toLowerCase() === "source");
    assert.notEqual(sourceLabel, null);
    sourceLabel.closest(".variant-item")?.click();

    assert.strictEqual(selected, "source");
  });

  it("renders source in a standalone block above version categories", function () {
    seedBrowserCatalog(psmShirtItem(), {
      categoryTree: { items: [], children: {} },
      paletteMetadata: modalPaletteMetadata,
    });

    m.render(
      host,
      m(
        PaletteSelectModal,
        modalAttrs({
          opt: clothOptWithSourceFromPaletteOptions(),
        }),
      ),
    );

    const sourceBlock = host.querySelector(".palette-modal-source-block");
    const firstVersionBlock = host.querySelector(
      ".palette-modal-version-block",
    );
    assert.notEqual(sourceBlock, null);
    assert.notEqual(firstVersionBlock, null);
    assert.isTrue(
      Boolean(
        sourceBlock &&
        firstVersionBlock &&
        sourceBlock.compareDocumentPosition(firstVersionBlock) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    );
  });
});

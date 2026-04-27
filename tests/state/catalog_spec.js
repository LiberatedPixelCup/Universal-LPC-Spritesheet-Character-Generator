import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  catalogReady,
  getAliasMetadata,
  getCategoryTree,
  getItemCredits,
  getItemLayers,
  getItemLite,
  getMetadataIndexes,
  getPaletteMetadata,
  isCreditsReady,
  isHashHydrationReady,
  isIndexReady,
  isLayersReady,
  isLiteReady,
  isPaletteReady,
  loadCatalogFromFixtures,
  registerFromCreditsModule,
  registerFromIndexModule,
  registerFromItemModule,
  registerFromLayersModule,
  registerFromPaletteModule,
  resetCatalogForTests,
  stages,
} from "../../sources/state/catalog.js";
import { restoreAppCatalogAfterTest } from "../browser-catalog-fixture.js";

describe("state/catalog.js", () => {
  beforeEach(() => {
    resetCatalogForTests();
  });

  afterEach(async () => {
    await restoreAppCatalogAfterTest();
  });

  it("resetCatalogForTests clears readiness and getters", () => {
    loadCatalogFromFixtures({
      itemMetadata: { a: { name: "A", layers: {}, credits: [] } },
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
      paletteMetadata: { versions: {}, materials: {} },
    });
    expect(isIndexReady()).to.be.true;
    resetCatalogForTests();
    expect(isIndexReady()).to.be.false;
    expect(isLiteReady()).to.be.false;
    expect(isCreditsReady()).to.be.false;
    expect(isPaletteReady()).to.be.false;
    expect(isLayersReady()).to.be.false;
    expect(getAliasMetadata()).to.equal(null);
    expect(getItemCredits("a")).to.deep.equal([]);
  });

  it("registerFromIndexModule: index ready and onIndexReady settles", async () => {
    expect(isIndexReady()).to.be.false;
    const aliasInner = { flag: 1 };
    const done = catalogReady.onIndexReady;
    registerFromIndexModule({
      aliasMetadata: { x: aliasInner },
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
    });
    expect(isIndexReady()).to.be.true;
    await done;
    expect(getAliasMetadata().x).to.equal(aliasInner);
  });

  it("isHashHydrationReady requires index and lite", () => {
    expect(isHashHydrationReady()).to.be.false;
    registerFromIndexModule({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
    });
    expect(isHashHydrationReady()).to.be.false;
    registerFromItemModule({ itemMetadata: { id1: { name: "n" } } });
    expect(isHashHydrationReady()).to.be.true;
  });

  it("expands interned item lites from shared index variant tables", () => {
    const variantArrays = [["male", "female"]];
    const recolorVariantArrays = [[]];
    const byType = {
      body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
    };
    const metadataIndexes = {
      variantArrays,
      recolorVariantArrays,
      byTypeName: byType,
      hashMatch: { itemsByTypeName: byType },
    };
    registerFromIndexModule({
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes,
    });
    registerFromItemModule({
      itemMetadata: {
        b1: { name: "Body", type_name: "body", v: 0, r: 0, recolors: [] },
      },
    });
    const lite = getItemLite("b1");
    expect(lite.variants).to.deep.equal(["male", "female"]);
    expect(lite).to.not.have.property("v");
  });

  it("getItemCredits defaults to [] when stage missing or key missing", () => {
    expect(getItemCredits("any")).to.deep.equal([]);
    registerFromCreditsModule({ itemCredits: {} });
    expect(getItemCredits("missing")).to.deep.equal([]);
    registerFromCreditsModule({
      itemCredits: { k: [{ file: "f", licenses: ["MIT"] }] },
    });
    expect(getItemCredits("k").length).to.equal(1);
  });

  it("getItemLayers returns {} for missing id when layers ready", () => {
    expect(getItemLayers("z")).to.equal(undefined);
    registerFromLayersModule({ itemLayers: {} });
    expect(getItemLayers("z")).to.deep.equal({});
  });

  it("loadCatalogFromFixtures: split merged itemMetadata, getters, onAllReady", async () => {
    const byTypeName = {
      feet: [
        {
          itemId: "boots1",
          name: "Boots",
          type_name: "feet",
          variants: [],
          recolors: [],
        },
      ],
    };
    const fixtureGlobals = {
      itemMetadata: {
        boots1: {
          name: "Boots",
          type_name: "feet",
          layers: { layer_1: { male: "spritesheets/feet/boots.png" } },
          credits: [{ file: "artist/foo.png", licenses: ["CC0"] }],
          variants: [],
          recolors: [],
        },
      },
      aliasMetadata: {},
      categoryTree: { items: ["boots1"], children: {} },
      metadataIndexes: {
        byTypeName,
        hashMatch: { itemsByTypeName: byTypeName },
      },
      paletteMetadata: { versions: {}, materials: {} },
    };
    loadCatalogFromFixtures(fixtureGlobals);
    await catalogReady.onAllReady;
    expect(isIndexReady() && isLiteReady() && isCreditsReady()).to.be.true;
    expect(isPaletteReady() && isLayersReady()).to.be.true;
    expect(isHashHydrationReady()).to.be.true;
    expect(getCategoryTree()).to.equal(fixtureGlobals.categoryTree);
    expect(getMetadataIndexes()).to.equal(fixtureGlobals.metadataIndexes);
    expect(getPaletteMetadata()).to.equal(fixtureGlobals.paletteMetadata);
    const lite = getItemLite("boots1");
    expect(lite).to.be.an("object");
    expect(lite).to.have.property("name", "Boots");
    expect(lite).to.not.have.property("layers");
    expect(lite).to.not.have.property("credits");
    expect(getItemCredits("boots1")).to.deep.equal(
      fixtureGlobals.itemMetadata.boots1.credits,
    );
    expect(getItemLayers("boots1")).to.deep.equal(
      fixtureGlobals.itemMetadata.boots1.layers,
    );
  });

  describe("stages.<chunk>.resolved", () => {
    it("starts false for every stage", () => {
      expect(stages.index.resolved).to.be.false;
      expect(stages.lite.resolved).to.be.false;
      expect(stages.credits.resolved).to.be.false;
      expect(stages.palette.resolved).to.be.false;
      expect(stages.layers.resolved).to.be.false;
    });

    it("flips true once the matching register* runs", () => {
      registerFromIndexModule({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      expect(stages.index.resolved).to.be.true;
      expect(stages.lite.resolved).to.be.false;

      registerFromItemModule({ itemMetadata: {} });
      expect(stages.lite.resolved).to.be.true;

      registerFromCreditsModule({ itemCredits: {} });
      expect(stages.credits.resolved).to.be.true;

      registerFromLayersModule({ itemLayers: {} });
      expect(stages.layers.resolved).to.be.true;

      registerFromPaletteModule({
        paletteMetadata: { versions: {}, materials: {} },
      });
      expect(stages.palette.resolved).to.be.true;
    });

    it("resets to false after resetCatalogForTests()", () => {
      registerFromItemModule({ itemMetadata: { a: { name: "A" } } });
      expect(stages.lite.resolved).to.be.true;
      resetCatalogForTests();
      expect(stages.lite.resolved).to.be.false;
    });
  });
});

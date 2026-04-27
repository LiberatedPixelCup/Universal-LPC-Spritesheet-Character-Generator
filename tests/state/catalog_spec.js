import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  catalogReady,
  getAliasMetadata,
  getCategoryTree,
  getItemCredits,
  getItemLayers,
  getItemLite,
  getItemMerged,
  getMetadataIndexes,
  getPaletteMetadata,
  isCreditsReady,
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
} from "../../sources/state/catalog.ts";
import { restoreAppCatalogAfterTest } from "../browser-catalog-fixture.js";

describe("state/catalog.ts", () => {
  beforeEach(() => {
    resetCatalogForTests();
  });

  afterEach(async () => {
    await restoreAppCatalogAfterTest();
  });

  describe("isXReady predicates", () => {
    it("all start false", () => {
      expect(isIndexReady()).to.be.false;
      expect(isLiteReady()).to.be.false;
      expect(isCreditsReady()).to.be.false;
      expect(isPaletteReady()).to.be.false;
      expect(isLayersReady()).to.be.false;
    });

    it("flips true once the matching register* runs", () => {
      registerFromIndexModule({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      expect(isIndexReady()).to.be.true;
      expect(isLiteReady()).to.be.false;

      registerFromItemModule({ itemMetadata: {} });
      expect(isLiteReady()).to.be.true;

      registerFromCreditsModule({ itemCredits: {} });
      expect(isCreditsReady()).to.be.true;

      registerFromLayersModule({ itemLayers: {} });
      expect(isLayersReady()).to.be.true;

      registerFromPaletteModule({
        paletteMetadata: { versions: {}, materials: {} },
      });
      expect(isPaletteReady()).to.be.true;
    });

    it("resets to false after resetCatalogForTests()", () => {
      registerFromItemModule({ itemMetadata: { a: { name: "A" } } });
      expect(isLiteReady()).to.be.true;
      resetCatalogForTests();
      expect(isLiteReady()).to.be.false;
    });
  });

  describe("catalogReady promises", () => {
    it("onIndexReady settles after registerFromIndexModule, alias data is queryable", async () => {
      const done = catalogReady.onIndexReady;
      registerFromIndexModule({
        aliasMetadata: { x: { typeName: "y", name: "n", variant: "v" } },
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      await done;
      const aliasResult = getAliasMetadata();
      expect(aliasResult.isOk()).to.be.true;
      expect(aliasResult.unwrapOr({}).x.typeName).to.equal("y");
    });

    it("onAllReady settles after every chunk loads", async () => {
      // Note: loadCatalogFromFixtures internally resets stages (recreating
      // their backing promises), so we capture `onAllReady` AFTER the call.
      loadCatalogFromFixtures({
        itemMetadata: { a: { name: "A", layers: {}, credits: [] } },
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
        paletteMetadata: { versions: {}, materials: {} },
      });
      await catalogReady.onAllReady;
      expect(isIndexReady()).to.be.true;
      expect(isLiteReady()).to.be.true;
      expect(isCreditsReady()).to.be.true;
      expect(isLayersReady()).to.be.true;
      expect(isPaletteReady()).to.be.true;
    });
  });

  describe("registerFromIndexModule", () => {
    it("expands interned item lites from shared index variant tables", () => {
      const variantArrays = [["male", "female"]];
      const recolorVariantArrays = [[]];
      const byType = {
        body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
      };
      registerFromIndexModule({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: {
          variantArrays,
          recolorVariantArrays,
          byTypeName: byType,
          hashMatch: { itemsByTypeName: byType },
        },
      });
      registerFromItemModule({
        itemMetadata: {
          b1: { name: "Body", type_name: "body", v: 0, r: 0, recolors: [] },
        },
      });
      const lite = getItemLite("b1").unwrapOr(null);
      expect(lite).to.not.equal(null);
      expect(lite.variants).to.deep.equal(["male", "female"]);
      expect(lite).to.not.have.property("v");
    });
  });

  describe("loadCatalogFromFixtures", () => {
    it("splits merged itemMetadata into lite/credits/layers", async () => {
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

      expect(getCategoryTree().unwrapOr(null)).to.equal(
        fixtureGlobals.categoryTree,
      );
      expect(getMetadataIndexes().unwrapOr(null)).to.equal(
        fixtureGlobals.metadataIndexes,
      );
      expect(getPaletteMetadata().unwrapOr(null)).to.equal(
        fixtureGlobals.paletteMetadata,
      );

      const lite = getItemLite("boots1").unwrapOr(null);
      expect(lite).to.have.property("name", "Boots");
      expect(lite).to.not.have.property("layers");
      expect(lite).to.not.have.property("credits");

      expect(getItemCredits("boots1").unwrapOr([])).to.deep.equal(
        fixtureGlobals.itemMetadata.boots1.credits,
      );
      expect(getItemLayers("boots1").unwrapOr({})).to.deep.equal(
        fixtureGlobals.itemMetadata.boots1.layers,
      );

      // Merged getter also surfaces lite + layers + credits.
      const merged = getItemMerged("boots1").unwrapOr(null);
      expect(merged.name).to.equal("Boots");
      expect(merged.layers.layer_1.male).to.equal(
        "spritesheets/feet/boots.png",
      );
      expect(merged.credits[0].licenses).to.deep.equal(["CC0"]);
    });
  });

  describe("resetCatalogForTests", () => {
    it("flips every getter back to Err({kind:'loading'})", () => {
      loadCatalogFromFixtures({
        itemMetadata: { a: { name: "A", layers: {}, credits: [] } },
        aliasMetadata: {
          someAlias: { typeName: "t", name: "n", variant: "v" },
        },
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

      // Public-API observation: every getter now reports loading.
      const expectLoadingErr = (r, chunk) => {
        expect(r.isErr()).to.be.true;
        if (r.isErr()) {
          expect(r.error.kind).to.equal("loading");
          expect(r.error.chunk).to.equal(chunk);
        }
      };
      expectLoadingErr(getItemLite("a"), "lite");
      expectLoadingErr(getItemMerged("a"), "lite");
      expectLoadingErr(getItemCredits("a"), "credits");
      expectLoadingErr(getItemLayers("a"), "layers");
      expectLoadingErr(getPaletteMetadata(), "palette");
      expectLoadingErr(getCategoryTree(), "index");
      expectLoadingErr(getMetadataIndexes(), "index");
      expectLoadingErr(getAliasMetadata(), "index");
    });
  });
});

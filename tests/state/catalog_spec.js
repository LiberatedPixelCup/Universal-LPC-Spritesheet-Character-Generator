import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import { createCatalog } from "../../sources/state/catalog.ts";

let catalog;

describe("state/catalog.ts", () => {
  beforeEach(() => {
    catalog = createCatalog();
  });

  describe("isXReady predicates", () => {
    it("all start false", () => {
      expect(catalog.isIndexReady()).to.be.false;
      expect(catalog.isLiteReady()).to.be.false;
      expect(catalog.isCreditsReady()).to.be.false;
      expect(catalog.isPaletteReady()).to.be.false;
      expect(catalog.isLayersReady()).to.be.false;
    });

    it("flips true once the matching register* runs", () => {
      catalog.registerFromIndexModule({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      expect(catalog.isIndexReady()).to.be.true;
      expect(catalog.isLiteReady()).to.be.false;

      catalog.registerFromItemModule({ itemMetadata: {} });
      expect(catalog.isLiteReady()).to.be.true;

      catalog.registerFromCreditsModule({ itemCredits: {} });
      expect(catalog.isCreditsReady()).to.be.true;

      catalog.registerFromLayersModule({ itemLayers: {} });
      expect(catalog.isLayersReady()).to.be.true;

      catalog.registerFromPaletteModule({
        paletteMetadata: { versions: {}, materials: {} },
      });
      expect(catalog.isPaletteReady()).to.be.true;
    });
  });

  describe("catalog readiness promises", () => {
    it("onIndexReady settles after registerFromIndexModule, alias data is queryable", async () => {
      const done = catalog.ready.onIndexReady;
      catalog.registerFromIndexModule({
        aliasMetadata: { x: { typeName: "y", name: "n", variant: "v" } },
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      await done;
      const aliasResult = catalog.getAliasMetadata();
      expect(aliasResult.isOk()).to.be.true;
      expect(aliasResult.unwrapOr({}).x.typeName).to.equal("y");
    });

    it("onAllReady settles after every chunk loads", async () => {
      // Note: loadCatalogFromFixtures internally resets stages (recreating
      // their backing promises), so we capture `onAllReady` AFTER the call.
      catalog.loadCatalogFromFixtures({
        itemMetadata: { a: { name: "A", layers: {}, credits: [] } },
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
        paletteMetadata: { versions: {}, materials: {} },
      });
      await catalog.ready.onAllReady;
      expect(catalog.isIndexReady()).to.be.true;
      expect(catalog.isLiteReady()).to.be.true;
      expect(catalog.isCreditsReady()).to.be.true;
      expect(catalog.isLayersReady()).to.be.true;
      expect(catalog.isPaletteReady()).to.be.true;
    });
  });

  describe("registerFromIndexModule", () => {
    it("expands interned item lites from shared index variant tables", () => {
      const variantArrays = [["male", "female"]];
      const recolorVariantArrays = [[]];
      const byType = {
        body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
      };
      catalog.registerFromIndexModule({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: {
          variantArrays,
          recolorVariantArrays,
          byTypeName: byType,
          hashMatch: { itemsByTypeName: byType },
        },
      });
      catalog.registerFromItemModule({
        itemMetadata: {
          b1: { name: "Body", type_name: "body", v: 0, r: 0, recolors: [] },
        },
      });
      const lite = catalog.getItemLite("b1").unwrapOr(null);
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
      catalog.loadCatalogFromFixtures(fixtureGlobals);
      await catalog.ready.onAllReady;

      expect(catalog.getCategoryTree().unwrapOr(null)).to.equal(
        fixtureGlobals.categoryTree,
      );
      expect(catalog.getMetadataIndexes().unwrapOr(null)).to.equal(
        fixtureGlobals.metadataIndexes,
      );
      expect(catalog.getPaletteMetadata().unwrapOr(null)).to.equal(
        fixtureGlobals.paletteMetadata,
      );

      const lite = catalog.getItemLite("boots1").unwrapOr(null);
      expect(lite).to.have.property("name", "Boots");
      expect(lite).to.not.have.property("layers");
      expect(lite).to.not.have.property("credits");

      expect(catalog.getItemCredits("boots1").unwrapOr([])).to.deep.equal(
        fixtureGlobals.itemMetadata.boots1.credits,
      );
      expect(catalog.getItemLayers("boots1").unwrapOr({})).to.deep.equal(
        fixtureGlobals.itemMetadata.boots1.layers,
      );

      // Merged getter also surfaces lite + layers + credits.
      const merged = catalog.getItemMerged("boots1").unwrapOr(null);
      expect(merged.name).to.equal("Boots");
      expect(merged.layers.layer_1.male).to.equal(
        "spritesheets/feet/boots.png",
      );
      expect(merged.credits[0].licenses).to.deep.equal(["CC0"]);
    });
  });
});

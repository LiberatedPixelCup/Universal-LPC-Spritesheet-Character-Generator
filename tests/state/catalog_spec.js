import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import { createCatalog } from "../../sources/state/catalog.ts";

let catalog;
let writer;

describe("state/catalog.ts", () => {
  beforeEach(() => {
    ({ reader: catalog, writer } = createCatalog());
  });

  it("exposes disjoint reader and writer capabilities at runtime", () => {
    expect(catalog).not.to.have.property("registerItemMetadata");
    expect(catalog).not.to.have.property("loadCatalogFromFixtures");
    expect(writer).not.to.have.property("getItemLite");
    expect(writer).not.to.have.property("ready");
  });

  it("keeps independently seeded reader/writer pairs isolated", () => {
    const first = createCatalog();
    const second = createCatalog();
    const fixture = (name) => ({
      itemMetadata: { shared: { name, variants: [], recolors: [] } },
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
      paletteMetadata: { versions: {}, materials: {} },
    });

    first.writer.loadCatalogFromFixtures(fixture("First"));
    second.writer.loadCatalogFromFixtures(fixture("Second"));

    expect(first.reader.getItemLite("shared").unwrapOr(null).name).to.equal(
      "First",
    );
    expect(second.reader.getItemLite("shared").unwrapOr(null).name).to.equal(
      "Second",
    );
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
      writer.registerIndexMetadata({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      expect(catalog.isIndexReady()).to.be.true;
      expect(catalog.isLiteReady()).to.be.false;

      writer.registerItemMetadata({});
      expect(catalog.isLiteReady()).to.be.true;

      writer.registerCreditsMetadata({});
      expect(catalog.isCreditsReady()).to.be.true;

      writer.registerLayersMetadata({});
      expect(catalog.isLayersReady()).to.be.true;

      writer.registerPaletteMetadata({ versions: {}, materials: {} });
      expect(catalog.isPaletteReady()).to.be.true;
    });
  });

  describe("catalog readiness promises", () => {
    it("onIndexReady settles after registerIndexMetadata, alias data is queryable", async () => {
      const done = catalog.ready.onIndexReady;
      writer.registerIndexMetadata({
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
      const allReady = catalog.ready.onAllReady;
      writer.loadCatalogFromFixtures({
        itemMetadata: { a: { name: "A", layers: {}, credits: [] } },
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
        paletteMetadata: { versions: {}, materials: {} },
      });
      await allReady;
      expect(catalog.isIndexReady()).to.be.true;
      expect(catalog.isLiteReady()).to.be.true;
      expect(catalog.isCreditsReady()).to.be.true;
      expect(catalog.isLayersReady()).to.be.true;
      expect(catalog.isPaletteReady()).to.be.true;
    });
  });

  describe("registerIndexMetadata", () => {
    it("expands interned item lites from shared index variant tables", () => {
      const variantArrays = [["male", "female"]];
      const recolorVariantArrays = [[]];
      const byType = {
        body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
      };
      writer.registerIndexMetadata({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: {
          variantArrays,
          recolorVariantArrays,
          byTypeName: byType,
          hashMatch: { itemsByTypeName: byType },
        },
      });
      writer.registerItemMetadata({
        b1: { name: "Body", type_name: "body", v: 0, r: 0, recolors: [] },
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
      writer.loadCatalogFromFixtures(fixtureGlobals);
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

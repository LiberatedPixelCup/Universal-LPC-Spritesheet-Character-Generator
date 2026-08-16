import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import { createCatalog } from "../../sources/state/catalog.ts";

let catalog;
const ITEM_METADATA = {
  a: { name: "A", type_name: "body", required: ["male"] },
};

describe("state/catalog.ts", () => {
  beforeEach(() => {
    catalog = createCatalog();
  });

  describe("getItemLite", () => {
    it("returns Err({kind:'loading'}) before lite chunk loads", () => {
      const r = catalog.getItemLite("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "loading", chunk: "lite" });
      }
    });

    it("returns Ok(item) after lite chunk loads with valid id", () => {
      catalog.registerFromItemModule({ itemMetadata: ITEM_METADATA });
      const r = catalog.getItemLite("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.name).to.equal("A");
        expect(r.value.type_name).to.equal("body");
      }
    });

    it("returns Err({kind:'not-found'}) after load with unknown id", () => {
      catalog.registerFromItemModule({ itemMetadata: ITEM_METADATA });
      const r = catalog.getItemLite("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });
  });

  describe("getItemMerged", () => {
    it("returns Err({kind:'loading'}) before lite chunk loads", () => {
      const r = catalog.getItemMerged("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Ok with empty layers/credits when only lite is loaded", () => {
      catalog.registerFromItemModule({ itemMetadata: ITEM_METADATA });
      const r = catalog.getItemMerged("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.name).to.equal("A");
        expect(r.value.layers).to.deep.equal({});
        expect(r.value.credits).to.deep.equal([]);
      }
    });

    it("returns Err({kind:'not-found'}) for unknown id", () => {
      catalog.registerFromItemModule({ itemMetadata: ITEM_METADATA });
      const r = catalog.getItemMerged("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("not-found");
    });

    it("merges credits and layers when those chunks have loaded", () => {
      catalog.loadCatalogFromFixtures({
        itemMetadata: {
          a: {
            name: "A",
            layers: { layer_1: { male: "path/to/a" } },
            credits: [{ file: "path/to/a", licenses: ["CC0"] }],
          },
        },
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
        paletteMetadata: { versions: {}, materials: {} },
      });
      const r = catalog.getItemMerged("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.layers.layer_1.male).to.equal("path/to/a");
        expect(r.value.credits[0].licenses).to.deep.equal(["CC0"]);
      }
    });
  });

  describe("getItemCredits", () => {
    it("returns Err({kind:'loading'}) before credits chunk loads", () => {
      const r = catalog.getItemCredits("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Err({kind:'not-found'}) for unknown id when credits chunk is loaded", () => {
      catalog.registerFromCreditsModule({ itemCredits: {} });
      const r = catalog.getItemCredits("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });

    it("returns Ok(credits) when chunk is loaded and id has entries", () => {
      catalog.registerFromCreditsModule({
        itemCredits: { a: [{ file: "f", licenses: ["MIT"] }] },
      });
      const r = catalog.getItemCredits("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value[0].licenses).to.deep.equal(["MIT"]);
    });

    it("returns Ok([]) when chunk is loaded and id has an empty array entry", () => {
      catalog.registerFromCreditsModule({ itemCredits: { a: [] } });
      const r = catalog.getItemCredits("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value).to.deep.equal([]);
    });
  });

  describe("getItemLayers", () => {
    it("returns Err({kind:'loading'}) before layers chunk loads", () => {
      const r = catalog.getItemLayers("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Err({kind:'not-found'}) for unknown id when layers chunk is loaded", () => {
      catalog.registerFromLayersModule({ itemLayers: {} });
      const r = catalog.getItemLayers("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });

    it("returns Ok({}) when chunk is loaded and id has an empty object entry", () => {
      catalog.registerFromLayersModule({ itemLayers: { a: {} } });
      const r = catalog.getItemLayers("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value).to.deep.equal({});
    });
  });

  describe("getPaletteMetadata", () => {
    it("returns Err({kind:'loading'}) before palette chunk loads", () => {
      const r = catalog.getPaletteMetadata();
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Ok(meta) when palette chunk is loaded", () => {
      catalog.registerFromPaletteModule({
        paletteMetadata: { versions: {}, materials: { skin: {} } },
      });
      const r = catalog.getPaletteMetadata();
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value.materials).to.have.property("skin");
    });
  });

  describe("getCategoryTree / getMetadataIndexes / getAliasMetadata (index chunk)", () => {
    it("all return Err({kind:'loading', chunk:'index'}) before index chunk loads", () => {
      const tree = catalog.getCategoryTree();
      const indexes = catalog.getMetadataIndexes();
      const alias = catalog.getAliasMetadata();
      for (const r of [tree, indexes, alias]) {
        expect(r.isErr()).to.be.true;
        if (r.isErr()) {
          expect(r.error).to.deep.equal({ kind: "loading", chunk: "index" });
        }
      }
    });

    it("all return Ok after index chunk loads", () => {
      catalog.registerFromIndexModule({
        aliasMetadata: { aliasFlag: 1 },
        categoryTree: { items: ["a"], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      const tree = catalog.getCategoryTree();
      const indexes = catalog.getMetadataIndexes();
      const alias = catalog.getAliasMetadata();
      expect(tree.isOk()).to.be.true;
      expect(indexes.isOk()).to.be.true;
      expect(alias.isOk()).to.be.true;
      if (alias.isOk()) expect(alias.value).to.deep.equal({ aliasFlag: 1 });
    });
  });
});

import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  loadCatalogFromFixtures,
  registerFromCreditsModule,
  registerFromIndexModule,
  registerFromItemModule,
  registerFromLayersModule,
  registerFromPaletteModule,
  resetCatalogForTests,
} from "../../sources/state/catalog.ts";
import {
  getAliasMetadata,
  getCategoryTree,
  getItemCredits,
  getItemLayers,
  getItemLite,
  getItemMerged,
  getMetadataIndexes,
  getPaletteMetadata,
} from "../../sources/state/catalog.ts";
import { restoreAppCatalogAfterTest } from "../browser-catalog-fixture.js";

const FIXTURES = {
  itemMetadata: {
    a: { name: "A", type_name: "body", required: ["male"] },
    b: { name: "B", type_name: "head", required: ["male", "female"] },
  },
  aliasMetadata: { aliasFlag: 1 },
  categoryTree: { items: ["a", "b"], children: {} },
  metadataIndexes: { byTypeName: {}, hashMatch: {} },
  paletteMetadata: { versions: {}, materials: {} },
};

describe("state/catalog.ts", () => {
  beforeEach(() => {
    resetCatalogForTests();
  });

  afterEach(async () => {
    await restoreAppCatalogAfterTest();
  });

  describe("getItemLite", () => {
    it("returns Err({kind:'loading'}) before lite chunk loads", () => {
      const r = getItemLite("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "loading", chunk: "lite" });
      }
    });

    it("returns Ok(item) after lite chunk loads with valid id", () => {
      registerFromItemModule({ itemMetadata: FIXTURES.itemMetadata });
      const r = getItemLite("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.name).to.equal("A");
        expect(r.value.type_name).to.equal("body");
      }
    });

    it("returns Err({kind:'not-found'}) after load with unknown id", () => {
      registerFromItemModule({ itemMetadata: FIXTURES.itemMetadata });
      const r = getItemLite("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });
  });

  describe("getItemMerged", () => {
    it("returns Err({kind:'loading'}) before lite chunk loads", () => {
      const r = getItemMerged("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Ok with empty layers/credits when only lite is loaded", () => {
      registerFromItemModule({ itemMetadata: FIXTURES.itemMetadata });
      const r = getItemMerged("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.name).to.equal("A");
        expect(r.value.layers).to.deep.equal({});
        expect(r.value.credits).to.deep.equal([]);
      }
    });

    it("returns Err({kind:'not-found'}) for unknown id", () => {
      registerFromItemModule({ itemMetadata: FIXTURES.itemMetadata });
      const r = getItemMerged("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("not-found");
    });

    it("merges credits and layers when those chunks have loaded", () => {
      loadCatalogFromFixtures({
        ...FIXTURES,
        itemMetadata: {
          a: {
            name: "A",
            layers: { layer_1: { male: "path/to/a" } },
            credits: [{ file: "path/to/a", licenses: ["CC0"] }],
          },
        },
      });
      const r = getItemMerged("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) {
        expect(r.value.layers.layer_1.male).to.equal("path/to/a");
        expect(r.value.credits[0].licenses).to.deep.equal(["CC0"]);
      }
    });
  });

  describe("getItemCredits", () => {
    it("returns Err({kind:'loading'}) before credits chunk loads", () => {
      const r = getItemCredits("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Err({kind:'not-found'}) for unknown id when credits chunk is loaded", () => {
      registerFromCreditsModule({ itemCredits: {} });
      const r = getItemCredits("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });

    it("returns Ok(credits) when chunk is loaded and id has entries", () => {
      registerFromCreditsModule({
        itemCredits: { a: [{ file: "f", licenses: ["MIT"] }] },
      });
      const r = getItemCredits("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value[0].licenses).to.deep.equal(["MIT"]);
    });

    it("returns Ok([]) when chunk is loaded and id has an empty array entry", () => {
      registerFromCreditsModule({ itemCredits: { a: [] } });
      const r = getItemCredits("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value).to.deep.equal([]);
    });
  });

  describe("getItemLayers", () => {
    it("returns Err({kind:'loading'}) before layers chunk loads", () => {
      const r = getItemLayers("a");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Err({kind:'not-found'}) for unknown id when layers chunk is loaded", () => {
      registerFromLayersModule({ itemLayers: {} });
      const r = getItemLayers("ghost");
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "not-found", id: "ghost" });
      }
    });

    it("returns Ok({}) when chunk is loaded and id has an empty object entry", () => {
      registerFromLayersModule({ itemLayers: { a: {} } });
      const r = getItemLayers("a");
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value).to.deep.equal({});
    });
  });

  describe("getPaletteMetadata", () => {
    it("returns Err({kind:'loading'}) before palette chunk loads", () => {
      const r = getPaletteMetadata();
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("loading");
    });

    it("returns Ok(meta) when palette chunk is loaded", () => {
      registerFromPaletteModule({
        paletteMetadata: { versions: {}, materials: { skin: {} } },
      });
      const r = getPaletteMetadata();
      expect(r.isOk()).to.be.true;
      if (r.isOk()) expect(r.value.materials).to.have.property("skin");
    });
  });

  describe("getCategoryTree / getMetadataIndexes / getAliasMetadata (index chunk)", () => {
    it("all return Err({kind:'loading', chunk:'index'}) before index chunk loads", () => {
      const tree = getCategoryTree();
      const indexes = getMetadataIndexes();
      const alias = getAliasMetadata();
      for (const r of [tree, indexes, alias]) {
        expect(r.isErr()).to.be.true;
        if (r.isErr()) {
          expect(r.error).to.deep.equal({ kind: "loading", chunk: "index" });
        }
      }
    });

    it("all return Ok after index chunk loads", () => {
      registerFromIndexModule({
        aliasMetadata: FIXTURES.aliasMetadata,
        categoryTree: FIXTURES.categoryTree,
        metadataIndexes: FIXTURES.metadataIndexes,
      });
      const tree = getCategoryTree();
      const indexes = getMetadataIndexes();
      const alias = getAliasMetadata();
      expect(tree.isOk()).to.be.true;
      expect(indexes.isOk()).to.be.true;
      expect(alias.isOk()).to.be.true;
      if (alias.isOk()) expect(alias.value).to.deep.equal({ aliasFlag: 1 });
    });
  });

  describe("resetCatalogForTests", () => {
    it("flips all getters back to Err({kind:'loading'})", () => {
      loadCatalogFromFixtures(FIXTURES);
      expect(getItemLite("a").isOk()).to.be.true;
      expect(getCategoryTree().isOk()).to.be.true;
      resetCatalogForTests();
      expect(getItemLite("a").isErr()).to.be.true;
      expect(getCategoryTree().isErr()).to.be.true;
      expect(getItemCredits("a").isErr()).to.be.true;
      expect(getItemLayers("a").isErr()).to.be.true;
      expect(getPaletteMetadata().isErr()).to.be.true;
    });
  });
});

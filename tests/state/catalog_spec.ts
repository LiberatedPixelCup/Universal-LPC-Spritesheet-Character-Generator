import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";
import {
  createCatalog,
  type AliasEntry,
  type AliasMetadata,
  type CatalogHandles,
  type CatalogReader,
  type CatalogWriter,
  type ItemLite,
  type MetadataIndexes,
  type PaletteMap,
} from "../../sources/state/catalog.ts";
import {
  expandInternedItemLite,
  expandMetadataIndexesWithInternedArrays,
  hasInternedPalettes,
} from "../../sources/state/resolve-hash-param.ts";

type CatalogFixtureGlobals = Parameters<
  CatalogWriter["loadCatalogFromFixtures"]
>[0];

const EMPTY_INDEX = {
  aliasMetadata: {} as AliasMetadata,
  categoryTree: { items: [] as string[], children: {} },
};

const BODY_PALETTES: PaletteMap = {
  ulpc: {
    light: ["#271920", "#99423c"],
    bronze: ["#1A1213", "#442725"],
  },
};

let catalog: CatalogReader;
let writer: CatalogWriter;

function registerIndex(metadataIndexes: unknown): void {
  writer.registerIndexMetadata({
    ...EMPTY_INDEX,
    metadataIndexes: metadataIndexes as unknown as MetadataIndexes,
  });
}

function registerLite(itemMetadata: unknown): void {
  writer.registerItemMetadata(
    itemMetadata as unknown as Record<string, ItemLite>,
  );
}

function requireLite(id: string): ItemLite {
  const lite = catalog.getItemLite(id).unwrapOr(null);
  expect(lite).to.not.equal(null);
  if (lite === null) {
    throw new Error(`expected item lite ${id}`);
  }
  return lite;
}

describe("state/catalog.ts", () => {
  beforeEach(() => {
    ({ reader: catalog, writer } = createCatalog());
  });

  it("exposes disjoint reader and writer capabilities at runtime", () => {
    expect(catalog).to.not.have.property("registerItemMetadata");
    expect(catalog).to.not.have.property("loadCatalogFromFixtures");
    expect(writer).to.not.have.property("getItemLite");
    expect(writer).to.not.have.property("ready");
  });

  it("keeps independently seeded reader/writer pairs isolated", () => {
    const first: CatalogHandles = createCatalog();
    const second: CatalogHandles = createCatalog();
    const fixture = (name: string): CatalogFixtureGlobals => ({
      itemMetadata: { shared: { name, variants: [], recolors: [] } },
      aliasMetadata: {},
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
      paletteMetadata: { versions: {}, materials: {} },
    });

    first.writer.loadCatalogFromFixtures(fixture("First"));
    second.writer.loadCatalogFromFixtures(fixture("Second"));

    expect(first.reader.getItemLite("shared").unwrapOr(null)?.name).to.equal(
      "First",
    );
    expect(second.reader.getItemLite("shared").unwrapOr(null)?.name).to.equal(
      "Second",
    );
  });

  describe("isXReady predicates", () => {
    it("all start false", () => {
      expect(catalog.isIndexReady()).to.equal(false);
      expect(catalog.isLiteReady()).to.equal(false);
      expect(catalog.isCreditsReady()).to.equal(false);
      expect(catalog.isPaletteReady()).to.equal(false);
      expect(catalog.isLayersReady()).to.equal(false);
    });

    it("flips true once the matching register* runs", () => {
      writer.registerIndexMetadata({
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      expect(catalog.isIndexReady()).to.equal(true);
      expect(catalog.isLiteReady()).to.equal(false);

      writer.registerItemMetadata({});
      expect(catalog.isLiteReady()).to.equal(true);

      writer.registerCreditsMetadata({});
      expect(catalog.isCreditsReady()).to.equal(true);

      writer.registerLayersMetadata({});
      expect(catalog.isLayersReady()).to.equal(true);

      writer.registerPaletteMetadata({ versions: {}, materials: {} });
      expect(catalog.isPaletteReady()).to.equal(true);
    });
  });

  describe("catalog readiness promises", () => {
    it("onIndexReady settles after registerIndexMetadata, alias data is queryable", async () => {
      const done = catalog.ready.onIndexReady;
      writer.registerIndexMetadata({
        aliasMetadata: {
          x: { typeName: "y", name: "n", variant: "v" },
        } as unknown as AliasMetadata,
        categoryTree: { items: [], children: {} },
        metadataIndexes: { byTypeName: {}, hashMatch: {} },
      });
      await done;
      const aliasResult = catalog.getAliasMetadata();
      expect(aliasResult.isOk()).to.equal(true);
      const aliases = aliasResult.unwrapOr({}) as Record<string, AliasEntry>;
      expect(aliases.x.typeName).to.equal("y");
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
      expect(catalog.isIndexReady()).to.equal(true);
      expect(catalog.isLiteReady()).to.equal(true);
      expect(catalog.isCreditsReady()).to.equal(true);
      expect(catalog.isLayersReady()).to.equal(true);
      expect(catalog.isPaletteReady()).to.equal(true);
    });
  });

  describe("registerIndexMetadata", () => {
    it("expands interned item lites from shared index variant tables", () => {
      const variantArrays = [["male", "female"]];
      const recolorVariantArrays: string[][] = [[]];
      const byType = {
        body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
      };
      registerIndex({
        variantArrays,
        recolorVariantArrays,
        byTypeName: byType,
        hashMatch: { itemsByTypeName: byType },
      });
      registerLite({
        b1: { name: "Body", type_name: "body", v: 0, r: 0, recolors: [] },
      });
      const lite = requireLite("b1");
      expect(lite.variants).to.deep.equal(["male", "female"]);
      expect(lite).to.not.have.property("v");
    });

    it("restores recolor palettes from paletteArrays and drops p", () => {
      registerIndex({
        variantArrays: [["male"]],
        recolorVariantArrays: [["light"]],
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      });
      registerLite({
        b1: {
          name: "Body",
          type_name: "body",
          v: 0,
          r: 0,
          recolors: [{ material: "body", p: 0 }],
        },
      });
      const lite = requireLite("b1");
      expect(lite.variants).to.deep.equal(["male"]);
      expect(lite.recolors[0].variants).to.deep.equal(["light"]);
      expect(lite.recolors[0].palettes).to.deep.equal(BODY_PALETTES);
      expect(lite.recolors[0]).to.not.have.property("p");
      expect(lite).to.not.have.property("v");
    });

    it("restores palettes when the record has p but no v / r", () => {
      registerIndex({
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      });
      registerLite({
        ears: {
          name: "Ears",
          type_name: "ears",
          variants: ["male"],
          recolors: [{ material: "body", p: 0 }],
        },
      });
      const lite = requireLite("ears");
      expect(lite.variants).to.deep.equal(["male"]);
      expect(lite).to.not.have.property("v");
      expect(lite.recolors[0].palettes).to.deep.equal(BODY_PALETTES);
    });

    it("leaves palettes unchanged when the record has v / r but no p", () => {
      const palettes = { ulpc: { light: ["#abc"] } };
      registerIndex({
        variantArrays: [["male"]],
        recolorVariantArrays: [[]],
        paletteArrays: [BODY_PALETTES],
        byTypeName: {
          body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
        },
        hashMatch: {},
      });
      registerLite({
        b1: {
          name: "Body",
          type_name: "body",
          v: 0,
          r: 0,
          recolors: [{ material: "body", palettes }],
        },
      });
      const lite = requireLite("b1");
      expect(lite.variants).to.deep.equal(["male"]);
      expect(lite.recolors[0].palettes).to.equal(palettes);
      expect(lite.recolors[0]).to.not.have.property("p");
    });

    it("leaves an existing palettes object alone and is idempotent", () => {
      const palettes = { ulpc: { light: ["#abc"] } };
      registerIndex({
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      });
      registerLite({
        b1: {
          name: "Body",
          type_name: "body",
          recolors: [{ material: "body", palettes, p: 0 }],
        },
      });
      const lite = requireLite("b1");
      expect(lite.recolors[0].palettes).to.equal(palettes);
      expect(lite.recolors[0]).to.not.have.property("p");
      const again = expandInternedItemLite(lite, undefined, undefined, [
        BODY_PALETTES,
      ]) as ItemLite;
      expect(again.recolors[0].palettes).to.equal(palettes);
    });

    it("clones nested palette version objects so items do not share maps", () => {
      registerIndex({
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      });
      registerLite({
        a: {
          name: "A",
          type_name: "body",
          recolors: [{ material: "body", p: 0 }],
        },
        b: {
          name: "B",
          type_name: "body",
          recolors: [{ material: "body", p: 0 }],
        },
      });
      const liteA = requireLite("a");
      const liteB = requireLite("b");
      liteA.recolors[0].palettes.ulpc.olive = ["#00ff00"];
      expect(liteB.recolors[0].palettes.ulpc).to.not.have.property("olive");
      const indexes = catalog.getMetadataIndexes().unwrapOr(null);
      expect(indexes).to.not.equal(null);
      expect(indexes?.paletteArrays?.[0].ulpc).to.not.have.property("olive");
      expect(indexes?.paletteArrays?.[0]).to.deep.equal(BODY_PALETTES);
    });

    it("lands palettes: {} when p is out of range or paletteArrays is absent", () => {
      registerIndex({
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      });
      registerLite({
        oob: {
          name: "Oob",
          type_name: "body",
          recolors: [{ material: "body", p: 9 }],
        },
      });
      expect(requireLite("oob").recolors[0].palettes).to.deep.equal({});

      const second: CatalogHandles = createCatalog();
      catalog = second.reader;
      writer = second.writer;
      registerIndex({ byTypeName: {}, hashMatch: {} });
      registerLite({
        missing: {
          name: "Missing",
          type_name: "body",
          recolors: [{ material: "body", p: 0 }],
        },
      });
      expect(requireLite("missing").recolors[0].palettes).to.deep.equal({});
    });

    it("restores palettes for both lite-then-index and index-then-lite", () => {
      const internedLite = {
        b1: {
          name: "Body",
          type_name: "body",
          recolors: [{ material: "body", p: 0 }],
        },
      };
      const internedIndex = {
        paletteArrays: [BODY_PALETTES],
        byTypeName: {},
        hashMatch: {},
      };

      registerLite(internedLite);
      registerIndex(internedIndex);
      expect(requireLite("b1").recolors[0].palettes).to.deep.equal(
        BODY_PALETTES,
      );

      const second: CatalogHandles = createCatalog();
      catalog = second.reader;
      writer = second.writer;
      registerIndex(internedIndex);
      registerLite(internedLite);
      expect(requireLite("b1").recolors[0].palettes).to.deep.equal(
        BODY_PALETTES,
      );
    });

    it("keeps paletteArrays through expandMetadataIndexesWithInternedArrays", () => {
      const paletteArrays = [BODY_PALETTES];
      expect(
        expandMetadataIndexesWithInternedArrays(null)?.paletteArrays,
      ).to.equal(undefined);
      expect(
        expandMetadataIndexesWithInternedArrays({
          paletteArrays,
        } as unknown as MetadataIndexes)?.paletteArrays,
      ).to.equal(paletteArrays);

      const noInternTables = expandMetadataIndexesWithInternedArrays({
        byTypeName: { body: [] },
        hashMatch: {},
        paletteArrays,
      });
      expect(noInternTables?.paletteArrays).to.equal(paletteArrays);

      const alreadyExpanded = expandMetadataIndexesWithInternedArrays({
        byTypeName: {
          body: [
            {
              itemId: "b1",
              name: "Body",
              type_name: "body",
              variants: ["male"],
              recolors: [],
            },
          ],
        },
        hashMatch: {},
        variantArrays: [["male"]],
        recolorVariantArrays: [[]],
        paletteArrays,
      });
      expect(alreadyExpanded?.paletteArrays).to.equal(paletteArrays);

      const internedRows = {
        body: [{ itemId: "b1", name: "Body", type_name: "body", v: 0, r: 0 }],
      };
      const expanded = expandMetadataIndexesWithInternedArrays({
        byTypeName: internedRows,
        hashMatch: { itemsByTypeName: internedRows },
        variantArrays: [["male"]],
        recolorVariantArrays: [[]],
        paletteArrays,
      } as unknown as MetadataIndexes);
      expect(expanded?.paletteArrays).to.equal(paletteArrays);
      expect(expanded?.byTypeName.body[0].variants).to.deep.equal(["male"]);
    });

    it("treats non-records and recolors without p as not interned palettes", () => {
      expect(hasInternedPalettes(null)).to.equal(false);
      expect(hasInternedPalettes("x")).to.equal(false);
      expect(hasInternedPalettes({})).to.equal(false);
      expect(
        hasInternedPalettes({ recolors: [{ material: "body" }] }),
      ).to.equal(false);
      expect(hasInternedPalettes({ recolors: [null, { p: 0 }] })).to.equal(
        true,
      );

      const expanded = expandInternedItemLite(
        {
          name: "Mixed",
          type_name: "body",
          recolors: [
            null,
            1,
            { material: "cloth" },
            { material: "body", p: 0 },
          ],
        } as unknown as ItemLite,
        undefined,
        undefined,
        [BODY_PALETTES],
      ) as ItemLite;
      expect(expanded.recolors[0]).to.equal(null);
      expect(expanded.recolors[1]).to.equal(1);
      expect(expanded.recolors[2]).to.deep.equal({ material: "cloth" });
      expect(expanded.recolors[3].palettes).to.deep.equal(BODY_PALETTES);
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
            variants: [] as string[],
            recolors: [] as { variants: string[] }[],
          },
        ],
      };
      const bootsItem = {
        name: "Boots",
        type_name: "feet",
        layers: { layer_1: { male: "spritesheets/feet/boots.png" } },
        credits: [{ file: "artist/foo.png", licenses: ["CC0"] }],
        variants: [] as string[],
        recolors: [] as [],
      };
      const fixtureGlobals: CatalogFixtureGlobals = {
        itemMetadata: {
          boots1: bootsItem,
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
        bootsItem.credits,
      );
      expect(catalog.getItemLayers("boots1").unwrapOr({})).to.deep.equal(
        bootsItem.layers,
      );

      // Merged getter also surfaces lite + layers + credits.
      const merged = catalog.getItemMerged("boots1").unwrapOr(null);
      expect(merged).to.not.equal(null);
      if (merged === null) {
        throw new Error("expected merged item");
      }
      expect(merged.name).to.equal("Boots");
      expect(merged.layers.layer_1.male).to.equal(
        "spritesheets/feet/boots.png",
      );
      expect(merged.credits[0].licenses).to.deep.equal(["CC0"]);
    });
  });
});

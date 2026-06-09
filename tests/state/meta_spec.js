import {
  getLayersToLoad,
  getSortedLayers,
  getSortedLayersByAnim,
  getSortedLayersWithCustomFallback,
} from "../../sources/state/meta.ts";
import { resetPathDeps } from "../../sources/state/path.ts";
import { createCatalog, defaultCatalog } from "../../sources/state/catalog.ts";
import { err } from "neverthrow";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

function createCatalogWithItem(itemId, item) {
  const catalog = createCatalog();
  const { credits = [], layers = {}, ...liteOverrides } = item;
  catalog.registerFromItemModule({
    itemMetadata: {
      [itemId]: {
        name: itemId,
        type_name: "test",
        required: [],
        animations: [],
        recolors: [],
        matchBodyColor: false,
        variants: [],
        path: [],
        ...liteOverrides,
      },
    },
  });
  catalog.registerFromCreditsModule({ itemCredits: { [itemId]: credits } });
  catalog.registerFromLayersModule({ itemLayers: { [itemId]: layers } });
  return catalog;
}

describe("state/meta.ts", () => {
  beforeEach(() => {
    resetPathDeps();
  });

  afterEach(() => {
    resetPathDeps();
  });

  describe("catalog input", () => {
    it("uses the provided catalog instead of the default singleton", () => {
      const itemId = "meta_explicit_catalog_item";
      const catalog = createCatalogWithItem(itemId, {
        layers: {
          layer_1: { zPos: 42 },
        },
      });

      expect(defaultCatalog.getItemMerged(itemId).isErr()).to.equal(true);
      expect(getSortedLayers(catalog, itemId)._unsafeUnwrap()).to.deep.equal([
        { layerNum: 1, zPos: 42 },
      ]);
    });

    it("keeps custom fallback calls on the same catalog argument", () => {
      const itemId = "meta_explicit_catalog_custom_only_item";
      const catalog = createCatalogWithItem(itemId, {
        layers: {
          layer_1: { custom_animation: "wheelchair", zPos: 88 },
        },
      });

      expect(
        getSortedLayersWithCustomFallback(catalog, itemId)._unsafeUnwrap(),
      ).to.deep.equal([{ layerNum: 1, zPos: 88 }]);
    });
  });

  describe("getSortedLayers", () => {
    it("forwards the LoadError when item metadata is missing", () => {
      const errStub = sinon.stub(console, "error");
      try {
        const catalog = {
          getItemMerged: () => err({ kind: "not-found", id: "missing" }),
        };
        const r = getSortedLayers(catalog, "missing");
        expect(r.isErr()).to.be.true;
        if (r.isErr()) {
          expect(r.error).to.deep.equal({ kind: "not-found", id: "missing" });
        }
        expect(errStub.calledWith("Item metadata not found:", "missing")).to.be
          .true;
      } finally {
        errStub.restore();
      }
    });

    it("returns layerNum and zPos for each layer until a gap", () => {
      const catalog = createCatalogWithItem("itemA", {
        layers: {
          layer_2: { zPos: 20 },
          layer_1: { zPos: 10 },
        },
      });

      expect(getSortedLayers(catalog, "itemA")._unsafeUnwrap()).to.deep.equal([
        { layerNum: 1, zPos: 10 },
        { layerNum: 2, zPos: 20 },
      ]);
    });

    it("skips custom animation layers when standardOnly is true", () => {
      const catalog = createCatalogWithItem("itemA", {
        layers: {
          layer_1: { custom_animation: "combat", zPos: 9 },
          layer_2: { zPos: 1 },
        },
      });

      expect(
        getSortedLayers(catalog, "itemA", true)._unsafeUnwrap(),
      ).to.deep.equal([{ layerNum: 2, zPos: 1 }]);
    });
  });

  describe("getSortedLayersWithCustomFallback", () => {
    it("matches getSortedLayers when standard rows exist", () => {
      const catalog = createCatalogWithItem("itemA", {
        layers: {
          layer_1: { zPos: 10 },
          layer_2: { zPos: 20 },
        },
      });

      expect(
        getSortedLayersWithCustomFallback(catalog, "itemA")._unsafeUnwrap(),
      ).to.deep.equal(getSortedLayers(catalog, "itemA", true)._unsafeUnwrap());
    });

    it("falls back to all layers when standardOnly would be empty", () => {
      const catalog = createCatalogWithItem("itemA", {
        layers: {
          layer_1: { custom_animation: "wheelchair", zPos: 100 },
        },
      });

      expect(
        getSortedLayers(catalog, "itemA", true)._unsafeUnwrap(),
      ).to.deep.equal([]);
      expect(
        getSortedLayersWithCustomFallback(catalog, "itemA")._unsafeUnwrap(),
      ).to.deep.equal(getSortedLayers(catalog, "itemA")._unsafeUnwrap());
    });
  });

  describe("getSortedLayersByAnim", () => {
    it("forwards the LoadError when item metadata is missing", () => {
      const errStub = sinon.stub(console, "error");
      try {
        const catalog = {
          getItemMerged: () => err({ kind: "not-found", id: "missing" }),
        };
        const r = getSortedLayersByAnim(catalog, "missing");
        expect(r.isErr()).to.be.true;
        if (r.isErr()) {
          expect(r.error.kind).to.equal("not-found");
        }
        expect(errStub.calledWith("Item metadata not found:", "missing")).to.be
          .true;
      } finally {
        errStub.restore();
      }
    });

    it("groups layers by custom animation name or standard", () => {
      const catalog = createCatalogWithItem("item", {
        layers: {
          layer_1: { custom_animation: "swim", zPos: 10 },
          layer_2: { custom_animation: "swim", zPos: 20 },
          layer_3: { zPos: 30 },
        },
      });

      expect(
        getSortedLayersByAnim(catalog, "item")._unsafeUnwrap(),
      ).to.deep.equal({
        swim: [
          { layerNum: 1, animLayerNum: 1, zPos: 10 },
          { layerNum: 2, animLayerNum: 2, zPos: 20 },
        ],
        standard: [{ layerNum: 3, animLayerNum: 1, zPos: 30 }],
      });
    });

    it("sorts layers within each group by zPos and assigns animLayerNum", () => {
      const catalog = createCatalogWithItem("item", {
        layers: {
          layer_1: { custom_animation: "swim", zPos: 50 },
          layer_2: { custom_animation: "swim", zPos: 5 },
        },
      });

      expect(
        getSortedLayersByAnim(catalog, "item")._unsafeUnwrap().swim,
      ).to.deep.equal([
        { layerNum: 2, animLayerNum: 1, zPos: 5 },
        { layerNum: 1, animLayerNum: 2, zPos: 50 },
      ]);
    });

    it("includes only custom animation layers when customOnly is true", () => {
      const catalog = createCatalogWithItem("item", {
        layers: {
          layer_1: { custom_animation: "combat", zPos: 1 },
          layer_2: { zPos: 2 },
        },
      });

      expect(
        getSortedLayersByAnim(catalog, "item", true)._unsafeUnwrap(),
      ).to.deep.equal({
        combat: [{ layerNum: 1, animLayerNum: 1, zPos: 1 }],
      });
    });
  });

  describe("getLayersToLoad", () => {
    it("builds a standard spritesheet path using walk when animations includes walk", () => {
      const meta = {
        animations: ["walk", "idle"],
        layers: {
          layer_1: {
            male: "armor/male/",
            zPos: 10,
          },
        },
      };
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, null),
      ).to.deep.equal([{ zPos: 10, path: "spritesheets/armor/male/walk.png" }]);
    });

    it("uses the first animation when walk is not present", () => {
      const meta = {
        animations: ["idle", "run"],
        layers: {
          layer_1: {
            male: "x/",
            zPos: 1,
          },
        },
      };
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, null),
      ).to.deep.equal([{ zPos: 1, path: "spritesheets/x/idle.png" }]);
    });

    it("appends variant filename for standard layers under the default animation", () => {
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            male: "armor/male/",
            zPos: 10,
          },
        },
      };
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, "light brown"),
      ).to.deep.equal([
        {
          zPos: 10,
          path: "spritesheets/armor/male/walk/light_brown.png",
        },
      ]);
    });

    it("builds a custom-animation path without the default animation folder", () => {
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            male: "custom/base/",
            custom_animation: "combat",
            zPos: 5,
          },
        },
      };
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, "red"),
      ).to.deep.equal([{ zPos: 5, path: "spritesheets/custom/base/red.png" }]);
    });

    it("replaces template variables when the layer path contains ${}", () => {
      const catalog = createCatalogWithItem("headItem", {
        type_name: "head",
        name: "human",
        variants: ["head"],
      });
      const meta = {
        animations: ["walk"],
        replace_in_path: {
          head: { human: "resolved" },
        },
        layers: {
          layer_1: {
            male: "pre/${head}/",
            zPos: 0,
          },
        },
      };
      const out = getLayersToLoad(
        catalog,
        meta,
        "male",
        { head: { itemId: "headItem", variant: "head" } },
        "v",
      );
      expect(out).to.deep.equal([
        { zPos: 0, path: "spritesheets/pre/resolved/walk/v.png" },
      ]);
    });

    it("sorts results by zPos", () => {
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            male: "a/",
            zPos: 50,
          },
          layer_2: {
            male: "b/",
            zPos: 10,
          },
        },
      };
      const out = getLayersToLoad(defaultCatalog, meta, "male", {}, null);
      expect(out.map((o) => o.zPos)).to.deep.equal([10, 50]);
    });

    it("skips layers whose custom_animation does not match layer_1", () => {
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            male: "a/",
            custom_animation: "combat",
            zPos: 1,
          },
          layer_2: {
            male: "b/",
            zPos: 2,
          },
        },
      };
      // layer_2: no matching custom_animation vs layer_1. layer_1: custom layers need a
      // variant to form a loadable path; without one, nothing to load.
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, null),
      ).to.deep.equal([]);
    });

    it("skips layers whose body type has no path", () => {
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            female: "only/",
            zPos: 1,
          },
        },
      };
      expect(
        getLayersToLoad(defaultCatalog, meta, "male", {}, null),
      ).to.deep.equal([]);
    });
  });
});

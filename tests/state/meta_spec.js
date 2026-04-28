import {
  getLayersToLoad,
  getSortedLayers,
  getSortedLayersByAnim,
  getSortedLayersWithCustomFallback,
  resetMetaDeps,
  setMetaDeps,
} from "../../sources/state/meta.ts";
import { ok, err } from "neverthrow";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("state/meta.ts", () => {
  beforeEach(() => {
    resetMetaDeps();
  });

  afterEach(() => {
    resetMetaDeps();
  });

  describe("getSortedLayers", () => {
    it("forwards the LoadError when item metadata is missing", () => {
      const errStub = sinon.stub(console, "error");
      try {
        setMetaDeps({
          getItemMetadata: () => err({ kind: "not-found", id: "missing" }),
        });
        const r = getSortedLayers("missing");
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
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: {},
              layer_2: {},
            },
          }),
        getZPos: (itemId, layerNum) => layerNum * 10,
      });
      expect(getSortedLayers("itemA")._unsafeUnwrap()).to.deep.equal([
        { layerNum: 1, zPos: 10 },
        { layerNum: 2, zPos: 20 },
      ]);
    });

    it("skips custom animation layers when standardOnly is true", () => {
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: { custom_animation: "combat" },
              layer_2: {},
            },
          }),
        getZPos: () => 1,
      });
      expect(getSortedLayers("itemA", true)._unsafeUnwrap()).to.deep.equal([
        { layerNum: 2, zPos: 1 },
      ]);
    });
  });

  describe("getSortedLayersWithCustomFallback", () => {
    it("matches getSortedLayers when standard rows exist", () => {
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: {},
              layer_2: {},
            },
          }),
        getZPos: (itemId, layerNum) => layerNum * 10,
      });
      expect(
        getSortedLayersWithCustomFallback("itemA")._unsafeUnwrap(),
      ).to.deep.equal(getSortedLayers("itemA", true)._unsafeUnwrap());
    });

    it("falls back to all layers when standardOnly would be empty", () => {
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: { custom_animation: "wheelchair" },
            },
          }),
        getZPos: () => 100,
      });
      expect(getSortedLayers("itemA", true)._unsafeUnwrap()).to.deep.equal([]);
      expect(
        getSortedLayersWithCustomFallback("itemA")._unsafeUnwrap(),
      ).to.deep.equal(getSortedLayers("itemA")._unsafeUnwrap());
    });
  });

  describe("getSortedLayersByAnim", () => {
    it("forwards the LoadError when item metadata is missing", () => {
      const errStub = sinon.stub(console, "error");
      try {
        setMetaDeps({
          getItemMetadata: () => err({ kind: "not-found", id: "missing" }),
        });
        const r = getSortedLayersByAnim("missing");
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
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: { custom_animation: "swim" },
              layer_2: { custom_animation: "swim" },
              layer_3: {},
            },
          }),
        getZPos: (itemId, layerNum) => layerNum * 10,
      });
      expect(getSortedLayersByAnim("item")._unsafeUnwrap()).to.deep.equal({
        swim: [
          { layerNum: 1, animLayerNum: 1, zPos: 10 },
          { layerNum: 2, animLayerNum: 2, zPos: 20 },
        ],
        standard: [{ layerNum: 3, animLayerNum: 1, zPos: 30 }],
      });
    });

    it("sorts layers within each group by zPos and assigns animLayerNum", () => {
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: { custom_animation: "swim" },
              layer_2: { custom_animation: "swim" },
            },
          }),
        getZPos: (itemId, layerNum) => (layerNum === 1 ? 50 : 5),
      });
      expect(getSortedLayersByAnim("item")._unsafeUnwrap().swim).to.deep.equal([
        { layerNum: 2, animLayerNum: 1, zPos: 5 },
        { layerNum: 1, animLayerNum: 2, zPos: 50 },
      ]);
    });

    it("includes only custom animation layers when customOnly is true", () => {
      setMetaDeps({
        getItemMetadata: () =>
          ok({
            layers: {
              layer_1: { custom_animation: "combat" },
              layer_2: {},
            },
          }),
        getZPos: () => 1,
      });
      expect(getSortedLayersByAnim("item", true)._unsafeUnwrap()).to.deep.equal(
        {
          combat: [{ layerNum: 1, animLayerNum: 1, zPos: 1 }],
        },
      );
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
      expect(getLayersToLoad(meta, "male", {}, null)).to.deep.equal([
        { zPos: 10, path: "spritesheets/armor/male/walk.png" },
      ]);
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
      expect(getLayersToLoad(meta, "male", {}, null)).to.deep.equal([
        { zPos: 1, path: "spritesheets/x/idle.png" },
      ]);
    });

    it("appends variant filename for standard layers under the default animation", () => {
      setMetaDeps({
        variantToFilename: (v) => v.replaceAll(" ", "_"),
      });
      const meta = {
        animations: ["walk"],
        layers: {
          layer_1: {
            male: "armor/male/",
            zPos: 10,
          },
        },
      };
      expect(getLayersToLoad(meta, "male", {}, "light brown")).to.deep.equal([
        {
          zPos: 10,
          path: "spritesheets/armor/male/walk/light_brown.png",
        },
      ]);
    });

    it("builds a custom-animation path without the default animation folder", () => {
      setMetaDeps({
        variantToFilename: (v) => v,
      });
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
      expect(getLayersToLoad(meta, "male", {}, "red")).to.deep.equal([
        { zPos: 5, path: "spritesheets/custom/base/red.png" },
      ]);
    });

    it("calls replaceInPath when the layer path contains ${}", () => {
      const replaceInPath = sinon.stub().returns("resolved/");
      setMetaDeps({
        replaceInPath,
        variantToFilename: (v) => v,
      });
      const meta = {
        animations: ["walk"],
        replace_in_path: {},
        layers: {
          layer_1: {
            male: "pre/${head}/",
            zPos: 0,
          },
        },
      };
      const selections = { a: 1 };
      const out = getLayersToLoad(meta, "male", selections, "v");
      expect(replaceInPath.calledOnce).to.be.true;
      expect(replaceInPath.firstCall.args).to.deep.equal([
        "pre/${head}/",
        selections,
        meta,
      ]);
      expect(out).to.deep.equal([
        { zPos: 0, path: "spritesheets/resolved/walk/v.png" },
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
      const out = getLayersToLoad(meta, "male", {}, null);
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
      expect(getLayersToLoad(meta, "male", {}, null)).to.deep.equal([]);
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
      expect(getLayersToLoad(meta, "male", {}, null)).to.deep.equal([]);
    });
  });
});

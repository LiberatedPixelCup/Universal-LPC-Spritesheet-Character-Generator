import {
  getNameWithoutVariant,
  getSpritePath,
  replaceInPath,
  setPathDeps,
  resetPathDeps,
} from "../../sources/state/path.js";
import {
  loadCatalogFromFixtures,
  resetCatalogForTests,
} from "../../sources/state/catalog.ts";
import { restoreAppCatalogAfterTest } from "../browser-catalog-fixture.js";
import { es6DynamicTemplate } from "../../sources/utils/helpers.ts";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("state/path.js", () => {
  beforeEach(() => {
    resetCatalogForTests();
    resetPathDeps();
  });

  afterEach(async () => {
    resetPathDeps();
    await restoreAppCatalogAfterTest();
  });

  describe("getNameWithoutVariant", () => {
    it("returns empty string for a single segment with no underscore", () => {
      expect(getNameWithoutVariant("only", [])).to.equal("");
    });

    it("drops the last segment when no catalog variants match", () => {
      expect(getNameWithoutVariant("human_head", [])).to.equal("human");
    });

    it("returns the name before a known single-segment variant", () => {
      const items = [{ variants: ["head", "red"] }];
      expect(getNameWithoutVariant("human_red", items)).to.equal("human");
    });

    it("matches multi-segment variant suffixes", () => {
      const items = [{ variants: ["light_brown"] }];
      expect(getNameWithoutVariant("human_light_brown", items)).to.equal(
        "human",
      );
    });

    it("matches variants from recolors", () => {
      const items = [{ recolors: [{ variants: ["ash"] }] }];
      expect(getNameWithoutVariant("human_ash", items)).to.equal("human");
    });

    it("matches case-insensitively against catalog variants", () => {
      const items = [{ variants: ["Red"] }];
      expect(getNameWithoutVariant("human_RED", items)).to.equal("human");
    });

    it("collects variants from multiple items of the same type", () => {
      const items = [{ variants: ["a"] }, { variants: ["b"] }];
      expect(getNameWithoutVariant("x_b", items)).to.equal("x");
    });
  });

  describe("replaceInPath", () => {
    it("returns the path unchanged when it has no template placeholders", () => {
      const meta = { replace_in_path: {} };
      expect(replaceInPath("sprites/foo/bar", {}, meta)).to.equal(
        "sprites/foo/bar",
      );
    });

    it("resolves ${} segments using stubbed hash params and meta.replace_in_path", () => {
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(replaceInPath("base/${head}/tail", {}, meta)).to.equal(
        "base/humanoid/tail",
      );
    });

    it("resolves ${} using catalog byTypeName for name stripping", () => {
      loadCatalogFromFixtures({
        itemMetadata: {
          x: {
            type_name: "head",
            name: "Human",
            variants: ["head", "red"],
            layers: {},
            credits: [],
          },
        },
        aliasMetadata: {},
        categoryTree: { items: [], children: {} },
        metadataIndexes: {
          byTypeName: {
            head: [
              {
                itemId: "x",
                type_name: "head",
                name: "Human",
                variants: ["head", "red"],
                recolors: [],
              },
            ],
          },
        },
        paletteMetadata: { versions: {}, materials: {} },
      });
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(replaceInPath("base/${head}/tail", {}, meta)).to.equal(
        "base/humanoid/tail",
      );
    });

    it("calls debugLog when a placeholder has no replacement", () => {
      const debugLog = sinon.stub();
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
        debugLog,
      });
      const meta = {
        replace_in_path: {
          head: {},
        },
      };
      replaceInPath("base/${head}/tail", {}, meta);
      expect(debugLog.calledOnce).to.be.true;
      expect(debugLog.firstCall.args[0]).to.include("head");
    });

    it("resolves multiple placeholders in one path", () => {
      setPathDeps({
        getHashParamsforSelections: () => ({
          head: "human_head",
          body: "shirt_red",
        }),
      });
      const meta = {
        replace_in_path: {
          head: { human: "h1" },
          body: { shirt: "s1" },
        },
      };
      expect(replaceInPath("pre/${head}/mid/${body}/tail", {}, meta)).to.equal(
        "pre/h1/mid/s1/tail",
      );
    });

    it("ignores extra hash keys that do not appear in the path", () => {
      setPathDeps({
        getHashParamsforSelections: () => ({
          head: "human_head",
          body: "shirt_red",
        }),
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(replaceInPath("base/${head}/tail", {}, meta)).to.equal(
        "base/humanoid/tail",
      );
    });

    it("passes an empty object to getHashParamsforSelections when selections is null or undefined", () => {
      const getHashParamsforSelections = sinon.stub().returns({
        head: "human_head",
      });
      setPathDeps({ getHashParamsforSelections });
      const meta = {
        replace_in_path: {
          head: { human: "x" },
        },
      };
      replaceInPath("p/${head}/q", null, meta);
      expect(getHashParamsforSelections.firstCall.args[0]).to.deep.equal({});
      getHashParamsforSelections.resetHistory();
      replaceInPath("p/${head}/q", undefined, meta);
      expect(getHashParamsforSelections.firstCall.args[0]).to.deep.equal({});
    });

    it("leaves placeholders unchanged when the hash omits that key", () => {
      setPathDeps({
        getHashParamsforSelections: () => ({}),
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(replaceInPath("base/${head}/tail", {}, meta)).to.equal(
        "base/${head}/tail",
      );
    });

    it("throws when meta.replace_in_path is missing", () => {
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
      });
      expect(() => replaceInPath("base/${head}/tail", {}, {})).to.throw();
    });

    it("invokes es6DynamicTemplate with the path and replacement map", () => {
      const es6Spy = sinon
        .stub()
        .callsFake((path, replacements) =>
          es6DynamicTemplate(path, replacements),
        );
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
        es6DynamicTemplate: es6Spy,
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      const path = "base/${head}/tail";
      expect(replaceInPath(path, {}, meta)).to.equal("base/humanoid/tail");
      expect(es6Spy.calledOnce).to.be.true;
      expect(es6Spy.firstCall.args[0]).to.equal(path);
      expect(es6Spy.firstCall.args[1]).to.deep.equal({ head: "humanoid" });
    });
  });

  describe("getSpritePath", () => {
    it("returns null when item metadata is missing", () => {
      setPathDeps({
        getItemMetadata: () => undefined,
      });
      expect(
        getSpritePath("missing_id", "v", null, "male", "walk", 1, {}, null),
      ).to.be.null;
    });

    it("returns null when the requested layer is missing", () => {
      const meta = { layers: {} };
      expect(getSpritePath("id", "v", null, "male", "walk", 2, {}, meta)).to.be
        .null;
    });

    it("returns null when the body type has no path on the layer", () => {
      const meta = {
        layers: {
          layer_1: { female: "path/" },
        },
      };
      expect(getSpritePath("id", "v", null, "male", "walk", 1, {}, meta)).to.be
        .null;
    });

    it("builds a spritesheet path from layer body type, animation, and variant", () => {
      const meta = {
        layers: {
          layer_1: {
            male: "armor/male/",
          },
        },
      };
      setPathDeps({
        variantToFilename: (v) => v.replaceAll(" ", "_"),
        animations: [{ value: "walk", label: "Walk" }],
      });
      expect(
        getSpritePath("item", "light brown", null, "male", "walk", 1, {}, meta),
      ).to.equal("spritesheets/armor/male/walk/light_brown.png");
    });

    it("uses folderName from animations when present", () => {
      const meta = {
        layers: {
          layer_1: {
            male: "combat/",
          },
        },
      };
      setPathDeps({
        variantToFilename: (v) => v,
        animations: [
          { value: "combat", label: "Combat Idle", folderName: "combat_idle" },
        ],
      });
      expect(
        getSpritePath("item", "v", null, "male", "combat", 1, {}, meta),
      ).to.equal("spritesheets/combat/combat_idle/v.png");
    });

    it("derives variant from the last segment of itemId when variant is omitted", () => {
      const meta = {
        layers: {
          layer_1: {
            male: "x/",
          },
        },
      };
      setPathDeps({
        variantToFilename: (v) => v,
        animations: [{ value: "idle", label: "Idle" }],
      });
      expect(
        getSpritePath(
          "shirt_blue_red",
          null,
          null,
          "male",
          "idle",
          1,
          {},
          meta,
        ),
      ).to.equal("spritesheets/x/idle/red.png");
    });

    it("omits the variant filename segment when recolors is set", () => {
      const meta = {
        layers: {
          layer_1: {
            male: "y/",
          },
        },
      };
      setPathDeps({
        animations: [{ value: "walk", label: "Walk" }],
      });
      expect(
        getSpritePath("id", "v", true, "male", "walk", 1, {}, meta),
      ).to.equal("spritesheets/y/walk.png");
    });

    it("runs replaceInPath when the layer path contains ${}", () => {
      const meta = {
        layers: {
          layer_1: {
            male: "prefix/${head}/",
          },
        },
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      setPathDeps({
        getHashParamsforSelections: () => ({ head: "human_head" }),
        variantToFilename: (v) => v,
        animations: [{ value: "idle", label: "Idle" }],
      });
      expect(
        getSpritePath("item", "v", null, "male", "idle", 1, {}, meta),
      ).to.equal("spritesheets/prefix/humanoid/idle/v.png");
    });
  });
});

import {
  getNameWithoutVariant,
  getSpritePath,
  replaceInPath,
  setPathDeps,
  resetPathDeps,
} from "../../sources/state/path.ts";
import {
  defaultCatalog,
  resetCatalogForTests,
} from "../../sources/state/catalog.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";
import { es6DynamicTemplate } from "../../sources/utils/helpers.ts";
import { err } from "neverthrow";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("state/path.ts", () => {
  beforeEach(() => {
    resetCatalogForTests();
    resetPathDeps();
  });

  function seedTemplateCatalog() {
    seedBrowserCatalog({
      headItem: {
        type_name: "head",
        name: "human",
        variants: ["head"],
        layers: {},
        credits: [],
      },
      bodyItem: {
        type_name: "body",
        name: "shirt",
        variants: ["red"],
        layers: {},
        credits: [],
      },
    });
  }

  const templateSelections = {
    head: { itemId: "headItem", variant: "head" },
    body: { itemId: "bodyItem", variant: "red" },
  };

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
      expect(
        replaceInPath(defaultCatalog, "sprites/foo/bar", {}, meta),
      ).to.equal("sprites/foo/bar");
    });

    it("resolves ${} segments using catalog hash params and meta.replace_in_path", () => {
      seedTemplateCatalog();
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(
        replaceInPath(
          defaultCatalog,
          "base/${head}/tail",
          templateSelections,
          meta,
        ),
      ).to.equal("base/humanoid/tail");
    });

    it("calls debugLog when a placeholder has no replacement", () => {
      seedTemplateCatalog();
      const debugLog = sinon.stub();
      setPathDeps({
        debugLog,
      });
      const meta = {
        replace_in_path: {
          head: {},
        },
      };
      replaceInPath(
        defaultCatalog,
        "base/${head}/tail",
        templateSelections,
        meta,
      );
      expect(debugLog.calledOnce).to.be.true;
      expect(debugLog.firstCall.args[0]).to.include("head");
    });

    it("resolves multiple placeholders in one path", () => {
      seedTemplateCatalog();
      const meta = {
        replace_in_path: {
          head: { human: "h1" },
          body: { shirt: "s1" },
        },
      };
      expect(
        replaceInPath(
          defaultCatalog,
          "pre/${head}/mid/${body}/tail",
          templateSelections,
          meta,
        ),
      ).to.equal("pre/h1/mid/s1/tail");
    });

    it("ignores extra hash keys that do not appear in the path", () => {
      seedTemplateCatalog();
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(
        replaceInPath(
          defaultCatalog,
          "base/${head}/tail",
          templateSelections,
          meta,
        ),
      ).to.equal("base/humanoid/tail");
    });

    it("treats null or undefined selections as empty", () => {
      seedTemplateCatalog();
      const meta = {
        replace_in_path: {
          head: { human: "x" },
        },
      };
      expect(replaceInPath(defaultCatalog, "p/${head}/q", null, meta)).to.equal(
        "p/${head}/q",
      );
      expect(
        replaceInPath(defaultCatalog, "p/${head}/q", undefined, meta),
      ).to.equal("p/${head}/q");
    });

    it("leaves placeholders unchanged when the hash omits that key", () => {
      seedTemplateCatalog();
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      expect(
        replaceInPath(defaultCatalog, "base/${head}/tail", {}, meta),
      ).to.equal("base/${head}/tail");
    });

    it("throws when meta.replace_in_path is missing", () => {
      seedTemplateCatalog();
      expect(() =>
        replaceInPath(
          defaultCatalog,
          "base/${head}/tail",
          templateSelections,
          {},
        ),
      ).to.throw();
    });

    it("invokes es6DynamicTemplate with the path and replacement map", () => {
      seedTemplateCatalog();
      const es6Spy = sinon
        .stub()
        .callsFake((path, replacements) =>
          es6DynamicTemplate(path, replacements),
        );
      setPathDeps({
        es6DynamicTemplate: es6Spy,
      });
      const meta = {
        replace_in_path: {
          head: { human: "humanoid" },
        },
      };
      const path = "base/${head}/tail";
      expect(
        replaceInPath(defaultCatalog, path, templateSelections, meta),
      ).to.equal("base/humanoid/tail");
      expect(es6Spy.calledOnce).to.be.true;
      expect(es6Spy.firstCall.args[0]).to.equal(path);
      expect(es6Spy.firstCall.args[1]).to.include({ head: "humanoid" });
    });
  });

  describe("getSpritePath", () => {
    it("forwards the LoadError when item metadata is missing", () => {
      const catalog = {
        getItemMerged: () => err({ kind: "not-found", id: "missing_id" }),
      };
      const r = getSpritePath(
        catalog,
        "missing_id",
        "v",
        null,
        "male",
        "walk",
        1,
        {},
        null,
      );
      expect(r.isErr()).to.be.true;
      if (r.isErr()) expect(r.error.kind).to.equal("not-found");
    });

    it("returns a missing-layer error when the requested layer is absent", () => {
      const meta = { layers: {} };
      const r = getSpritePath(
        defaultCatalog,
        "id",
        "v",
        null,
        "male",
        "walk",
        2,
        {},
        meta,
      );
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({ kind: "missing-layer", layerNum: 2 });
      }
    });

    it("returns a missing-bodytype-path error when the layer has no path for that body type", () => {
      const meta = {
        layers: {
          layer_1: { female: "path/" },
        },
      };
      const r = getSpritePath(
        defaultCatalog,
        "id",
        "v",
        null,
        "male",
        "walk",
        1,
        {},
        meta,
      );
      expect(r.isErr()).to.be.true;
      if (r.isErr()) {
        expect(r.error).to.deep.equal({
          kind: "missing-bodytype-path",
          bodyType: "male",
        });
      }
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
        getSpritePath(
          defaultCatalog,
          "item",
          "light brown",
          null,
          "male",
          "walk",
          1,
          {},
          meta,
        )._unsafeUnwrap(),
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
        getSpritePath(
          defaultCatalog,
          "item",
          "v",
          null,
          "male",
          "combat",
          1,
          {},
          meta,
        )._unsafeUnwrap(),
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
          defaultCatalog,
          "shirt_blue_red",
          null,
          null,
          "male",
          "idle",
          1,
          {},
          meta,
        )._unsafeUnwrap(),
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
        getSpritePath(
          defaultCatalog,
          "id",
          "v",
          true,
          "male",
          "walk",
          1,
          {},
          meta,
        )._unsafeUnwrap(),
      ).to.equal("spritesheets/y/walk.png");
    });

    it("runs replaceInPath when the layer path contains ${}", () => {
      seedTemplateCatalog();
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
        variantToFilename: (v) => v,
        animations: [{ value: "idle", label: "Idle" }],
      });
      expect(
        getSpritePath(
          defaultCatalog,
          "item",
          "v",
          null,
          "male",
          "idle",
          1,
          templateSelections,
          meta,
        )._unsafeUnwrap(),
      ).to.equal("spritesheets/prefix/humanoid/idle/v.png");
    });
  });
});

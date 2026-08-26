import {
  getAllowedLicenses,
  setLicenseConfig,
  setAnimations,
  updateState,
  setEnabledLicenses,
  setEnabledAnimations,
  isItemLicenseCompatible,
  isItemAnimationCompatible,
  isNodeAnimationCompatible,
  setCustomAnimations,
  setCustomAnimationBase,
} from "../../sources/state/filters.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import { createState } from "../../sources/state/state.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";
import { expect } from "chai";
import { describe, it, beforeEach } from "mocha-globals";

describe("state/filters.ts", () => {
  let catalog;
  let catalogWriter;
  let state;

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    state = createState();
  });

  describe("getAllowedLicenses", () => {
    it("should return an empty array if no licenses are enabled", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0"] },
      ]);
      updateState(state, { enabledLicenses: {} });

      const result = getAllowedLicenses(state);
      expect(result.length).to.equal(0);
      expect(result).to.deep.equal([]);
    });

    it("should return allowed licenses for enabled license keys", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0"] },
      ]);
      updateState(state, {
        enabledLicenses: {
          license1: true,
          license2: false,
        },
      });

      const result = getAllowedLicenses(state);
      expect(result).to.deep.equal(["1.0", "1.1"]);
    });

    it("should return all versions of multiple enabled licenses", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0", "2.1"] },
      ]);
      updateState(state, {
        enabledLicenses: {
          license1: true,
          license2: true,
        },
      });

      const result = getAllowedLicenses(state);
      expect(result).to.deep.equal(["1.0", "1.1", "2.0", "2.1"]);
    });

    it("should return an empty array if licenseConfig is empty", () => {
      setLicenseConfig([]);
      updateState(state, {
        enabledLicenses: {
          license1: true,
        },
      });

      const result = getAllowedLicenses(state);
      expect(result.length).to.equal(0);
      expect(result).to.deep.equal([]);
    });

    it("should ignore licenses that are not enabled", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0", "2.1"] },
        { key: "license3", versions: ["1.0", "2.1"] },
        { key: "license4", versions: ["2.0", "3.1"] },
        { key: "license5", versions: ["3.0", "4.1"] },
      ]);
      updateState(state, {
        enabledLicenses: {
          license1: false,
          license2: false,
          license3: true,
          license4: true,
        },
      });

      const result = getAllowedLicenses(state);
      expect(result).to.deep.equal(["1.0", "2.1", "2.0", "3.1"]);
    });
  });

  describe("isItemLicenseCompatible", () => {
    it("should return true if item metadata is missing", () => {
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.true;
    });

    it("should return true if item metadata has no credits", () => {
      seedCatalog(catalogWriter, {
        item1: { credits: [] },
      });
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.true;
    });

    it("should return false if no licenses are enabled", () => {
      setEnabledLicenses(state, []);
      setLicenseConfig([{ key: "license1", versions: ["license1 1.0"] }]);
      seedCatalog(catalogWriter, {
        item1: {
          credits: [{ licenses: ["license1 1.0"] }],
        },
      });
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.false;
    });

    it("should return true if item has at least one compatible license", () => {
      setEnabledLicenses(state, ["license1"]);
      setLicenseConfig([
        { key: "license1", versions: ["license1 1.0"] },
        { key: "license2", versions: ["license2 1.0"] },
      ]);
      seedCatalog(catalogWriter, {
        item1: {
          credits: [{ licenses: ["license1 1.0", "license2 1.0"] }],
        },
      });
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.true;
    });

    it("should return false if item has no compatible licenses", () => {
      setEnabledLicenses(state, ["license3"]);
      setLicenseConfig([
        { key: "license1", versions: ["license1 1.0"] },
        { key: "license2", versions: ["license2 1.0"] },
        { key: "license3", versions: ["license3 1.0"] },
      ]);
      seedCatalog(catalogWriter, {
        item1: {
          credits: [{ licenses: ["license1 1.0", "license2 1.0"] }],
        },
      });
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.false;
    });

    it("should trim license strings before comparison", () => {
      setEnabledLicenses(state, ["license1"]);
      setLicenseConfig([{ key: "license1", versions: ["license1 1.0"] }]);
      seedCatalog(catalogWriter, {
        item1: {
          credits: [{ licenses: [" license1 1.0 "] }],
        },
      });
      const result = isItemLicenseCompatible(catalog, state, "item1");
      expect(result).to.be.true;
    });
  });

  describe("isItemAnimationCompatible", () => {
    beforeEach(() => {
      seedCatalog(catalogWriter, {
        item1: {
          animations: ["walk", "run"],
        },
        item2: {
          animations: ["jump"],
        },
        item3: {
          animations: [],
        },
        item4: {
          animations: ["customRun"],
        },
        item5: {
          animations: ["customFly"],
        },
      });

      // Reset dependencies
      setAnimations([{ value: "walk" }, { value: "run" }, { value: "jump" }]);
      setEnabledAnimations(state, []);
      setCustomAnimations({});
      setCustomAnimationBase(() => null);
    });

    it("should return true if no animations are enabled", () => {
      expect(isItemAnimationCompatible(catalog, state, "item1")).to.be.true;
      expect(isItemAnimationCompatible(catalog, state, "item2")).to.be.true;
      expect(isItemAnimationCompatible(catalog, state, "item3")).to.be.true;
    });

    it("should return true if the item's animations match enabled animations", () => {
      setEnabledAnimations(state, ["walk"]);
      expect(isItemAnimationCompatible(catalog, state, "item1")).to.be.true;
      expect(isItemAnimationCompatible(catalog, state, "item2")).to.be.false;
    });

    it("should return false if the item's animations do not match enabled animations", () => {
      setEnabledAnimations(state, ["jump"]);
      expect(isItemAnimationCompatible(catalog, state, "item1")).to.be.false;
      expect(isItemAnimationCompatible(catalog, state, "item2")).to.be.true;
    });

    it("should return true if the item's animations include a base animation from custom animations", () => {
      setCustomAnimations({
        customRun: { base: "run" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(state, ["run"]);
      expect(isItemAnimationCompatible(catalog, state, "item4")).to.be.true;
    });

    it("should return false if the item's animations do not include a base animation from custom animations", () => {
      setCustomAnimations({
        customFly: { base: "fly" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(state, ["run"]);
      expect(isItemAnimationCompatible(catalog, state, "item5")).to.be.false;
    });

    it("should return true if the item has no animations (assume compatible)", () => {
      expect(isItemAnimationCompatible(catalog, state, "item3")).to.be.true;
    });

    it("should return true if the item does not exist in metadata (assume compatible)", () => {
      const result = isItemAnimationCompatible(
        catalog,
        state,
        "nonExistentItem",
      );
      expect(result).to.be.true;
    });
  });

  describe("isNodeAnimationCompatible", () => {
    it("should return true if node has no animations", () => {
      const node = {};
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });

    it("should return true if no animations are enabled", () => {
      setEnabledAnimations(state, []);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });

    it("should return true if the node's animations are compatible with enabled animations", () => {
      setEnabledAnimations(state, ["walk"]);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });

    it("should return false if the node's animations are not compatible with enabled animations", () => {
      setEnabledAnimations(state, ["jump"]);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.false;
    });

    it("should return true if node supports at least one enabled animation", () => {
      setAnimations([{ value: "walk" }, { value: "run" }]);
      setEnabledAnimations(state, ["walk", "run"]);

      const node = { animations: ["jump", "run"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });

    it("should return false if node does not support any enabled animations", () => {
      setAnimations([{ value: "walk" }, { value: "run" }]);
      setEnabledAnimations(state, ["walk"]);

      const node = { animations: ["jump", "run"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.false;
    });

    it("should return true if the node's animations include a base animation from custom animations", () => {
      setCustomAnimations({
        customRun: { base: "run" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(state, ["run"]);
      const node = { animations: ["customRun"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });

    it("should return false if the node's animations do not include a base animation from custom animations", () => {
      setCustomAnimations({
        customFly: { base: "fly" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(state, ["run"]);
      const node = { animations: ["customFly"] };
      expect(isNodeAnimationCompatible(node, state)).to.be.false;
    });

    it("should return true if the node has no animations array (assume compatible)", () => {
      const node = { someProperty: "value" };
      expect(isNodeAnimationCompatible(node, state)).to.be.true;
    });
  });
});

import {
  getAllowedLicenses,
  setLicenseConfig,
  setAnimations,
  updateState,
  resetState,
  setEnabledLicenses,
  setEnabledAnimations,
  isItemLicenseCompatible,
  isItemAnimationCompatible,
  isNodeAnimationCompatible,
  setCustomAnimations,
  setCustomAnimationBase,
} from "../../../sources/state/filters.js";
import { expect } from "chai";

describe("state/filters.js", () => {
  beforeEach(() => {
    resetState();
  });

  describe("getAllowedLicenses", () => {
    it("should return an empty array if no licenses are enabled", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0"] },
      ]);
      updateState({ enabledLicenses: {} });

      const result = getAllowedLicenses();
      expect(result.length).to.equal(0);
      expect(result).to.deep.equal([]);
    });

    it("should return allowed licenses for enabled license keys", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0"] },
      ]);
      updateState({
        enabledLicenses: {
          license1: true,
          license2: false,
        },
      });

      const result = getAllowedLicenses();
      expect(result).to.deep.equal(["1.0", "1.1"]);
    });

    it("should return all versions of multiple enabled licenses", () => {
      setLicenseConfig([
        { key: "license1", versions: ["1.0", "1.1"] },
        { key: "license2", versions: ["2.0", "2.1"] },
      ]);
      updateState({
        enabledLicenses: {
          license1: true,
          license2: true,
        },
      });

      const result = getAllowedLicenses();
      expect(result).to.deep.equal(["1.0", "1.1", "2.0", "2.1"]);
    });

    it("should return an empty array if licenseConfig is empty", () => {
      setLicenseConfig([]);
      updateState({
        enabledLicenses: {
          license1: true,
        },
      });

      const result = getAllowedLicenses();
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
      updateState({
        enabledLicenses: {
          license1: false,
          license2: false,
          license3: true,
          license4: true,
        },
      });

      const result = getAllowedLicenses();
      expect(result).to.deep.equal(["1.0", "2.1", "2.0", "3.1"]);
    });
  });

  describe("isItemLicenseCompatible", () => {
    let originalItemMetadata;

    beforeEach(() => {
      originalItemMetadata = window.itemMetadata;
      window.itemMetadata = {};
    });

    afterEach(() => {
      window.itemMetadata = originalItemMetadata;
    });

    it("should return true if item metadata is missing", () => {
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.true;
    });

    it("should return true if item metadata has no credits", () => {
      window.itemMetadata = {
        item1: { credits: [] },
      };
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.true;
    });

    it("should return false if no licenses are enabled", () => {
      setEnabledLicenses([]);
      setLicenseConfig([{ key: "license1", versions: ["license1 1.0"] }]);
      window.itemMetadata = {
        item1: {
          credits: [{ licenses: ["license1 1.0"] }],
        },
      };
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.false;
    });

    it("should return true if item has at least one compatible license", () => {
      setEnabledLicenses(["license1"]);
      setLicenseConfig([
        { key: "license1", versions: ["license1 1.0"] },
        { key: "license2", versions: ["license2 1.0"] },
      ]);
      window.itemMetadata = {
        item1: {
          credits: [{ licenses: ["license1 1.0", "license2 1.0"] }],
        },
      };
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.true;
    });

    it("should return false if item has no compatible licenses", () => {
      setEnabledLicenses(["license3"]);
      setLicenseConfig([
        { key: "license1", versions: ["license1 1.0"] },
        { key: "license2", versions: ["license2 1.0"] },
        { key: "license3", versions: ["license3 1.0"] },
      ]);
      window.itemMetadata = {
        item1: {
          credits: [{ licenses: ["license1 1.0", "license2 1.0"] }],
        },
      };
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.false;
    });

    it("should trim license strings before comparison", () => {
      setEnabledLicenses(["license1"]);
      setLicenseConfig([{ key: "license1", versions: ["license1 1.0"] }]);
      window.itemMetadata = {
        item1: {
          credits: [{ licenses: [" license1 1.0 "] }],
        },
      };
      const result = isItemLicenseCompatible("item1");
      expect(result).to.be.true;
    });
  });

  describe("isItemAnimationCompatible", () => {
    let originalItemMetadata;

    beforeEach(() => {
      originalItemMetadata = window.itemMetadata;
      window.itemMetadata = {
        item1: {
          animations: ["walk", "run"],
        },
        item2: {
          animations: ["jump"],
        },
        item3: {
          animations: [],
        },
      };

      // Reset dependencies
      setAnimations([
        { value: "walk" },
        { value: "run" },
        { value: "jump" },
      ]);
      setEnabledAnimations([]);
      setCustomAnimations({});
      setCustomAnimationBase(() => null);
    });

    afterEach(() => {
      window.itemMetadata = originalItemMetadata;
    });

    it("should return true if no animations are enabled", () => {
      expect(isItemAnimationCompatible("item1")).to.be.true;
      expect(isItemAnimationCompatible("item2")).to.be.true;
      expect(isItemAnimationCompatible("item3")).to.be.true;
    });

    it("should return true if the item's animations match enabled animations", () => {
      setEnabledAnimations(["walk"]);
      expect(isItemAnimationCompatible("item1")).to.be.true;
      expect(isItemAnimationCompatible("item2")).to.be.false;
    });

    it("should return false if the item's animations do not match enabled animations", () => {
      setEnabledAnimations(["jump"]);
      expect(isItemAnimationCompatible("item1")).to.be.false;
      expect(isItemAnimationCompatible("item2")).to.be.true;
    });

    it("should return true if the item's animations include a base animation from custom animations", () => {
      setCustomAnimations({
        "customRun": { base: "run" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(["run"]);
      window.itemMetadata.item4 = {
        animations: ["customRun"],
      };
      expect(isItemAnimationCompatible("item4")).to.be.true;
    });

    it("should return false if the item's animations do not include a base animation from custom animations", () => {
      setCustomAnimations({
        "customFly": { base: "fly" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(["run"]);
      window.itemMetadata.item5 = {
        animations: ["customFly"],
      };
      expect(isItemAnimationCompatible("item5")).to.be.false;
    });

    it("should return true if the item has no animations (assume compatible)", () => {
      expect(isItemAnimationCompatible("item3")).to.be.true;
    });

    it("should return true if the item does not exist in metadata (assume compatible)", () => {
      expect(isItemAnimationCompatible("nonExistentItem")).to.be.true;
    });
  });

  describe("isNodeAnimationCompatible", () => {
    it("should return true if node has no animations", () => {
      const node = {};
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });

    it("should return true if no animations are enabled", () => {
      setEnabledAnimations([]);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });

    it("should return true if the node's animations are compatible with enabled animations", () => {
      setEnabledAnimations(["walk"]);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });

    it("should return false if the node's animations are not compatible with enabled animations", () => {
      setEnabledAnimations(["jump"]);
      const node = { animations: ["walk", "run"] };
      expect(isNodeAnimationCompatible(node)).to.be.false;
    });

    it("should return true if node supports at least one enabled animation", () => {
      setAnimations([{ value: "walk" }, { value: "run" }]);
      setEnabledAnimations(["walk", "run"]);

      const node = { animations: ["jump", "run"] };
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });

    it("should return false if node does not support any enabled animations", () => {
      setAnimations([{ value: "walk" }, { value: "run" }]);
      setEnabledAnimations(["walk"]);

      const node = { animations: ["jump", "run"] };
      expect(isNodeAnimationCompatible(node)).to.be.false;
    });

    it("should return true if the node's animations include a base animation from custom animations", () => {
      setCustomAnimations({
        "customRun": { base: "run" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(["run"]);
      const node = { animations: ["customRun"] };
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });

    it("should return false if the node's animations do not include a base animation from custom animations", () => {
      setCustomAnimations({
        "customFly": { base: "fly" },
      });
      setCustomAnimationBase((anim) => anim.base);
      setEnabledAnimations(["run"]);
      const node = { animations: ["customFly"] };
      expect(isNodeAnimationCompatible(node)).to.be.false;
    });

    it("should return true if the node does not exist (assume compatible)", () => {
      expect(isNodeAnimationCompatible(null)).to.be.true;
    });

    it("should return true if the node has no animations array (assume compatible)", () => {
      const node = { someProperty: "value" };
      expect(isNodeAnimationCompatible(node)).to.be.true;
    });
  });
});

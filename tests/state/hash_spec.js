import { expect } from "chai";
import sinon from "sinon";
import {
  getHash,
  setHash,
  getState,
  updateState,
  resetState,
  getHashParams,
  getHashParamsFromString,
  createHashStringFromParams,
  setHashParams,
  getHashParamsforSelections,
  syncSelectionsToHash,
  loadSelectionsFromHash,
  initHashChangeListener,
  getSetHashCalledTimes,
  resetHashCalledTimes,
} from "../../../sources/state/hash.js";

describe("state/hash.js", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(window, "addEventListener").callsFake(() => {});
    sandbox.stub(window, "itemMetadata").value({});
    window.isTesting = true;
  });

  afterEach(() => {
    resetState();
    resetHashCalledTimes();
    sandbox.restore();
    delete window.isTesting;
  });

  describe("getHashParams", () => {
    it("should return an empty object if hash is empty", () => {
      setHash("");
      expect(getHashParams()).to.deep.equal({});
    });

    it("should parse hash parameters correctly", () => {
      setHash("#key1=value1&key2=value2");
      expect(getHashParams()).to.deep.equal({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should handle hash starting with '?'", () => {
      setHash("#?key1=value1&key2=value2");
      expect(getHashParams()).to.deep.equal({
        key1: "value1",
        key2: "value2",
      });
    });
  });

  describe("getHashParamsFromString", () => {
    it("should parse a hash string into an object", () => {
      const hashString = "key1=value1&key2=value2";
      expect(getHashParamsFromString(hashString)).to.deep.equal({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should decode URI components", () => {
      const hashString = "key%201=value%201&key%202=value%202";
      expect(getHashParamsFromString(hashString)).to.deep.equal({
        "key 1": "value 1",
        "key 2": "value 2",
      });
    });
  });

  describe("createHashStringFromParams", () => {
    it("should create a hash string from an object", () => {
      const params = { key1: "value1", key2: "value2" };
      expect(createHashStringFromParams(params)).to.equal(
        "key1=value1&key2=value2"
      );
    });

    it("should encode URI components", () => {
      const params = { "key 1": "value 1", "key 2": "value 2" };
      expect(createHashStringFromParams(params)).to.equal(
        "key%201=value%201&key%202=value%202"
      );
    });
  });

  describe("setHashParams", () => {
    it("should set the window location hash", () => {
      const params = { key1: "value1", key2: "value2" };
      setHashParams(params);
      expect(getHash()).to.equal("#key1=value1&key2=value2");
    });
  });

  describe("getHashParamsforSelections", () => {
    it("should generate hash params for selections", () => {
      updateState({
        bodyType: "male",
        selections: {
          body: { itemId: "1", variant: "light" },
        },
      });
      window.itemMetadata = {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      };

      const params = getHashParamsforSelections(getState().selections);
      expect(params).to.deep.equal({
        sex: "male",
        body: "Body_light",
      });
    });
  });

  describe("syncSelectionsToHash", () => {
    it("should sync selections to the hash", () => {
      updateState({
        bodyType: "male",
        selections: {
          body: { itemId: "1", variant: "light" },
        },
      });
      window.itemMetadata = {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      };

      syncSelectionsToHash();
      expect(getSetHashCalledTimes()).to.equal(1);
    });
  });

  describe("loadSelectionsFromHash", () => {
    it("should load selections from hash", () => {
      setHash("#body=Body_light");
      window.itemMetadata = {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      };

      loadSelectionsFromHash();
      expect(getState().selections).to.deep.equal({
        body: {
          itemId: "1",
          variant: "light",
          name: "Body (light)",
        },
      });
    });

    it("should be case insensitive", () => {
      setHash("#body=Body_color_light");
      window.itemMetadata = {
        1: { type_name: "body", name: "Body_Color", variants: ["light"] },
      };

      loadSelectionsFromHash();
      expect(getState().selections).to.deep.equal({
        body: {
          itemId: "1",
          variant: "light",
          name: "Body_Color (light)",
        },
      });
    });
  });

  describe("initHashChangeListener", () => {
    it("should add a 'hashchange' event listener to the window", () => {
      initHashChangeListener();
      expect(window.addEventListener.calledWith("hashchange")).to.be.true;
    });

    it("should call the provided callback when the hash changes", () => {
      const callback = sandbox.spy();
      initHashChangeListener(callback);

      // Simulate hash change
      setHash("#key=value");
      window.addEventListener
        .getCall(0)
        .args[1](); // Call the event listener

      expect(callback.calledOnce).to.be.true;
      expect(getHash()).to.equal("#key=value");
    });

    it("should not throw an error if no callback is provided", () => {
      expect(() => initHashChangeListener()).to.not.throw();
    });
  });

});
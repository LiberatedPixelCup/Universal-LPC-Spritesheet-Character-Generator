import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  getHash,
  setHash,
  updateState,
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
} from "../../sources/state/hash.ts";
import { createCatalog } from "../../sources/state/catalog.ts";
import { createState } from "../../sources/state/state.ts";
import { initCanvas } from "../../sources/canvas/renderer.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

describe("state/hash.ts", () => {
  let sandbox;
  let catalog;
  let catalogWriter;
  let state;

  beforeEach(() => {
    ({ reader: catalog, writer: catalogWriter } = createCatalog());
    state = createState();
    sandbox = sinon.createSandbox();
    sandbox.stub(window, "addEventListener").callsFake(() => {});
    window.isTesting = true;
  });

  afterEach(() => {
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
        "key1=value1&key2=value2",
      );
    });

    it("should encode URI components", () => {
      const params = { "key 1": "value 1", "key 2": "value 2" };
      expect(createHashStringFromParams(params)).to.equal(
        "key%201=value%201&key%202=value%202",
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
      updateState(state, {
        bodyType: "male",
        selections: {
          body: { itemId: "1", variant: "light" },
        },
      });
      seedCatalog(catalogWriter, {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      });

      const params = getHashParamsforSelections(
        catalog,
        state.selections,
        state.bodyType,
      );
      expect(params).to.deep.equal({
        sex: "male",
        body: "Body_light",
      });
    });

    it("should generate hash params for recolor selections", () => {
      updateState(state, {
        bodyType: "male",
        selections: {
          body: { itemId: "1", recolor: "light" },
        },
      });
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
          ],
        },
      });

      const params = getHashParamsforSelections(
        catalog,
        state.selections,
        state.bodyType,
      );
      expect(params).to.deep.equal({
        sex: "male",
        body: "Body_light",
      });
    });

    it("should generate hash params for recolor selections containing subcolors", () => {
      updateState(state, {
        bodyType: "male",
        selections: {
          body: { itemId: "1", recolor: "light" },
          eyes: { itemId: "1", subId: 1, recolor: "blue" },
        },
      });
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
            {
              type_name: "eyes",
              label: "Eyes",
              material: "eyes",
              palettes: ["ulpc"],
              variants: ["blue"],
            },
          ],
        },
      });

      const params = getHashParamsforSelections(
        catalog,
        state.selections,
        state.bodyType,
      );
      expect(params).to.deep.equal({
        sex: "male",
        body: "Body_light",
        eyes: "Eyes_blue",
      });
    });
  });

  describe("syncSelectionsToHash", () => {
    it("should sync selections to the hash", () => {
      updateState(state, {
        bodyType: "male",
        selections: {
          body: { itemId: "1", variant: "light" },
        },
      });
      seedCatalog(catalogWriter, {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      });

      syncSelectionsToHash(catalog, state);
      expect(getSetHashCalledTimes()).to.equal(1);
    });
  });

  describe("loadSelectionsFromHash", () => {
    it("should load selections from hash", () => {
      setHash("#body=Body_light");
      seedCatalog(catalogWriter, {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          name: "Body (light)",
          recolor: "",
        },
      });
    });

    it("should be case insensitive", () => {
      setHash("#body=Body_color_light");
      seedCatalog(catalogWriter, {
        1: { type_name: "body", name: "Body_Color", variants: ["light"] },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          name: "Body_Color (light)",
          recolor: "",
        },
      });
    });

    it("matches old hash variants that used underscores for spaces (issue #296)", () => {
      setHash("#eyebrows=Thin_Eyebrows_dark_brown");
      seedCatalog(catalogWriter, {
        1: {
          type_name: "eyebrows",
          name: "Thin_Eyebrows",
          variants: ["dark brown"],
        },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        eyebrows: {
          itemId: "1",
          subId: null,
          variant: "dark brown",
          name: "Thin_Eyebrows (dark brown)",
          recolor: "",
        },
      });
    });

    it("should load recolor options", () => {
      setHash("#body=Body_light");
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
          ],
        },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "",
          name: "Body (light)",
          recolor: "light",
        },
      });
    });

    it("should load multiple recolor options", () => {
      setHash("#body=Body_light&eyes=Eyes_blue");
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
            {
              type_name: "eyes",
              label: "Eyes",
              material: "eyes",
              palettes: ["ulpc"],
              variants: ["blue"],
            },
          ],
        },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "",
          name: "Body (light)",
          recolor: "light",
        },
        eyes: {
          itemId: "1",
          subId: 1,
          variant: "",
          name: "Eyes (blue)",
          recolor: "blue",
        },
      });
    });

    it("should remove subcolor if doesn't exist on item", () => {
      setHash("#body=Body_light&eyes=Eyes_blue");
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
          ],
        },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "",
          name: "Body (light)",
          recolor: "light",
        },
      });
    });

    it("should remove subcolor if type name does not match", () => {
      setHash("#body=Body_light&eyes=Eyes_blue");
      seedCatalog(catalogWriter, {
        1: {
          type_name: "body",
          name: "Body",
          recolors: [
            { material: "body", palettes: ["ulpc"], variants: ["light"] },
            {
              type_name: "eye",
              label: "Eyes",
              material: "eyes",
              palettes: ["ulpc"],
              variants: ["blue"],
            },
          ],
        },
      });

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "",
          name: "Body (light)",
          recolor: "light",
        },
      });
    });

    it("should forward to robe belt", () => {
      setHash("#body=Body_color_light&belt=Other_belts_white");
      seedCatalog(
        catalogWriter,
        {
          1: { type_name: "body", name: "Body_Color", variants: ["light"] },
          2: { type_name: "belt", name: "Other_belts", variants: ["white"] },
          3: { type_name: "belt", name: "Robe_Belt", variants: ["white"] },
        },
        {
          aliasMetadata: {
            belt: {
              Other_belts_white: {
                typeName: "belt",
                name: "Robe_Belt",
                variant: "white",
              },
            },
          },
        },
      );

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          recolor: "",
          name: "Body_Color (light)",
        },
        belt: {
          itemId: "3",
          subId: null,
          variant: "white",
          recolor: "",
          name: "Robe_Belt (white)",
        },
      });
      expect(getHash()).to.equal(
        "#sex=male&body=Body_Color_light&belt=Robe_Belt_white",
      );
    });

    it("should forward to waist = robe belt", () => {
      setHash("#body=Body_color_light&belt=Other_belts_white");
      seedCatalog(
        catalogWriter,
        {
          1: { type_name: "body", name: "Body_Color", variants: ["light"] },
          2: { type_name: "belt", name: "Other_belts", variants: ["white"] },
          3: { type_name: "waist", name: "Robe_Belt", variants: ["white"] },
        },
        {
          aliasMetadata: {
            belt: {
              Other_belts_white: {
                typeName: "waist",
                name: "Robe_Belt",
                variant: "white",
              },
            },
          },
        },
      );

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          recolor: "",
          name: "Body_Color (light)",
        },
        waist: {
          itemId: "3",
          subId: null,
          variant: "white",
          recolor: "",
          name: "Robe_Belt (white)",
        },
      });
      expect(getHash()).to.equal(
        "#sex=male&body=Body_Color_light&waist=Robe_Belt_white",
      );
    });

    it("should forward only type name, wrinkes > wrinkles", () => {
      setHash("#body=Body_color_light&wrinkes=Wrinkles_light");
      seedCatalog(
        catalogWriter,
        {
          1: { type_name: "body", name: "Body_Color", variants: ["light"] },
          2: { type_name: "belt", name: "Other_belts", variants: ["white"] },
          4: { type_name: "wrinkles", name: "Wrinkles", variants: ["light"] },
        },
        {
          aliasMetadata: {
            wrinkes: {
              "*": {
                typeName: "wrinkles",
                name: "*",
                variant: "*",
              },
            },
          },
        },
      );

      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          recolor: "",
          name: "Body_Color (light)",
        },
        wrinkles: {
          itemId: "4",
          subId: null,
          variant: "light",
          recolor: "",
          name: "Wrinkles (light)",
        },
      });
      expect(getHash()).to.equal(
        "#sex=male&body=Body_Color_light&wrinkles=Wrinkles_light",
      );
    });

    it("loads selections from catalog only (no window metadata globals)", () => {
      seedCatalog(catalogWriter, {
        1: { type_name: "body", name: "Body", variants: ["light"] },
      });

      setHash("#body=Body_light");
      loadSelectionsFromHash(catalog, state);
      expect(state.selections).to.deep.equal({
        body: {
          itemId: "1",
          subId: null,
          variant: "light",
          name: "Body (light)",
          recolor: "",
        },
      });
    });
  });

  describe("initHashChangeListener", () => {
    it("should add a 'hashchange' event listener to the window", () => {
      initHashChangeListener(catalog, state);
      expect(window.addEventListener.calledWith("hashchange")).to.be.true;
    });

    it("should call the provided callback when the hash changes", () => {
      const callback = sandbox.spy();
      initHashChangeListener(catalog, state, callback);

      // Simulate hash change
      setHash("#key=value");
      window.addEventListener.getCall(0).args[1](); // Call the event listener

      expect(callback.calledOnce).to.be.true;
      expect(getHash()).to.equal("#key=value");
    });

    it("should reload selections when the hash changes externally", async () => {
      initCanvas();
      initHashChangeListener(catalog, state);
      const handler = window.addEventListener.getCall(0).args[1];

      setHash("#external=change");
      await handler();

      expect(state.selections.body).to.exist;
    });

    it("should not throw an error if no callback is provided", () => {
      expect(() => initHashChangeListener(catalog, state)).to.not.throw();
    });
  });
});

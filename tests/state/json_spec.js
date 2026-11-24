import {
  exportStateAsJSON,
  importStateFromJSON,
  resetJsonDeps,
  setJsonDeps,
} from "../../sources/state/json.ts";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import { createCatalog } from "../../sources/state/catalog.ts";
import { createState } from "../../sources/state/state.ts";
let state;

describe("state/json.ts", () => {
  let catalog;

  beforeEach(() => {
    state = createState();
    ({ reader: catalog } = createCatalog());
    resetJsonDeps();
  });

  afterEach(() => {
    resetJsonDeps();
  });

  describe("exportStateAsJSON", () => {
    it("serializes state using hash deps, credits, and URL parts from deps", () => {
      setJsonDeps({
        createHashStringFromParams: sinon.stub().returns("sex=male"),
        getHashParamsforSelections: sinon.stub().returns({ sex: "male" }),
        getAllCredits: () => ({ "Artist A": ["file1"] }),
        getLocationOrigin: () => "https://example.com",
        getLocationPathname: () => "/lpc/",
      });
      const snapshot = {
        bodyType: "male",
        selections: {},
        selectedAnimation: "walk",
        showTransparencyGrid: true,
        applyTransparencyMask: false,
        matchBodyColorEnabled: true,
        compactDisplay: false,
        enabledLicenses: { CC0: true },
        enabledAnimations: { walk: false },
      };
      const out = exportStateAsJSON(catalog, snapshot, [
        { zPos: 1, path: "p" },
      ]);
      const parsed = JSON.parse(out);
      expect(parsed.version).to.equal(2);
      expect(parsed.url).to.equal("https://example.com/lpc/#sex=male");
      expect(parsed.layers).to.deep.equal([{ zPos: 1, path: "p" }]);
      expect(parsed.credits).to.deep.equal({ "Artist A": ["file1"] });
      expect(parsed.bodyType).to.equal("male");
    });
  });

  describe("importStateFromJSON", () => {
    it("normalizes legacy primary palette variants while preserving valid sprite variants", () => {
      const { reader, writer } = createCatalog();
      const palette = { default: "ulpc", variants: ["violet", "dark_brown"] };
      writer.registerItemMetadata({
        hair: {
          name: "Natural",
          type_name: "hair",
          variants: [],
          recolors: [palette],
        },
        hat: {
          name: "Hat",
          type_name: "hat",
          variants: ["violet"],
          recolors: [palette],
        },
      });
      const selections = {
        hair: { itemId: "hair", name: "Old name", variant: "Dark%20Brown" },
        hat: { itemId: "hat", name: "Hat", variant: "violet" },
        sub: { itemId: "hair", name: "Sub", subId: 1, variant: "violet" },
        color: {
          itemId: "hair",
          name: "Color",
          variant: "violet",
          recolor: "dark_brown",
        },
      };
      const imported = importStateFromJSON(
        reader,
        state,
        JSON.stringify({ version: 2, bodyType: "male", selections }),
      );
      expect(imported.selections).to.deep.equal({
        ...selections,
        hair: {
          ...selections.hair,
          name: "Natural (dark_brown)",
          variant: "",
          recolor: "dark_brown",
        },
      });
    });

    it("returns a merged state object for version 2", () => {
      const json = JSON.stringify({
        version: 2,
        bodyType: "female",
        selections: { body: { itemId: "1" } },
        selectedAnimation: "idle",
      });
      const result = importStateFromJSON(catalog, state, json);
      expect(result.bodyType).to.equal("female");
      expect(result.selections.body.itemId).to.equal("1");
      expect(result.selectedAnimation).to.equal("idle");
    });

    it("calls loadSelectionsFromHash with the URL hash for version 1", () => {
      const loadSelectionsFromHash = sinon.stub();
      setJsonDeps({ loadSelectionsFromHash });
      importStateFromJSON(
        catalog,
        state,
        JSON.stringify({
          version: 1,
          url: "https://example.com/app/#body=Body_light",
        }),
      );
      expect(loadSelectionsFromHash.calledOnce).to.be.true;
      expect(loadSelectionsFromHash.firstCall.args[0]).to.equal(catalog);
      expect(loadSelectionsFromHash.firstCall.args[1]).to.equal(state);
      expect(loadSelectionsFromHash.firstCall.args[2]).to.equal(
        "body=Body_light",
      );
    });

    it("throws for invalid JSON", () => {
      expect(() => importStateFromJSON(catalog, state, "not json")).to.throw(
        SyntaxError,
      );
    });

    it("throws when version 2 is missing required fields", () => {
      expect(() =>
        importStateFromJSON(
          catalog,
          state,
          JSON.stringify({ version: 2, bodyType: "male" }),
        ),
      ).to.throw("Invalid JSON format");
    });

    it("throws when version 1 has no url", () => {
      expect(() =>
        importStateFromJSON(catalog, state, JSON.stringify({ version: 1 })),
      ).to.throw("Invalid JSON format");
    });

    it("throws for unsupported version", () => {
      expect(() =>
        importStateFromJSON(
          catalog,
          state,
          JSON.stringify({
            version: 3,
            bodyType: "m",
            selections: {},
          }),
        ),
      ).to.throw("Unsupported version");
    });

    it("throws when JSON root is not an object or has invalid v2 field types", () => {
      const invalidPayloads = [
        "null",
        "[]",
        JSON.stringify({ version: 2, bodyType: 123, selections: {} }),
        JSON.stringify({ version: 2, bodyType: "alien", selections: {} }),
        JSON.stringify({ version: 2, bodyType: "male", selections: "bad" }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: { body: { itemId: 123 } },
        }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: { body: { itemId: "1", subId: "bad" } },
        }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: {},
          selectedAnimation: 99,
        }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: {},
          showTransparencyGrid: "yes",
        }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: {},
          enabledLicenses: "bad",
        }),
        JSON.stringify({
          version: 2,
          bodyType: "male",
          selections: {},
          enabledAnimations: { walk: "true" },
        }),
        JSON.stringify({ version: 1, url: 42 }),
      ];

      for (const payload of invalidPayloads) {
        expect(() => importStateFromJSON(catalog, state, payload)).to.throw(
          "Invalid JSON format",
        );
      }
    });

    it("strips forbidden prototype keys and accepts valid optional v2 flags", () => {
      const raw =
        '{"version":2,"bodyType":"female","selections":{"__proto__":{"itemId":"x"},"body":{"itemId":"1","name":"Body","variant":"light","recolor":null,"subId":0}},"showTransparencyGrid":false,"enabledLicenses":{"__proto__":true,"CC0":true},"enabledAnimations":{"walk":true}}';
      const result = importStateFromJSON(catalog, state, raw);
      expect(result.bodyType).to.equal("female");
      expect(result.showTransparencyGrid).to.equal(false);
      expect(Object.keys(result.selections)).to.deep.equal(["body"]);
      expect(result.enabledLicenses).to.deep.equal({ CC0: true });
      expect(result.enabledAnimations).to.deep.equal({ walk: true });
    });

    it("preserves existing enabledLicenses when imported enabledLicenses is empty or contains only unknown keys", () => {
      const originalLicenses = { ...state.enabledLicenses };
      const emptyPayload = JSON.stringify({
        version: 2,
        bodyType: "male",
        selections: {},
        enabledLicenses: {},
        enabledAnimations: { unknown_anim: true, walk: true },
      });
      const resEmpty = importStateFromJSON(catalog, state, emptyPayload);
      expect(resEmpty.enabledLicenses).to.deep.equal(originalLicenses);
      expect(resEmpty.enabledAnimations).to.deep.equal({ walk: true });

      const unknownPayload = JSON.stringify({
        version: 2,
        bodyType: "male",
        selections: {},
        enabledLicenses: { not_a_license: true },
      });
      const resUnknown = importStateFromJSON(catalog, state, unknownPayload);
      expect(resUnknown.enabledLicenses).to.deep.equal(originalLicenses);
    });
  });
});

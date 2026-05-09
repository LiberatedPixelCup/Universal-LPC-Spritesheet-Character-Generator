import {
  exportStateAsJSON,
  importStateFromJSON,
  resetJsonDeps,
  setJsonDeps,
} from "../../sources/state/json.js";
import { state } from "../../sources/state/state.ts";
import { DEFAULT_LOCALE } from "../../sources/i18n/index.ts";
import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";

describe("state/json.js", () => {
  beforeEach(() => {
    resetJsonDeps();
    state.locale = DEFAULT_LOCALE;
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
        locale: "zh-CN",
        selections: {},
        selectedAnimation: "walk",
        showTransparencyGrid: true,
        applyTransparencyMask: false,
        matchBodyColorEnabled: true,
        compactDisplay: false,
        enabledLicenses: { CC0: true },
        enabledAnimations: { walk: false },
      };
      const out = exportStateAsJSON(snapshot, [{ zPos: 1, path: "p" }]);
      const parsed = JSON.parse(out);
      expect(parsed.version).to.equal(2);
      expect(parsed.url).to.equal("https://example.com/lpc/#sex=male");
      expect(parsed.layers).to.deep.equal([{ zPos: 1, path: "p" }]);
      expect(parsed.credits).to.deep.equal({ "Artist A": ["file1"] });
      expect(parsed.bodyType).to.equal("male");
      expect(parsed.locale).to.equal("zh-CN");
    });
  });

  describe("importStateFromJSON", () => {
    it("returns a merged state object for version 2", () => {
      const json = JSON.stringify({
        version: 2,
        bodyType: "female",
        locale: "ja",
        selections: { body: { itemId: "1" } },
        selectedAnimation: "idle",
      });
      const result = importStateFromJSON(json);
      expect(result.bodyType).to.equal("female");
      expect(result.selections.body.itemId).to.equal("1");
      expect(result.locale).to.equal("ja");
      expect(result.selectedAnimation).to.equal("idle");
    });

    it("keeps the current locale for version 2 JSON without locale", () => {
      const json = JSON.stringify({
        version: 2,
        bodyType: "female",
        selections: { body: { itemId: "1" } },
      });
      const result = importStateFromJSON(json);
      expect(result.locale).to.equal("en");
    });

    it("ignores invalid locale values", () => {
      const json = JSON.stringify({
        version: 2,
        bodyType: "female",
        locale: "fr-FR",
        selections: { body: { itemId: "1" } },
      });
      const result = importStateFromJSON(json);
      expect(result.locale).to.equal("en");
    });

    it("calls loadSelectionsFromHash with the URL hash for version 1", () => {
      const loadSelectionsFromHash = sinon.stub();
      setJsonDeps({ loadSelectionsFromHash });
      importStateFromJSON(
        JSON.stringify({
          version: 1,
          url: "https://example.com/app/#body=Body_light",
        }),
      );
      expect(loadSelectionsFromHash.calledOnce).to.be.true;
      expect(loadSelectionsFromHash.firstCall.args[0]).to.equal(
        "body=Body_light",
      );
    });

    it("throws for invalid JSON", () => {
      expect(() => importStateFromJSON("not json")).to.throw(SyntaxError);
    });

    it("throws when version 2 is missing required fields", () => {
      expect(() =>
        importStateFromJSON(JSON.stringify({ version: 2, bodyType: "male" })),
      ).to.throw("Invalid JSON format");
    });

    it("throws when version 1 has no url", () => {
      expect(() =>
        importStateFromJSON(JSON.stringify({ version: 1 })),
      ).to.throw("Invalid JSON format");
    });

    it("throws for unsupported version", () => {
      expect(() =>
        importStateFromJSON(
          JSON.stringify({
            version: 3,
            bodyType: "m",
            selections: {},
          }),
        ),
      ).to.throw("Unsupported version");
    });
  });
});

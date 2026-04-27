import { expect } from "chai";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  getAllCredits,
  creditsToCsv,
  creditsToTxt,
} from "../../sources/utils/credits.ts";
import { resetCatalogForTests } from "../../sources/state/catalog.ts";
import {
  restoreAppCatalogAfterTest,
  seedBrowserCatalog,
} from "../browser-catalog-fixture.js";
import { state } from "../../sources/state/state.js";

describe("utils/credits.ts", () => {
  let previousSelectedAnimation;

  beforeEach(() => {
    previousSelectedAnimation = state.selectedAnimation;
    resetCatalogForTests();
  });

  afterEach(async () => {
    await restoreAppCatalogAfterTest();
    state.selectedAnimation = previousSelectedAnimation;
  });

  describe("getAllCredits", () => {
    it("returns an empty array when selections is empty", () => {
      seedBrowserCatalog({});
      expect(getAllCredits({}, "male")).to.deep.equal([]);
    });

    it("skips items with no metadata or no credits", () => {
      seedBrowserCatalog({
        noCredits: {
          animations: ["walk"],
          layers: { layer_1: { male: "a/" } },
        },
      });
      expect(
        getAllCredits({ g: { itemId: "noCredits", variant: null } }, "male"),
      ).to.deep.equal([]);
    });

    it("includes a credit when the used sprite path matches the credit file prefix", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["walk"],
          layers: {
            layer_1: { male: "eyes/human/adult/" },
          },
          credits: [
            {
              file: "eyes/human",
              authors: ["Alex"],
              licenses: ["CC-BY-SA"],
              urls: ["https://example.org"],
              notes: "Eye assets",
            },
          ],
        },
      });
      state.selectedAnimation = "walk";

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: null } },
        "male",
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0].fileName).to.equal("eyes/human/adult/walk.png");
      expect(result[0].authors).to.deep.equal(["Alex"]);
      expect(result[0].licenses).to.deep.equal(["CC-BY-SA"]);
      expect(result[0].urls).to.deep.equal(["https://example.org"]);
      expect(result[0].notes).to.equal("Eye assets");
    });

    it("uses variant path segments when selection has a variant", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["walk"],
          layers: {
            layer_1: { male: "arms/bracers/" },
          },
          credits: [
            {
              file: "arms/bracers",
              authors: ["B"],
              licenses: ["OGA-BY"],
              urls: [],
            },
          ],
        },
      });
      state.selectedAnimation = "walk";

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: "light brown" } },
        "male",
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0].fileName).to.equal("arms/bracers/walk/light_brown.png");
    });

    it("uses state.selectedAnimation when building paths", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["walk", "run"],
          layers: {
            layer_1: { male: "gear/" },
          },
          credits: [
            {
              file: "gear",
              authors: ["C"],
              licenses: ["MIT"],
              urls: [],
            },
          ],
        },
      });
      state.selectedAnimation = "run";

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: null } },
        "male",
      );

      expect(result[0].fileName).to.equal("gear/run.png");
    });

    it("uses the first listed animation when walk is not available", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["idle", "jump"],
          layers: {
            layer_1: { male: "prop/" },
          },
          credits: [
            {
              file: "prop",
              authors: ["D"],
              licenses: ["CC0"],
              urls: [],
            },
          ],
        },
      });
      state.selectedAnimation = undefined;

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: null } },
        "male",
      );

      expect(result[0].fileName).to.equal("prop/idle.png");
    });

    it("matches credit when used path equals credit.file exactly", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["walk"],
          layers: {
            layer_1: { male: "flat/" },
          },
          credits: [
            {
              file: "flat/walk.png",
              authors: ["E"],
              licenses: ["MIT"],
              urls: [],
            },
          ],
        },
      });
      state.selectedAnimation = "walk";

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: null } },
        "male",
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0].fileName).to.equal("flat/walk.png");
    });

    it("does not emit duplicate entries for the same used path", () => {
      seedBrowserCatalog({
        item1: {
          animations: ["walk"],
          layers: {
            layer_1: { male: "dup/" },
          },
          credits: [
            {
              file: "dup",
              authors: ["First"],
              licenses: ["A"],
              urls: [],
            },
            {
              file: "dup",
              authors: ["Second"],
              licenses: ["B"],
              urls: [],
            },
          ],
        },
      });
      state.selectedAnimation = "walk";

      const result = getAllCredits(
        { slot: { itemId: "item1", variant: null } },
        "male",
      );

      expect(result).to.have.lengthOf(1);
      expect(result[0].authors).to.deep.equal(["First"]);
    });
  });

  describe("creditsToCsv", () => {
    it("outputs a header row and one quoted row per credit", () => {
      const csv = creditsToCsv([
        {
          fileName: "a/b.png",
          notes: "note",
          authors: ["A", "B"],
          licenses: ["L1", "L2"],
          urls: ["u1", "u2"],
        },
      ]);
      const lines = csv.trim().split("\n");
      expect(lines[0]).to.equal("filename,notes,authors,licenses,urls");
      expect(lines[1]).to.equal('"a/b.png","note","A, B","L1, L2","u1, u2"');
    });

    it("uses empty string for missing notes", () => {
      const csv = creditsToCsv([
        {
          fileName: "x.png",
          authors: ["A"],
          licenses: ["MIT"],
          urls: [],
        },
      ]);
      expect(csv).to.include('"x.png","","A","MIT",""');
    });
  });

  describe("creditsToTxt", () => {
    it("formats filename, optional note, licenses, authors, and links", () => {
      const txt = creditsToTxt([
        {
          fileName: "path/to.png",
          notes: "Thanks",
          authors: ["One"],
          licenses: ["OGA-BY"],
          urls: ["https://a"],
        },
      ]);
      expect(txt).to.equal(
        `path/to.png
\t- Note: Thanks
\t- Licenses:
\t\t- OGA-BY
\t- Authors:
\t\t- One
\t- Links:
\t\t- https://a

`,
      );
    });

    it("omits the note block when notes is missing", () => {
      const txt = creditsToTxt([
        {
          fileName: "only.png",
          authors: ["A"],
          licenses: ["CC0"],
          urls: [],
        },
      ]);
      expect(txt).not.to.include("Note:");
      expect(txt).to.include("only.png");
    });
  });
});

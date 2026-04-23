import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  collectCreditsCsvRows,
  generateCreditsCsv,
  parseCredits,
  processItemCredits,
  sortCsvList,
} from "../../../../scripts/generateSources/credits.mjs";
import { ANIMATIONS } from "../../../../sources/state/constants.ts";
import {
  categoryTree,
  csvList,
  itemMetadata,
  licensesFound,
} from "../../../../scripts/generateSources/state.mjs";
import { buildPath, resetTestState } from "./test_helpers.js";

function buildCredit(file) {
  return {
    file,
    notes: 'quoted "note"',
    authors: ["Fixture Author"],
    licenses: ["CC-BY 3.0"],
    urls: ["https://example.invalid/asset"],
  };
}

test("parseCredits returns selected credit and csv line for first emit", () => {
  resetTestState();

  const [selectedCredit, lineText, imageFileName] = parseCredits(
    "body/wheelchair/adult/background/wheelchair",
    [buildCredit("body/wheelchair/adult/background/wheelchair")],
    null,
    [],
  );

  assert.equal(
    selectedCredit.file,
    "body/wheelchair/adult/background/wheelchair",
  );
  assert.equal(
    imageFileName,
    '"body/wheelchair/adult/background/wheelchair.png" ',
  );
  assert.match(lineText, /\*\*note\*\*/);
  assert.deepEqual(licensesFound, ["CC-BY 3.0"]);
});

test("parseCredits returns empty csv line when image already emitted", () => {
  resetTestState();

  const fileName = "body/wheelchair/adult/background/wheelchair";
  const [, lineText] = parseCredits(fileName, [buildCredit(fileName)], null, [
    '"body/wheelchair/adult/background/wheelchair.png" ',
  ]);

  assert.equal(lineText, "");
});

test("parseCredits throws when no matching credit exists", () => {
  resetTestState();

  assert.throws(
    () =>
      parseCredits(
        "body/wheelchair/adult/background/walk",
        [buildCredit("body/wheelchair/not-a-real-path")],
        null,
        [],
      ),
    /missing credit inside body\/wheelchair\/adult\/background\/walk/,
  );
});

test("parseCredits throws for array-like credits with length=0", () => {
  resetTestState();

  const emptyCredits = [];
  emptyCredits.length = 0;

  assert.throws(
    () =>
      parseCredits(
        "body/wheelchair/adult/background/wheelchair",
        emptyCredits,
        null,
        [],
      ),
    /missing credit inside body\/wheelchair\/adult\/background\/wheelchair/,
  );
});

test("parseCredits throws for array-like credits with length=1 and wrong file", () => {
  resetTestState();

  const credits = [buildCredit("wrong/path")];
  credits.length = 1;

  assert.throws(
    () =>
      parseCredits(
        "body/wheelchair/adult/background/wheelchair",
        credits,
        null,
        [],
      ),
    /missing credit inside body\/wheelchair\/adult\/background\/wheelchair/,
  );
});

test("parseCredits succeeds for single-credit array when credit file matches exactly", () => {
  resetTestState();

  const fileName = "body/wheelchair/adult/background/wheelchair";
  const credits = [buildCredit(fileName)];

  const [selectedCredit] = parseCredits(fileName, credits, null, []);

  assert.equal(selectedCredit.file, fileName);
});

test("parseCredits succeeds for single-credit array when fileName includes credit file", () => {
  resetTestState();

  // credit file is a parent path; fileName is a child of it
  const credits = [buildCredit("body/wheelchair")];
  const fileName = "body/wheelchair/adult/background/wheelchair";

  const [selectedCredit] = parseCredits(fileName, credits, null, []);

  assert.equal(selectedCredit.file, "body/wheelchair");
});

test("parseCredits logs no-credits error for empty credits array before throwing", () => {
  resetTestState();

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    assert.throws(
      () => parseCredits("body/wheelchair/walk", [], null, []),
      /missing credit inside/,
    );
  } finally {
    console.error = origError;
  }

  assert.ok(errors.some((e) => e.includes("no credits for filename:")));
});

test("parseCredits logs wrong-credit error for single-credit mismatch before throwing", () => {
  resetTestState();

  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    assert.throws(
      () =>
        parseCredits(
          "body/wheelchair/walk",
          [buildCredit("body/other")],
          null,
          [],
        ),
      /missing credit inside/,
    );
  } finally {
    console.error = origError;
  }

  assert.ok(errors.some((e) => e.includes("Wrong credit at filename:")));
});

test("collectCreditsCsvRows skips noExport animations and empty layer files", () => {
  resetTestState();

  const noExportAnim = ANIMATIONS.find((anim) => anim.noExport);
  assert.ok(noExportAnim, "Fixture expects at least one noExport animation");

  const { listItemsCSV, listCreditToUse } = collectCreditsCsvRows(
    {
      layer_1: {
        male: "body/wheelchair/adult/background/",
        female: "",
      },
      layer_2: {
        male: null,
        female: null,
      },
    },
    {
      animations: [noExportAnim.value, "wheelchair"],
      required: ["male", "female"],
      credits: [buildCredit("body/wheelchair/adult/background/wheelchair")],
      priority: 10,
    },
  );

  assert.equal(listItemsCSV.length, 1);
  assert.equal(
    listCreditToUse.file,
    "body/wheelchair/adult/background/wheelchair",
  );
});

test("processItemCredits builds csv, appends entries, and injects licenses", () => {
  resetTestState();
  const sheetsDir = buildPath("build1-basic", "sheets");

  itemMetadata.wheelchair = {
    priority: 40,
    animations: ["wheelchair"],
    required: ["male", "female"],
    credits: [buildCredit("body/wheelchair/adult/background/wheelchair")],
  };

  const { csv, listCreditToUse } = processItemCredits(
    "wheelchair",
    path.join(sheetsDir, "body"),
    {
      layer_1: {
        male: "body/wheelchair/adult/background/",
        female: "body/wheelchair/adult/background/",
      },
    },
    sheetsDir,
  );

  assert.equal(csv.length, 2);
  assert.equal(
    listCreditToUse.file,
    "body/wheelchair/adult/background/wheelchair",
  );
  assert.deepEqual(itemMetadata.wheelchair.licenses.male, ["CC-BY 3.0"]);
  assert.deepEqual(itemMetadata.wheelchair.licenses.female, ["CC-BY 3.0"]);
  assert.equal(csvList.length, 1);
  assert.equal(csvList[0].path, "body");
});

test("sortCsvList orders by category priority then label", () => {
  resetTestState();

  const entries = [
    { path: path.join("head", "nose"), csv: [] },
    { path: path.join("body", "torso"), csv: [] },
    { path: path.join("body", "arms"), csv: [] },
  ];

  const tree = {
    children: {
      body: {
        priority: 1,
        label: "Body",
        children: {
          torso: { priority: 2, label: "Torso", children: {} },
          arms: { priority: 1, label: "Arms", children: {} },
        },
      },
      head: {
        priority: 2,
        label: "Head",
        children: {
          nose: { priority: 1, label: "Nose", children: {} },
        },
      },
    },
  };

  sortCsvList(entries, tree);

  assert.equal(entries[0].path, path.join("body", "arms"));
  assert.equal(entries[1].path, path.join("body", "torso"));
  assert.equal(entries[2].path, path.join("head", "nose"));
});

test("generateCreditsCsv returns generated text", () => {
  resetTestState();
  licensesFound.push("GPL 3.0");

  categoryTree.children = {};
  csvList.push({
    path: "body",
    csv: [{ priority: 1, lineText: '"x.png","n","a","l","u"\n' }],
  });

  const generated = generateCreditsCsv();

  assert.match(generated, /^filename,notes,authors,licenses,urls\n/);
  assert.match(generated, /x\.png/);
});

test("generateCreditsCsv returns header when csvList is empty", () => {
  resetTestState();
  categoryTree.children = {};

  const generated = generateCreditsCsv();

  assert.equal(generated, "filename,notes,authors,licenses,urls\n");
});

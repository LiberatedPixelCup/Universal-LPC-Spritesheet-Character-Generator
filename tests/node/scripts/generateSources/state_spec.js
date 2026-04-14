import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  PALETTES_DIR,
  SHEETS_DIR,
  aliasMetadata,
  buildMetadataJs,
  categoryTree,
  csvList,
  itemMetadata,
  licensesFound,
  onlyIfTemplate,
  paletteMetadata,
  sortDirTree,
  readDirTree,
  parseJson,
} from "../../../../scripts/generateSources/state.mjs";
import { buildPath, resetTestState } from "./test_helpers.js";

test("state exports expected constant directory suffixes", () => {
  assert.ok(SHEETS_DIR.endsWith(path.sep));
  assert.ok(PALETTES_DIR.endsWith(path.sep));
});

test("state exports mutable shared collections with expected defaults", () => {
  assert.equal(onlyIfTemplate, false);
  assert.ok(Array.isArray(licensesFound));
  assert.ok(Array.isArray(csvList));
  assert.deepEqual(itemMetadata, {});
  assert.deepEqual(aliasMetadata, {});
  assert.deepEqual(categoryTree, { items: [], children: {} });
  assert.deepEqual(paletteMetadata, { versions: {}, materials: {} });
});

test("buildMetadataJs exports all four metadata objects and syncs window", () => {
  resetTestState();
  itemMetadata.test_item = { name: "Test" };
  categoryTree.children.body = { items: [], children: {} };

  const js = buildMetadataJs();

  assert.match(js, /const itemMetadata\s*=/);
  assert.match(js, /const aliasMetadata\s*=/);
  assert.match(js, /const categoryTree\s*=/);
  assert.match(js, /const paletteMetadata\s*=/);
  assert.match(js, /export\s*\{\s*itemMetadata/);
  assert.match(js, /window\.itemMetadata\s*=\s*itemMetadata/);
  assert.match(js, /"test_item"/);
});

test("buildMetadataJs returns valid output with empty state", () => {
  resetTestState();

  const js = buildMetadataJs();

  assert.match(js, /THIS FILE IS AUTO-GENERATED/);
  assert.match(js, /const itemMetadata = \{\}/);
  assert.match(js, /const aliasMetadata = \{\}/);
});

test("sortDirTree sorts shallow paths before deep paths", () => {
  const entries = [
    { parentPath: path.join("a", "b"), name: "z.json" },
    { parentPath: "a", name: "a.json" },
  ];

  entries.sort(sortDirTree);

  assert.equal(entries[0].parentPath, "a");
});

test("sortDirTree falls back to locale compare at same depth", () => {
  const entries = [
    { parentPath: "a", name: "z.json" },
    { parentPath: "a", name: "a.json" },
  ];

  entries.sort(sortDirTree);

  assert.equal(entries[0].name, "a.json");
});

test("readDirTree returns sorted palette files for build1-basic", () => {
  const palettesDir = buildPath("build1-basic", "palettes");

  const entries = readDirTree(palettesDir);
  const names = entries.map((e) => e.name);

  assert.ok(names.includes("meta_body.json"));
  assert.ok(names.includes("body_ulpc.json"));
  assert.ok(names.includes("body_lpcr.json"));
  assert.ok(names.includes("all_lpcr.json"));
  // "all/all_lpcr.json" sorts before "body/meta_body.json" ("all" < "body")
  const allLpcrIdx = entries.findIndex((e) => e.name === "all_lpcr.json");
  const metaBodyIdx = entries.findIndex((e) => e.name === "meta_body.json");
  assert.ok(allLpcrIdx < metaBodyIdx);
});

test("readDirTree returns sorted sheet files for build1-basic", () => {
  const sheetsDir = buildPath("build1-basic", "sheets");

  const entries = readDirTree(sheetsDir);
  const fileEntries = entries.filter((e) => !e.isDirectory());
  const names = fileEntries.map((e) => e.name);

  assert.ok(names.includes("wheelchair.json"));
  assert.ok(names.includes("head_nose_big.json"));
  // wheelchair.json is at depth 3, head_nose_big.json is at depth 4 — shallower sorts first
  const wheelchairIdx = fileEntries.findIndex(
    (e) => e.name === "wheelchair.json",
  );
  const noseIdx = fileEntries.findIndex((e) => e.name === "head_nose_big.json");
  assert.ok(wheelchairIdx < noseIdx);
});

test("readDirTree returns all palette files for build4-expansive", () => {
  const palettesDir = buildPath("build4-expansive", "palettes");

  const entries = readDirTree(palettesDir);
  const fileEntries = entries.filter((e) => !e.isDirectory());
  const names = fileEntries.map((e) => e.name);

  assert.ok(names.includes("meta_lpcr.json"));
  assert.ok(names.includes("meta_ulpc.json"));
  // meta_lpcr.json < meta_ulpc.json lexicographically ("l" < "u")
  const metaLpcrIdx = fileEntries.findIndex((e) => e.name === "meta_lpcr.json");
  const metaUlpcIdx = fileEntries.findIndex((e) => e.name === "meta_ulpc.json");
  assert.ok(metaLpcrIdx < metaUlpcIdx);
});

test("readDirTree throws for a non-existent directory", () => {
  const dir = buildPath("build1-basic", "no_such_dir");

  assert.throws(() => readDirTree(dir), /ENOENT|no such file/);
});

test("parseJson reads and parses a valid palette fixture file", () => {
  const fullPath = path.join(
    buildPath("build1-basic", "palettes"),
    "body",
    "meta_body.json",
  );

  const result = parseJson(fullPath);

  assert.equal(result.type, "material");
  assert.equal(result.label, "Body");
  assert.equal(result.default, "ulpc");
});

test("parseJson throws SyntaxError for malformed palette JSON", () => {
  const fullPath = path.join(
    buildPath("build2-invalid", "palettes"),
    "bad_lpcr.json",
  );

  assert.throws(() => parseJson(fullPath), /SyntaxError|Expected/);
});

test("parseJson throws for a non-existent file", () => {
  const fullPath = path.join(
    buildPath("build1-basic", "palettes"),
    "does_not_exist.json",
  );

  assert.throws(() => parseJson(fullPath), /ENOENT|no such file/);
});

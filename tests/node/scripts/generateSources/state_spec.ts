import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  PALETTES_DIR,
  SHEETS_DIR,
  aliasMetadata,
  buildAllMetadataModules,
  buildCreditsMetadataJs,
  buildIndexMetadataJs,
  buildItemMetadataLiteJs,
  buildLayersMetadataJs,
  buildMetadataIndexes,
  buildPaletteMetadataJs,
  categoryTree,
  csvList,
  getMetadataJsonIndent,
  itemMetadata,
  licensesFound,
  onlyIfTemplate,
  paletteMetadata,
  sortDirTree,
  readDirTree,
  parseJson,
  internSlimByTypeNameRows,
  splitItemMetadataMaps,
  type GeneratorItem,
} from "../../../../scripts/generateSources/state.ts";
import type { SlimByTypeNameRow } from "../../../../sources/state/catalog.ts";
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

test("getMetadataJsonIndent is 2 in development only", () => {
  assert.equal(getMetadataJsonIndent("development"), 2);
  assert.equal(getMetadataJsonIndent("production"), undefined);
});

test("splitItemMetadataMaps strips layers and credits into side maps", () => {
  resetTestState();
  itemMetadata.a = {
    name: "A",
    type_name: "t",
    layers: { layer_1: { male: "p" } },
    credits: [{ licenses: ["X"] }],
  };
  const { itemMetadataLite, itemCredits, itemLayers } =
    splitItemMetadataMaps(itemMetadata);
  assert.equal(itemMetadataLite.a.name, "A");
  assert.ok(
    !Object.prototype.hasOwnProperty.call(itemMetadataLite.a, "layers"),
  );
  assert.deepEqual(itemLayers.a, itemMetadata.a.layers);
  assert.deepEqual(itemCredits.a, itemMetadata.a.credits);
});

test("buildMetadataIndexes groups lite rows by type_name in key order", () => {
  resetTestState();
  itemMetadata.z = {
    name: "Z",
    type_name: "body",
    layers: {},
    credits: [],
  };
  itemMetadata.a = {
    name: "A",
    type_name: "body",
    layers: {},
    credits: [],
  };
  const { byTypeName } = buildMetadataIndexes(itemMetadata, {});
  assert.equal(byTypeName.body.length, 2);
  assert.deepEqual(byTypeName.body[0], {
    itemId: "z",
    name: "Z",
    type_name: "body",
    variants: [],
    recolors: [],
  });
  assert.deepEqual(byTypeName.body[1], {
    itemId: "a",
    name: "A",
    type_name: "body",
    variants: [],
    recolors: [],
  });
});

test("internSlimByTypeNameRows treats missing variants as an empty array", () => {
  const { variantArrays, byTypeName } = internSlimByTypeNameRows({
    t: [
      {
        itemId: "a",
        name: "A",
        type_name: "t",
      } as SlimByTypeNameRow,
    ],
  });

  assert.deepEqual(variantArrays, [[]]);
  assert.equal(byTypeName.t[0].v, 0);
});

test("buildIndexMetadataJs shares byTypeName between metadataIndexes fields", () => {
  resetTestState();
  itemMetadata.x = {
    name: "N",
    type_name: "t",
    layers: {},
    credits: [],
  };
  const js = buildIndexMetadataJs(aliasMetadata, categoryTree, itemMetadata);
  assert.match(js, /const byTypeName = /);
  assert.match(js, /hashMatch:\s*\{\s*itemsByTypeName:\s*byTypeName\s*\}/);
  assert.match(
    js,
    /export\s*\{\s*aliasMetadata,\s*categoryTree,\s*metadataIndexes\s*\}/,
  );
  assert.doesNotMatch(js, /window\./);
});

test("buildAllMetadataModules yields five basenames without window assignments", () => {
  resetTestState();
  const modules = buildAllMetadataModules("production");
  assert.equal(modules.size, 5);
  for (const src of modules.values()) {
    assert.match(src, /THIS FILE IS AUTO-GENERATED/);
    assert.doesNotMatch(src, /window\./);
  }
});

test("metadata JSON is compact in production and pretty in development", () => {
  resetTestState();
  itemMetadata.nested = { bar: 1 } as GeneratorItem;

  const prodItem = buildItemMetadataLiteJs(itemMetadata, "production");
  const devItem = buildItemMetadataLiteJs(itemMetadata, "development");
  assert.ok(
    prodItem.includes('"bar":1') && prodItem.includes('"nested"'),
    "production item-metadata should embed compact JSON for nested",
  );
  assert.ok(
    devItem.includes('"bar": 1'),
    "development should pretty-print embedded JSON",
  );
  assert.ok(
    devItem.includes("\n"),
    "development output should include newlines inside embedded JSON",
  );

  const prodPal = buildPaletteMetadataJs("production");
  const devPal = buildPaletteMetadataJs("development");
  assert.ok(prodPal.includes('"versions":{}'));
  const palJsonStart = devPal.indexOf("{");
  assert.ok(
    palJsonStart >= 0 && devPal.slice(palJsonStart).includes("\n  "),
    "development palette-metadata should indent top-level JSON",
  );

  const prodCred = buildCreditsMetadataJs(itemMetadata, "production");
  const devCred = buildCreditsMetadataJs(itemMetadata, "development");
  assert.ok(prodCred.includes('"nested":[]'));
  assert.ok(
    devCred.slice(devCred.indexOf("{")).includes("\n  "),
    "development credits-metadata should indent",
  );

  const prodLay = buildLayersMetadataJs(itemMetadata, "production");
  const devLay = buildLayersMetadataJs(itemMetadata, "development");
  assert.ok(prodLay.includes('"nested":{}'));
  assert.ok(
    devLay.slice(devLay.indexOf("{")).includes("\n  "),
    "development layers-metadata should indent",
  );
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

  const result = parseJson(fullPath) as {
    type: string;
    label: string;
    default: string;
  };

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

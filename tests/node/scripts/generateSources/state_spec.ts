import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  PALETTES_DIR,
  SHEETS_DIR,
  UNUSED_LITE_EMIT_KEYS,
  aliasMetadata,
  buildAllMetadataModules,
  buildCreditsMetadataJs,
  buildIndexMetadataJs,
  buildInternedItemMetadataLiteMap,
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
  internRecolorPaletteMaps,
  internSlimByTypeNameRows,
  splitItemMetadataMaps,
  type GeneratorItem,
} from "../../../../scripts/generateSources/state.ts";
import { expandInternedItemLite } from "../../../../sources/state/resolve-hash-param.ts";
import type { SlimByTypeNameRow } from "../../../../sources/state/catalog.ts";
import { populateAndSortCategoryTree } from "../../../../scripts/generateSources/tree.ts";
import {
  buildPath,
  extractTopLevelConstJson,
  mergeMetadataForTests,
  resetTestState,
  runBuild,
} from "./test_helpers.js";

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

function assertNoUnusedLiteKeys(
  record: Record<string, unknown>,
  label: string,
): void {
  for (const key of UNUSED_LITE_EMIT_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(record, key),
      false,
      `${label} should omit ${key}`,
    );
  }
}

function generatorItemWithUnusedAndKeptFields(
  overrides: GeneratorItem = {},
): GeneratorItem {
  return {
    name: "Kept Name",
    type_name: "kept_type",
    required: ["male", "female"],
    animations: ["walk", "idle"],
    path: ["body", "kept"],
    replace_in_path: { male: { adult: "male" } },
    matchBodyColor: true,
    preview_row: 3,
    preview_column: 1,
    preview_x_offset: 4,
    preview_y_offset: -2,
    variants: ["light"],
    recolors: [{ material: "body", variants: ["light"] }],
    licenses: { male: ["CC-BY 3.0"], female: ["OGA-BY 3.0"] },
    tags: ["tag-a"],
    required_tags: ["need-a"],
    excluded_tags: ["skip-a"],
    priority: 40,
    ...overrides,
  };
}

test("emitted lite JSON omits licenses, tags, required_tags, excluded_tags, and priority", async () => {
  const result = await runBuild("build1-basic");
  const lite = extractTopLevelConstJson(
    result.writes.get("item-metadata.js") ?? "",
    "itemMetadata",
  ) as Record<string, Record<string, unknown>>;
  const ids = Object.keys(lite);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    assertNoUnusedLiteKeys(lite[id], id);
  }

  resetTestState();
  itemMetadata.populated = generatorItemWithUnusedAndKeptFields();
  const populatedLite = extractTopLevelConstJson(
    buildItemMetadataLiteJs(itemMetadata),
    "itemMetadata",
  ) as Record<string, Record<string, unknown>>;
  assertNoUnusedLiteKeys(populatedLite.populated, "populated");
  assert.equal(populatedLite.populated.name, "Kept Name");
});

test("vr == null fallback also omits unused lite emit fields", () => {
  const lite = {
    fallback: generatorItemWithUnusedAndKeptFields({
      name: "Fallback",
    }),
  };
  const interned = buildInternedItemMetadataLiteMap(lite, {});
  const record = interned.fallback as Record<string, unknown>;
  assert.equal(record.name, "Fallback");
  assertNoUnusedLiteKeys(record, "vr==null fallback");
  assert.equal("v" in record, false);
  assert.equal("r" in record, false);
});

test("emit does not mutate in-memory fullItemMetadata licenses", () => {
  resetTestState();
  const licenses = { male: ["CC-BY 3.0"], female: ["OGA-BY 3.0"] };
  itemMetadata.kept = generatorItemWithUnusedAndKeptFields({ licenses });
  const before = itemMetadata.kept.licenses;
  assert.deepEqual(before, licenses);

  buildItemMetadataLiteJs(itemMetadata);

  assert.strictEqual(itemMetadata.kept.licenses, before);
  assert.deepEqual(itemMetadata.kept.licenses, licenses);
  assert.deepEqual(itemMetadata.kept.tags, ["tag-a"]);
  assert.equal(itemMetadata.kept.priority, 40);
});

test("runBuild csvGenerated still contains license columns", async () => {
  const result = await runBuild("build1-basic");
  assert.match(result.csvGenerated, /^filename,notes,authors,licenses,urls\n/);
  assert.match(result.csvGenerated, /CC-BY 3\.0/);
  assert.match(result.csvGenerated, /OGA-BY 3\.0/);
});

test("generated categoryTree item order still follows in-memory priority", () => {
  resetTestState();
  itemMetadata.item_z = {
    name: "Aardvark",
    priority: 20,
    path: ["body", "item_z"],
    type_name: "t",
  };
  itemMetadata.item_a = {
    name: "Zebra",
    priority: 10,
    path: ["body", "item_a"],
    type_name: "t",
  };

  populateAndSortCategoryTree();
  assert.deepEqual(categoryTree.children!.body!.items, ["item_a", "item_z"]);

  const tree = extractTopLevelConstJson(
    buildIndexMetadataJs(aliasMetadata, categoryTree, itemMetadata),
    "categoryTree",
  ) as { children: { body: { items: string[] } } };
  assert.deepEqual(tree.children.body.items, ["item_a", "item_z"]);
  assert.equal(itemMetadata.item_a.priority, 10);
  assert.equal(itemMetadata.item_z.priority, 20);
});

test("mergeMetadataForTests round-trip still carries kept lite fields", () => {
  resetTestState();
  const full = generatorItemWithUnusedAndKeptFields();
  itemMetadata.kept = full;
  const writes = buildAllMetadataModules("production", {
    itemMetadata,
  });
  const merged = mergeMetadataForTests(writes) as Record<string, GeneratorItem>;
  const item = merged.kept;
  assert.equal(item.name, "Kept Name");
  assert.equal(item.type_name, "kept_type");
  assert.deepEqual(item.required, ["male", "female"]);
  assert.deepEqual(item.animations, ["walk", "idle"]);
  assert.deepEqual(item.path, ["body", "kept"]);
  assert.deepEqual(item.replace_in_path, { male: { adult: "male" } });
  assert.equal(item.matchBodyColor, true);
  assert.equal(item.preview_row, 3);
  assert.equal(item.preview_column, 1);
  assert.equal(item.preview_x_offset, 4);
  assert.equal(item.preview_y_offset, -2);
});

const BODY_ULPC_NAMES = { "body.ulpc": ["light", "olive"] };
const CLOTH_ULPC_NAMES = { "cloth.ulpc": ["red"] };

type InternedLiteRecolor = {
  palettes?: unknown;
  p?: number;
  variants?: string[];
  material?: string;
};

function itemWithPaletteMap(
  name: string,
  palettes: Record<string, string[]>,
): GeneratorItem {
  return {
    name,
    type_name: "t",
    variants: ["male"],
    recolors: [{ material: "body", variants: ["light", "olive"], palettes }],
  };
}

test("internRecolorPaletteMaps shares an index for deep-equal maps in first-seen order", () => {
  const { paletteArrays } = internRecolorPaletteMaps({
    a: itemWithPaletteMap("A", BODY_ULPC_NAMES),
    b: itemWithPaletteMap("B", BODY_ULPC_NAMES),
    c: itemWithPaletteMap("C", CLOTH_ULPC_NAMES),
  });
  assert.equal(paletteArrays.length, 2);
  assert.deepEqual(paletteArrays[0], BODY_ULPC_NAMES);
  assert.deepEqual(paletteArrays[1], CLOTH_ULPC_NAMES);
});

test("internRecolorPaletteMaps skips token-array palettes and missing palettes keys", () => {
  const { paletteArrays } = internRecolorPaletteMaps({
    tokens: {
      name: "Tokens",
      recolors: [{ material: "body", palettes: ["ulpc"] }],
    },
    missing: {
      name: "Missing",
      recolors: [{ material: "body", variants: ["light"] }],
    },
    holes: {
      name: "Holes",
      recolors: [
        null as never,
        { material: "body", palettes: BODY_ULPC_NAMES },
      ],
    },
    empty: { name: "Empty" },
  });
  assert.deepEqual(paletteArrays, [BODY_ULPC_NAMES]);
});

test("maps not in paletteArrays stay expanded and null recolors are left alone", () => {
  const { paletteArrays } = internRecolorPaletteMaps({
    a: itemWithPaletteMap("A", BODY_ULPC_NAMES),
  });
  const interned = buildInternedItemMetadataLiteMap(
    {
      b: {
        name: "B",
        recolors: [
          null as never,
          1 as never,
          { material: "cloth", palettes: CLOTH_ULPC_NAMES },
        ],
      },
    },
    {},
    paletteArrays,
  );
  const recs = (interned.b as { recolors: InternedLiteRecolor[] }).recolors;
  assert.equal(recs[0], null);
  assert.equal(recs[1], 1);
  assert.deepEqual(recs[2].palettes, CLOTH_ULPC_NAMES);
  assert.equal("p" in recs[2], false);
});

test("vr == null fallback still emits p for internable palette maps", () => {
  const lite = {
    fallback: {
      name: "Fallback",
      recolors: [{ material: "body", palettes: BODY_ULPC_NAMES }],
    },
  };
  const { paletteArrays } = internRecolorPaletteMaps(lite);
  const interned = buildInternedItemMetadataLiteMap(lite, {}, paletteArrays);
  const record = interned.fallback as {
    name: string;
    recolors: InternedLiteRecolor[];
  };
  assert.equal(record.name, "Fallback");
  assert.equal("v" in record, false);
  assert.equal("r" in record, false);
  assert.equal(record.recolors[0].p, 0);
  assert.equal("palettes" in record.recolors[0], false);
});

test("token-array palettes are not interned and keep their value", () => {
  resetTestState();
  itemMetadata.tokens = {
    name: "Tokens",
    type_name: "t",
    recolors: [{ material: "body", palettes: ["ulpc"] }],
  };
  const lite = extractTopLevelConstJson(
    buildItemMetadataLiteJs(itemMetadata),
    "itemMetadata",
  ) as Record<string, { recolors: InternedLiteRecolor[] }>;
  assert.deepEqual(lite.tokens.recolors[0].palettes, ["ulpc"]);
  assert.equal("p" in lite.tokens.recolors[0], false);
});

test("a recolor with no palettes key is untouched", () => {
  resetTestState();
  itemMetadata.none = {
    name: "None",
    type_name: "t",
    recolors: [{ material: "body", variants: ["light"] }],
  };
  const lite = extractTopLevelConstJson(
    buildItemMetadataLiteJs(itemMetadata),
    "itemMetadata",
  ) as Record<string, { recolors: InternedLiteRecolor[] }>;
  assert.equal("palettes" in lite.none.recolors[0], false);
  assert.equal("p" in lite.none.recolors[0], false);
  assert.deepEqual(lite.none.recolors[0].variants, []);
});

test("buildItemMetadataLiteJs emits p and no embedded palette maps", () => {
  resetTestState();
  itemMetadata.one = itemWithPaletteMap("One", BODY_ULPC_NAMES);
  const itemJs = buildItemMetadataLiteJs(itemMetadata);
  assert.match(itemJs, /"p":/);
  assert.doesNotMatch(itemJs, /"body\.ulpc"/);
  assert.doesNotMatch(itemJs, /"palettes":\{/);
});

test("index and lite p indices resolve against the same paletteArrays", () => {
  resetTestState();
  itemMetadata.one = itemWithPaletteMap("One", BODY_ULPC_NAMES);
  itemMetadata.two = itemWithPaletteMap("Two", BODY_ULPC_NAMES);
  itemMetadata.three = itemWithPaletteMap("Three", CLOTH_ULPC_NAMES);
  const indexJs = buildIndexMetadataJs(
    aliasMetadata,
    categoryTree,
    itemMetadata,
  );
  const lite = extractTopLevelConstJson(
    buildItemMetadataLiteJs(itemMetadata),
    "itemMetadata",
  ) as Record<string, { recolors: InternedLiteRecolor[] }>;
  const paletteArrays = extractTopLevelConstJson(
    indexJs,
    "paletteArrays",
  ) as Record<string, string[]>[];
  assert.deepEqual(paletteArrays[lite.one.recolors[0].p!], BODY_ULPC_NAMES);
  assert.equal(lite.one.recolors[0].p, lite.two.recolors[0].p);
  assert.deepEqual(paletteArrays[lite.three.recolors[0].p!], CLOTH_ULPC_NAMES);
  assert.notEqual(lite.one.recolors[0].p, lite.three.recolors[0].p);
});

test("expand round-trip deep-equals the pre-intern lite", () => {
  resetTestState();
  itemMetadata.round = {
    name: "Round",
    type_name: "t",
    required: ["male"],
    animations: ["walk"],
    path: ["body", "round"],
    replace_in_path: {},
    matchBodyColor: false,
    variants: ["male"],
    recolors: [
      {
        material: "body",
        variants: ["light", "olive"],
        palettes: BODY_ULPC_NAMES,
      },
    ],
  };
  const preIntern = splitItemMetadataMaps(itemMetadata).itemMetadataLite.round;
  const writes = buildAllMetadataModules("production", { itemMetadata });
  const indexSrc = writes.get("index-metadata.js") ?? "";
  const rawLite = extractTopLevelConstJson(
    writes.get("item-metadata.js") ?? "",
    "itemMetadata",
  ) as Record<string, Parameters<typeof expandInternedItemLite>[0]>;
  const expanded = expandInternedItemLite(
    rawLite.round,
    extractTopLevelConstJson(indexSrc, "variantArrays") as string[][],
    extractTopLevelConstJson(indexSrc, "recolorVariantArrays") as string[][],
    extractTopLevelConstJson(indexSrc, "paletteArrays") as never,
  );
  assert.deepEqual(expanded, preIntern);
});

test("interned palette emit is byte-identical across two runs", () => {
  resetTestState();
  itemMetadata.one = itemWithPaletteMap("One", BODY_ULPC_NAMES);
  itemMetadata.two = itemWithPaletteMap("Two", CLOTH_ULPC_NAMES);
  const indexA = buildIndexMetadataJs(
    aliasMetadata,
    categoryTree,
    itemMetadata,
  );
  const indexB = buildIndexMetadataJs(
    aliasMetadata,
    categoryTree,
    itemMetadata,
  );
  const itemA = buildItemMetadataLiteJs(itemMetadata);
  const itemB = buildItemMetadataLiteJs(itemMetadata);
  assert.equal(indexA, indexB);
  assert.equal(itemA, itemB);
});

test("development pretty intern emit round-trips palettes like production", () => {
  resetTestState();
  itemMetadata.round = itemWithPaletteMap("Round", BODY_ULPC_NAMES);
  const prod = mergeMetadataForTests(
    buildAllMetadataModules("production", { itemMetadata }),
  ) as Record<string, GeneratorItem>;
  const dev = mergeMetadataForTests(
    buildAllMetadataModules("development", { itemMetadata }),
  ) as Record<string, GeneratorItem>;
  assert.deepEqual(dev.round.recolors, prod.round.recolors);
  assert.deepEqual(prod.round.recolors![0].palettes, BODY_ULPC_NAMES);
  assert.equal("p" in (prod.round.recolors![0] as InternedLiteRecolor), false);
});

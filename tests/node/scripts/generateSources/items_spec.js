import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ANIMATION_DEFAULTS } from "../../../../sources/state/constants.ts";
import {
  parseItem,
  getRequiredSexes,
  buildTreePath,
  collectLayers,
} from "../../../../scripts/generateSources/items.mjs";
import { loadPaletteMetadata } from "../../../../scripts/generateSources/palettes.mjs";
import {
  aliasMetadata,
  itemMetadata,
  parseJson,
} from "../../../../scripts/generateSources/state.mjs";
import { buildPath, resetTestState } from "./test_helpers.js";

function writeTempJson(tempRoot, fileName, jsonContent, subdir = "body") {
  const dir = path.join(tempRoot, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, JSON.stringify(jsonContent, null, 2));
  return { dir, fullPath };
}

test("parseItem parses valid fixture file and writes item metadata", () => {
  resetTestState();
  const sheetsDir = buildPath("build1-basic", "sheets");
  const palettesDir = buildPath("build1-basic", "palettes");
  loadPaletteMetadata({
    palettesDir: palettesDir,
  });

  const parsed = parseItem(path.join(sheetsDir, "body"), "wheelchair.json", {
    sheetsDir,
  });

  assert.equal(parsed.itemId, "wheelchair");
  assert.equal(parsed.definition.name, "Wheelchair");
  assert.deepEqual(itemMetadata.wheelchair.required, [
    "male",
    "female",
    "teen",
    "muscular",
    "pregnant",
  ]);
  assert.deepEqual(itemMetadata.wheelchair.path, ["body", "wheelchair"]);
  assert.equal(Object.keys(itemMetadata.wheelchair.layers).length, 2);
});

test("parseItem throws for ignored fixture item", () => {
  resetTestState();
  const sheetsDir = buildPath("build2-invalid", "sheets");

  assert.throws(
    () =>
      parseItem(path.join(sheetsDir, "body"), "ignored_item.json", {
        sheetsDir,
      }),
    /Skipping ignored item: ignored_item/,
  );
});

test("parseItem throws for malformed JSON input", () => {
  resetTestState();
  const sheetsDir = buildPath("build3-errors", "sheets");

  assert.throws(
    () =>
      parseItem(path.join(sheetsDir, "body"), "bad_json.json", { sheetsDir }),
    /SyntaxError|Expected/,
  );
});

test("parseItem applies animation defaults and alias mappings when fields are omitted", () => {
  resetTestState();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-items-"));
  const sheetsDir = path.join(tempRoot, "sheets");
  const { dir } = writeTempJson(sheetsDir, "alias_item.json", {
    name: "Alias Item",
    variants: ["adult"],
    layer_1: {
      male: "body/alias/adult/",
    },
    aliases: {
      old: "adult",
    },
    type_name: "aliasType",
    recolors: {
      material: "missing",
      palettes: ["base"],
    },
  });

  const parsed = parseItem(dir, "alias_item.json", { sheetsDir });

  assert.equal(parsed.itemId, "alias_item");
  assert.deepEqual(itemMetadata.alias_item.animations, ANIMATION_DEFAULTS);
  assert.deepEqual(itemMetadata.alias_item.required, ["male"]);
  assert.deepEqual(itemMetadata.alias_item.recolors[0].material, "missing");
  assert.deepEqual(aliasMetadata.aliasType.old, {
    typeName: "aliasType",
    name: "Alias_Item",
    variant: "adult",
  });
});

test("parseItem normalizes recolors when palette metadata is loaded", () => {
  resetTestState();
  const sheetsDir = buildPath("build1-basic", "sheets");
  const palettesDir = buildPath("build1-basic", "palettes");
  loadPaletteMetadata({
    palettesDir: palettesDir,
  });

  parseItem(path.join(sheetsDir, "head", "nose"), "head_nose_big.json", {
    sheetsDir,
  });

  const [recolor] = itemMetadata.head_nose_big.recolors;
  assert.equal(recolor.default, "ulpc");
  assert.equal(recolor.base, "ulpc.skin");
  assert.ok(recolor.variants.includes("light"));
  assert.ok(recolor.variants.includes("lpcr.ashen"));
  assert.ok(recolor.variants.includes("all.lpcr.indigo"));
});

test("parseItem defaults to empty recolor list when recolors are absent", () => {
  resetTestState();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-items-"));
  const sheetsDir = path.join(tempRoot, "sheets");
  const { dir } = writeTempJson(sheetsDir, "plain_item.json", {
    name: "Plain Item",
    layer_1: {
      female: "body/plain/adult/",
    },
    type_name: "plain",
  });

  parseItem(dir, "plain_item.json", { sheetsDir });

  assert.deepEqual(itemMetadata.plain_item.recolors, []);
});

test("getRequiredSexes returns body types present in layer_1 in BODY_TYPES order", () => {
  const definition = {
    layer_1: { male: "body/path/", female: "body/path/", teen: "" },
  };

  const result = getRequiredSexes(definition);

  assert.ok(result.includes("male"));
  assert.ok(result.includes("female"));
  assert.ok(!result.includes("teen"));
  assert.ok(result.indexOf("male") < result.indexOf("female"));
});

test("getRequiredSexes returns empty array when no body types are present", () => {
  const definition = {
    layer_1: { male: "", female: null },
  };

  const result = getRequiredSexes(definition);

  assert.deepEqual(result, []);
});

test("buildTreePath returns relative segments plus itemId", () => {
  const sheetsDir = path.join("sheets");
  const filePath = path.join("sheets", "body", "arms");

  const result = buildTreePath(filePath, "gauntlet", sheetsDir);

  assert.deepEqual(result, ["body", "arms", "gauntlet"]);
});

test("buildTreePath returns just itemId when filePath equals sheetsDir", () => {
  const sheetsDir = path.join("sheets");

  const result = buildTreePath(sheetsDir, "gauntlet", sheetsDir);

  assert.deepEqual(result, ["gauntlet"]);
});

test("collectLayers collects contiguous layers starting at 1", () => {
  const definition = {
    layer_1: { male: "a/" },
    layer_2: { male: "b/" },
    layer_3: { male: "c/" },
  };

  const result = collectLayers(definition);

  assert.deepEqual(Object.keys(result), ["layer_1", "layer_2", "layer_3"]);
});

test("collectLayers stops at first gap", () => {
  const definition = {
    layer_1: { male: "a/" },
    layer_3: { male: "c/" },
  };

  const result = collectLayers(definition);

  assert.deepEqual(Object.keys(result), ["layer_1"]);
});

test("collectLayers returns empty object when no layers present", () => {
  const result = collectLayers({});

  assert.deepEqual(result, {});
});

test("parseJson reads and parses a valid fixture JSON file", () => {
  const fullPath = path.join(
    buildPath("build1-basic", "sheets"),
    "body",
    "wheelchair.json",
  );

  const result = parseJson(fullPath);

  assert.equal(result.name, "Wheelchair");
  assert.ok(result.layer_1);
  assert.equal(result.layer_1.male, "body/wheelchair/adult/background/");
});

test("parseJson throws SyntaxError for malformed JSON", () => {
  const fullPath = path.join(
    buildPath("build3-errors", "sheets"),
    "body",
    "bad_json.json",
  );

  assert.throws(() => parseJson(fullPath), /SyntaxError|Expected/);
});

test("parseJson throws for a non-existent file", () => {
  const fullPath = path.join(
    buildPath("build1-basic", "sheets"),
    "body",
    "does_not_exist.json",
  );

  assert.throws(() => parseJson(fullPath), /ENOENT|no such file/);
});

test("parseItem uses buildTreePath when definition.path is absent", () => {
  resetTestState();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-items-path-"));
  const sheetsDir = path.join(tempRoot, "sheets");
  const { dir } = writeTempJson(
    sheetsDir,
    "boots_basic.json",
    {
      name: "Basic Boots",
      layer_1: {
        male: "feet/boots/basic/adult/",
      },
      type_name: "boots",
    },
    path.join("feet", "boots"),
  );

  parseItem(dir, "boots_basic.json", { sheetsDir });

  assert.deepEqual(itemMetadata.boots_basic.path, [
    "feet",
    "boots",
    "boots_basic",
  ]);
});

test("parseItem uses definition.path override when set", () => {
  resetTestState();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-items-path-"));
  const sheetsDir = path.join(tempRoot, "sheets");
  const customPath = ["feet", "boots", "boots_basic"];
  const { dir } = writeTempJson(sheetsDir, "boots_basic.json", {
    name: "Basic Boots",
    layer_1: {
      male: "feet/boots/basic/adult/",
    },
    path: customPath,
    type_name: "boots",
  });

  parseItem(dir, "boots_basic.json", { sheetsDir });

  assert.deepEqual(itemMetadata.boots_basic.path, customPath);
});

test("parseItem path override places item in different UI location than its file location", () => {
  resetTestState();

  // Mirror the mail-helmet scenario: file lives under headwear/helmets/helmets/
  // but should appear in the UI under headwear/coverings/hoods/.
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-items-path-"));
  const sheetsDir = path.join(tempRoot, "sheets");
  const uiPath = ["headwear", "coverings", "hoods", "hat_helmet_mail"];
  const { dir } = writeTempJson(
    sheetsDir,
    "hat_helmet_mail.json",
    {
      name: "Mail",
      layer_1: {
        male: "hat/helmet/mail/adult/",
      },
      path: uiPath,
      type_name: "bandana",
    },
    path.join("headwear", "helmets", "helmets"),
  );

  parseItem(dir, "hat_helmet_mail.json", { sheetsDir });

  // UI path comes from the override, not the file system location
  assert.deepEqual(itemMetadata.hat_helmet_mail.path, uiPath);
  // The directory-derived path would have been this without the override
  assert.notDeepEqual(itemMetadata.hat_helmet_mail.path, [
    "headwear",
    "helmets",
    "helmets",
    "hat_helmet_mail",
  ]);
});

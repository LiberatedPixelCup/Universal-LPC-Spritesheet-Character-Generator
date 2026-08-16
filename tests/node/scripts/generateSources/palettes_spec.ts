import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadPaletteMetadata,
  parsePalette,
} from "../../../../scripts/generateSources/palettes.ts";
import { normalizeRecolors } from "../../../../scripts/generateSources/item-helper.ts";
import { paletteMetadata } from "../../../../scripts/generateSources/state.ts";
import { buildPath, resetTestState } from "./test_helpers.js";

type MaterialWithOldField = (typeof paletteMetadata.materials)[string] & {
  oldField?: boolean;
};

function writeTempPaletteFile(
  root: string,
  subDir: string,
  fileName: string,
  content: string,
): string {
  const dir = path.join(root, subDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), content);
  return dir;
}

test("parsePalette parses material meta files", () => {
  resetTestState();
  const palettesDir = buildPath("build1-basic", "palettes");

  const result = parsePalette(path.join(palettesDir, "body"), "meta_body.json");

  assert.equal(result.kind, "meta");
  assert.equal(result.name, "body");
  assert.equal(paletteMetadata.materials.body.default, "ulpc");
  assert.deepEqual(paletteMetadata.materials.body.palettes, {});
});

test("parsePalette merges material meta files when material already exists", () => {
  resetTestState();
  const palettesDir = buildPath("build1-basic", "palettes");
  paletteMetadata.materials.body = {
    palettes: {},
    oldField: true,
  } as MaterialWithOldField;

  parsePalette(path.join(palettesDir, "body"), "meta_body.json");

  assert.equal(
    (paletteMetadata.materials.body as MaterialWithOldField).oldField,
    true,
  );
  assert.equal(paletteMetadata.materials.body.label, "Body");
});

test("parsePalette writes non-material meta files to versions", () => {
  resetTestState();

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-palettes-"));
  const dir = writeTempPaletteFile(
    tempRoot,
    "colors",
    "meta_colors.json",
    JSON.stringify({ type: "version", label: "Colors" }),
  );

  const result = parsePalette(dir, "meta_colors.json");

  assert.equal(result.kind, "meta");
  assert.equal(result.name, "colors");
  assert.equal(paletteMetadata.versions?.colors.label, "Colors");
});

test("parsePalette parses palette data files", () => {
  resetTestState();
  const palettesDir = buildPath("build1-basic", "palettes");

  const result = parsePalette(path.join(palettesDir, "body"), "body_ulpc.json");

  assert.equal(result.kind, "palette");
  assert.equal(result.material, "body");
  assert.equal(result.version, "ulpc");
  assert.ok(paletteMetadata.materials.body.palettes.ulpc.light);
});

test("parsePalette throws on malformed palette JSON", () => {
  resetTestState();

  assert.throws(
    () =>
      parsePalette(buildPath("build2-invalid", "palettes"), "bad_lpcr.json"),
    /SyntaxError|Expected/,
  );
});

test("loadPaletteMetadata loads fixture palette tree recursively", () => {
  resetTestState();

  loadPaletteMetadata({
    palettesDir: buildPath("build1-basic", "palettes"),
  });

  assert.equal(paletteMetadata.materials.body.default, "ulpc");
  assert.ok(paletteMetadata.materials.body.palettes.ulpc.light);
  assert.ok(paletteMetadata.materials.body.palettes.lpcr.ashen);
  assert.ok(paletteMetadata.materials.all.palettes.lpcr.indigo);
});

test("normalizeRecolors returns empty list when recolors are missing", () => {
  resetTestState();

  assert.deepEqual(normalizeRecolors({}), []);
});

test("normalizeRecolors expands single recolor palette entries", () => {
  resetTestState();
  loadPaletteMetadata({
    palettesDir: buildPath("build1-basic", "palettes"),
  });

  const recolors = normalizeRecolors({
    recolors: {
      material: "body",
      palettes: ["ulpc", "lpcr", "all.lpcr"],
    },
  });

  assert.equal(recolors.length, 1);
  assert.equal(recolors[0].default, "ulpc");
  assert.equal(recolors[0].base, "ulpc.skin");
  assert.equal(recolors[0].label, "Body");
  assert.ok(recolors[0]?.variants?.includes("light"));
  assert.ok(recolors[0]?.variants?.includes("lpcr.ashen"));
  assert.ok(recolors[0]?.variants?.includes("all.lpcr.indigo"));
});

test("normalizeRecolors supports color_n recolor blocks", () => {
  resetTestState();
  loadPaletteMetadata({
    palettesDir: buildPath("build1-basic", "palettes"),
  });

  const recolors = normalizeRecolors({
    recolors: {
      color_1: {
        material: "body",
        type_name: "skinTone",
        palettes: ["ulpc"],
      },
      color_2: {
        material: "body",
        base: "ashen",
        palettes: ["lpcr"],
      },
    },
  });

  assert.equal(recolors.length, 2);
  assert.equal(recolors[0].type_name, "skinTone");
  assert.equal(recolors[1].base, "ulpc.ashen");
});

test("normalizeRecolors leaves entries unchanged when material metadata is missing", () => {
  resetTestState();

  const recolors = normalizeRecolors({
    recolors: {
      material: "missing",
      palettes: ["base"],
      label: "Custom",
    },
  });

  assert.equal(recolors.length, 1);
  assert.equal(recolors[0].material, "missing");
  assert.deepEqual(recolors[0].palettes, ["base"]);
  assert.equal(recolors[0].label, "Custom");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPath,
  loadGeneratorModule,
  runBuild,
  withCapturedConsoleError,
} from "./generateSources/test_helpers.js";
import { loadPaletteMetadata } from "../../../scripts/generateSources/palettes.ts";
import type {
  GeneratorItem,
  GeneratorTreeNode,
} from "../../../scripts/generateSources/state.ts";
import type {
  AliasMetadata,
  MetadataIndexes,
  PaletteMetadata,
} from "../../../sources/state/catalog.ts";

type GeneratorBuildGlobals = {
  itemMetadata: Record<string, GeneratorItem>;
  aliasMetadata: AliasMetadata;
  categoryTree: GeneratorTreeNode;
  paletteMetadata: PaletteMetadata;
  metadataIndexes: MetadataIndexes;
};

function asGlobals(globals: unknown): GeneratorBuildGlobals {
  return globals as GeneratorBuildGlobals;
}

test("build1-basic aligns merged metadata and index-metadata.js indexes", async () => {
  const result = await runBuild("build1-basic");
  const metadata = asGlobals(result.globals).itemMetadata;
  const alias = asGlobals(result.globals).aliasMetadata;
  const category = asGlobals(result.globals).categoryTree;
  const palette = asGlobals(result.globals).paletteMetadata;
  const { metadataIndexes } = asGlobals(result.globals);

  assert.equal(metadata.wheelchair.name, "Wheelchair");
  assert.deepEqual(metadata.wheelchair.animations, ["wheelchair"]);
  assert.deepEqual(metadata.wheelchair.credits![0].licenses, [
    "CC-BY 3.0",
    "OGA-BY 3.0",
  ]);
  assert.deepEqual(metadata.wheelchair.required, [
    "male",
    "female",
    "teen",
    "muscular",
    "pregnant",
  ]);

  assert.deepEqual(alias, {});
  assert.equal(category.children!.body.label, "Body");
  assert.equal(category.children!.body.priority, 10);
  assert.deepEqual(category.children!.body.required, ["male"]);
  assert.equal(palette.materials.body.default, "ulpc");
  assert.equal(palette.materials.body.base, "skin");
  const [recolor] = metadata.head_nose_big.recolors!;
  assert.equal(recolor.default, "ulpc");
  assert.equal(recolor.base, "ulpc.skin");
  assert.equal(typeof recolor.palettes, "object");
  assert.equal(Array.isArray(recolor.palettes), false);
  assert.ok(
    Object.keys(recolor.palettes as Record<string, string[]>).length > 0,
  );
  assert.equal("p" in recolor, false);
  assert.ok(recolor.variants!.includes("light"));
  assert.ok(recolor.variants!.includes("lpcr.ashen"));
  assert.ok(recolor.variants!.includes("all.lpcr.indigo"));

  assert.deepEqual(metadata.wheelchair.path, ["body", "wheelchair"]);
  assert.deepEqual(metadata.head_nose_big.path, [
    "head",
    "nose",
    "head_nose_big",
  ]);

  const wheelchairTypeRows = metadataIndexes.byTypeName.wheelchair;
  assert.ok(Array.isArray(wheelchairTypeRows));
  const wheelchairRow = wheelchairTypeRows.find(
    (row) => row.itemId === "wheelchair",
  );
  assert.ok(wheelchairRow);
  assert.equal(wheelchairRow.name, "Wheelchair");
  assert.strictEqual(
    metadataIndexes.hashMatch.itemsByTypeName,
    metadataIndexes.byTypeName,
  );
});

test("build1-basic includes expected csv rows and skips noExport animations", async () => {
  const result = await runBuild("build1-basic");

  assert.match(
    result.csvGenerated,
    /body\/wheelchair\/adult\/background\/wheelchair\.png/,
  );
  assert.match(result.csvGenerated, /head\/nose\/big\/adult\/walk\.png/);
  assert.doesNotMatch(result.csvGenerated, /watering\.png/);
});

test("ignored-only sheets build can produce empty item metadata", async () => {
  const { result, errors } = await withCapturedConsoleError(() =>
    runBuild("build2-invalid", "build1-basic"),
  );

  assert.deepEqual(asGlobals(result.globals).itemMetadata, {});
  assert.deepEqual(asGlobals(result.globals).metadataIndexes.byTypeName, {});
  assert.deepEqual(asGlobals(result.globals).categoryTree.items, []);
  assert.ok(
    errors.some((entry) =>
      entry.includes("Skipping ignored item: ignored_item"),
    ),
  );
});

test(
  "fails fast when a palette definition is invalid JSON",
  { timeout: 60000 },
  async () => {
    const { generateSources } =
      (await loadGeneratorModule()) as typeof import("../../../scripts/generate_sources.ts");
    assert.throws(
      () =>
        generateSources({
          writeFileSync: () => {
            // no-op write override for negative-path tests
          },
          loadPaletteMetadataFn: () =>
            loadPaletteMetadata({
              palettesDir: buildPath("build2-invalid", "palettes"),
            }),
        }),
      /SyntaxError|Expected/,
    );
  },
);

test("generateSources logs sheet parse errors and still builds multiple valid sheets", async () => {
  const { result, errors } = await withCapturedConsoleError(() =>
    runBuild("build3-errors", "build1-basic"),
  );

  const globals = asGlobals(result.globals);
  assert.equal(globals.itemMetadata.good.name, "Wheelchair");
  assert.equal(globals.itemMetadata.head_nose_big.name, "Big nose");
  assert.deepEqual(globals.itemMetadata.good.path, ["body", "good"]);
  assert.deepEqual(globals.itemMetadata.head_nose_big.path, [
    "head",
    "nose",
    "head_nose_big",
  ]);
  assert.equal(globals.categoryTree.children!.body.label, "Body");
  assert.ok(
    errors.some((entry) =>
      entry.includes("Error parsing sheet file json data:"),
    ),
  );
  assert.ok(
    errors.some((entry) =>
      entry.includes(
        "missing credit inside body/wheelchair/adult/background/walk",
      ),
    ),
  );
});

test("build4-expansive loads broad tree/palette coverage and captures fixture errors", async () => {
  const { result, errors } = await withCapturedConsoleError(() =>
    runBuild("build4-expansive", "build4-expansive"),
  );

  const metadata = asGlobals(result.globals).itemMetadata;
  const tree = asGlobals(result.globals).categoryTree;
  const palettes = asGlobals(result.globals).paletteMetadata;

  assert.ok(Object.keys(metadata).length >= 15);
  assert.equal(metadata.shoulders_mantal.name, "Mantal");
  assert.deepEqual(metadata.shoulders_mantal.path, [
    "arms",
    "shoulders",
    "shoulders_mantal",
  ]);
  assert.equal(metadata.shield_two_engrailed.type_name, "shield");
  assert.deepEqual(metadata.shield_two_engrailed.path, [
    "weapons",
    "shields",
    "engrailed",
    "shield_two_engrailed",
  ]);

  const topLevelCategories = Object.keys(tree.children || {});
  assert.ok(topLevelCategories.length >= 10);
  assert.ok(topLevelCategories.includes("arms"));
  assert.ok(topLevelCategories.includes("body"));
  assert.ok(topLevelCategories.includes("feet"));
  assert.ok(topLevelCategories.includes("hair"));
  assert.ok(topLevelCategories.includes("head"));
  assert.ok(topLevelCategories.includes("headwear"));
  assert.ok(topLevelCategories.includes("legs"));
  assert.ok(topLevelCategories.includes("tools"));
  assert.ok(topLevelCategories.includes("torso"));
  assert.ok(topLevelCategories.includes("weapons"));

  assert.ok(palettes.materials.body?.palettes?.ulpc);
  assert.ok(palettes.materials.cloth?.palettes?.ulpc);
  assert.ok(palettes.materials.eye?.palettes?.ulpc);
  assert.ok(palettes.materials.hair?.palettes?.ulpc);
  assert.ok(palettes.materials.metal?.palettes?.ulpc);
  assert.ok(palettes.materials.all?.palettes?.lpcr);

  assert.ok(
    errors.some((entry) => entry.includes("Error parsing JSON from file:")),
  );
  assert.ok(
    errors.some((entry) =>
      entry.includes(
        "missing credit inside body/wheelchair/adult/background/walk",
      ),
    ),
  );
  assert.ok(
    errors.some((entry) =>
      entry.includes("Skipping ignored item: ignored_item_expansive"),
    ),
  );
});

test("build5-aliases emits non-empty aliasMetadata and pretty index when env is development", async () => {
  const result = await runBuild("build5-aliases", "build1-basic", {
    env: "development",
  });

  const alias = asGlobals(result.globals).aliasMetadata;
  assert.ok(Object.keys(alias).length >= 1);
  assert.deepEqual(alias.alias_build.legacy_slot, {
    typeName: "alias_build",
    name: "Alias_Build_Item",
    variant: "adult",
  });

  const indexSrc = result.writes.get("index-metadata.js") ?? "";
  assert.ok(
    indexSrc.includes("\n  "),
    "development index-metadata.js should pretty-print JSON",
  );
  assert.match(indexSrc, /"alias_build"/);

  const rows = asGlobals(result.globals).metadataIndexes.byTypeName.alias_build;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].itemId, "alias_build_item");
  assert.ok(!Object.prototype.hasOwnProperty.call(rows[0], "layers"));
  assert.ok(!Object.prototype.hasOwnProperty.call(rows[0], "credits"));
  assert.ok(!Object.prototype.hasOwnProperty.call(rows[0], "path"));
  assert.ok(Array.isArray(rows[0].variants));
  assert.ok(Array.isArray(rows[0].recolors));
});

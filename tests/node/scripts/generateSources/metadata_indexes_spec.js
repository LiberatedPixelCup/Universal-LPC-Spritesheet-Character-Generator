import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aliasMetadata,
  buildIndexMetadataJs,
  buildMetadataIndexes,
  internSlimByTypeNameRows,
  categoryTree,
  itemMetadata,
} from "../../../../scripts/generateSources/state.js";
import { expandMetadataIndexesWithInternedArrays } from "../../../../sources/state/resolve-hash-param.ts";
import { resetTestState } from "./test_helpers.js";

test("buildMetadataIndexes rows are slim: itemId, name, type_name, variants, recolors", () => {
  resetTestState();
  itemMetadata.one = {
    name: "One",
    type_name: "t1",
    layers: { layer_1: { male: "p" } },
    credits: [{ file: "x", licenses: ["L"] }],
    variants: [],
    recolors: [{ material: "m", variants: ["indigo", "ash"], other: 1 }],
  };
  const { byTypeName } = buildMetadataIndexes(itemMetadata, {});
  const row = byTypeName.t1[0];
  assert.deepEqual(row, {
    itemId: "one",
    name: "One",
    type_name: "t1",
    variants: [],
    recolors: [{ variants: ["indigo", "ash"] }],
  });
  assert.ok(!Object.prototype.hasOwnProperty.call(row, "layers"));
  assert.ok(!Object.prototype.hasOwnProperty.call(row, "credits"));
  assert.ok(!Object.prototype.hasOwnProperty.call(row, "path"));
});

test("buildMetadataIndexes second arg is reserved; aliasMetadata does not change byTypeName", () => {
  resetTestState();
  itemMetadata.a = {
    name: "A",
    type_name: "body",
    layers: {},
    credits: [],
    variants: [],
    recolors: [],
  };
  const emptyAliases = buildMetadataIndexes(itemMetadata, {});
  const fakeAliases = buildMetadataIndexes(itemMetadata, {
    sash: {
      Waistband_rose: { typeName: "waistband", name: "x", variant: "y" },
    },
  });
  assert.deepEqual(emptyAliases.byTypeName, fakeAliases.byTypeName);
});

test("buildMetadataIndexes preserves itemId, variants, and empty recolors on slim row", () => {
  resetTestState();
  itemMetadata.x = {
    name: "X",
    type_name: "tx",
    layers: {},
    credits: [],
    variants: ["v"],
    recolors: [],
  };
  const { byTypeName } = buildMetadataIndexes(itemMetadata, {});
  assert.deepEqual(byTypeName.tx[0], {
    itemId: "x",
    name: "X",
    type_name: "tx",
    variants: ["v"],
    recolors: [],
  });
});

test("buildIndexMetadataJs serializes non-empty aliasMetadata from shared state", () => {
  resetTestState();
  itemMetadata.item = {
    name: "I",
    type_name: "itype",
    layers: {},
    credits: [],
    variants: [],
    recolors: [],
  };
  aliasMetadata.origin = {
    oldkey: { typeName: "itype", name: "I", variant: "v" },
  };
  const js = buildIndexMetadataJs(aliasMetadata, categoryTree, itemMetadata);
  assert.match(js, /const variantArrays = /);
  assert.match(js, /const recolorVariantArrays = /);
  assert.match(js, /const aliasMetadata = /);
  assert.match(js, /"origin"/);
  assert.match(js, /"oldkey"/);
});

test("internSlimByTypeNameRows + expand round-trips to buildMetadataIndexes rows", () => {
  resetTestState();
  itemMetadata.a = {
    name: "A",
    type_name: "t1",
    layers: {},
    credits: [],
    variants: ["x", "y"],
    recolors: [],
  };
  itemMetadata.b = {
    name: "B",
    type_name: "t1",
    layers: {},
    credits: [],
    variants: ["x", "y"],
    recolors: [],
  };
  const full = buildMetadataIndexes(itemMetadata, {});
  const interned = internSlimByTypeNameRows(full.byTypeName);
  const back = expandMetadataIndexesWithInternedArrays({
    variantArrays: interned.variantArrays,
    recolorVariantArrays: interned.recolorVariantArrays,
    byTypeName: interned.byTypeName,
    hashMatch: { itemsByTypeName: interned.byTypeName },
  });
  assert.deepEqual(back?.byTypeName, full.byTypeName);
});

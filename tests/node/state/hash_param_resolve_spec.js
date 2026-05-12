import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildItemsByTypeNameLite,
  resolveHashParamFromHashMatch,
} from "../../../sources/state/resolve-hash-param.ts";
import { resolveHashParamLegacy } from "./hash_param_resolve_legacy.js";

/**
 * @param {Record<string, object>} itemMetadata
 * @param {Array<{ typeName: string, nameAndVariant: string }>} cases
 */
function assertParity(itemMetadata, cases) {
  const itemsByTypeName = buildItemsByTypeNameLite(itemMetadata);
  for (const { typeName, nameAndVariant } of cases) {
    const legacy = resolveHashParamLegacy({
      typeName,
      nameAndVariant,
      itemMetadata,
    });
    const indexed = resolveHashParamFromHashMatch({
      typeName,
      nameAndVariant,
      itemsByTypeName,
    });
    assert.deepEqual(
      indexed,
      legacy,
      `parity mismatch for ${typeName}=${JSON.stringify(nameAndVariant)}`,
    );
  }
}

test("parity: variant match and case-insensitive name", () => {
  const itemMetadata = {
    1: { type_name: "body", name: "Body", variants: ["light"] },
    2: {
      type_name: "body",
      name: "Body_Color",
      variants: ["light"],
    },
  };
  assertParity(itemMetadata, [
    { typeName: "body", nameAndVariant: "Body_light" },
    { typeName: "body", nameAndVariant: "body_color_light" },
  ]);
});

test("parity: recolor-only rows (recolors[0].variants)", () => {
  const itemMetadata = {
    1: {
      type_name: "body",
      name: "Body",
      recolors: [
        { material: "body", palettes: ["ulpc"], variants: ["light", "ash"] },
      ],
    },
  };
  assertParity(itemMetadata, [
    { typeName: "body", nameAndVariant: "Body_light" },
    { typeName: "body", nameAndVariant: "Body_ash" },
  ]);
});

test("parity: pipe segment splits variant vs explicit recolor", () => {
  const itemMetadata = {
    1: {
      type_name: "body",
      name: "Body",
      recolors: [
        { material: "body", palettes: ["ulpc"], variants: ["light", "deep"] },
      ],
    },
  };
  assertParity(itemMetadata, [
    { typeName: "body", nameAndVariant: "Body_light|deep" },
  ]);
});

test("parity: underscore splits in multi-word names", () => {
  const itemMetadata = {
    1: { type_name: "belt", name: "Other_belts", variants: ["white"] },
    2: { type_name: "belt", name: "Robe_Belt", variants: ["white"] },
  };
  assertParity(itemMetadata, [
    { typeName: "belt", nameAndVariant: "Other_belts_white" },
    { typeName: "belt", nameAndVariant: "Robe_Belt_white" },
  ]);
});

test("parity: tie-breaking follows Object.entries order", () => {
  const itemMetadata = Object.assign(Object.create(null), {
    second: {
      type_name: "t",
      name: "Dup",
      variants: ["v"],
    },
    first: {
      type_name: "t",
      name: "Dup",
      variants: ["v"],
    },
  });
  const legacy = resolveHashParamLegacy({
    typeName: "t",
    nameAndVariant: "Dup_v",
    itemMetadata,
  });
  const indexed = resolveHashParamFromHashMatch({
    typeName: "t",
    nameAndVariant: "Dup_v",
    itemsByTypeName: buildItemsByTypeNameLite(itemMetadata),
  });
  assert.equal(legacy.foundItemId, "second");
  assert.deepEqual(indexed, legacy);
});

test("parity: first matching split wins (left-to-right)", () => {
  const itemMetadata = {
    a: {
      type_name: "hair",
      name: "Long",
      variants: ["bangs_red"],
    },
    b: {
      type_name: "hair",
      name: "Long_bangs",
      variants: ["red"],
    },
  };
  assertParity(itemMetadata, [
    { typeName: "hair", nameAndVariant: "Long_bangs_red" },
  ]);
});

test("parity: variant and recolor branches on same item", () => {
  const itemMetadata = {
    1: {
      type_name: "cape",
      name: "Cape",
      variants: ["long"],
      recolors: [
        { material: "cape", palettes: ["ulpc"], variants: ["crimson"] },
      ],
    },
  };
  assertParity(itemMetadata, [
    { typeName: "cape", nameAndVariant: "Cape_long" },
    { typeName: "cape", nameAndVariant: "Cape_crimson" },
  ]);
});

test("parity: no match returns null id", () => {
  const itemMetadata = {
    1: { type_name: "body", name: "Body", variants: ["light"] },
  };
  assertParity(itemMetadata, [
    { typeName: "body", nameAndVariant: "Missing_nope" },
    { typeName: "wrong_type", nameAndVariant: "Body_light" },
  ]);
});

test("parity: name-only match when variant segment empty", () => {
  const itemMetadata = {
    1: { type_name: "hat", name: "Simple", variants: [] },
  };
  assertParity(itemMetadata, [{ typeName: "hat", nameAndVariant: "Simple" }]);
});

test("parity: multiple types in one map", () => {
  const itemMetadata = {
    1: { type_name: "body", name: "Body", variants: ["light"] },
    2: { type_name: "shoes", name: "Sara", variants: ["sara"] },
  };
  assertParity(itemMetadata, [
    { typeName: "body", nameAndVariant: "Body_light" },
    { typeName: "shoes", nameAndVariant: "Sara_sara" },
  ]);
});

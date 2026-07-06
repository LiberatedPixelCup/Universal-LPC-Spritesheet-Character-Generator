import { test } from "node:test";
import assert from "node:assert/strict";
import { writeAliases } from "../../../../scripts/generateSources/aliases.js";
import { aliasMetadata } from "../../../../scripts/generateSources/state.js";
import { resetTestState } from "./test_helpers.js";

test("writeAliases maps wildcard aliases with explicit target type", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      "legacy=*": "wrinkles=*",
    },
    {
      type_name: "nose",
      name: "Face Nose",
      variants: ["adult"],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "legacy",
      originVariant: "*",
      forward: {
        typeName: "wrinkles",
        name: "*",
        variant: "*",
      },
    },
  ]);
  assert.deepEqual(aliasMetadata.legacy["*"], {
    typeName: "wrinkles",
    name: "*",
    variant: "*",
  });
});

test("writeAliases maps exact variants and falls back to metadata type", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      old: "adult",
    },
    {
      type_name: "nose",
      name: "Face Nose",
      variants: ["adult", "teen"],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "nose",
      originVariant: "old",
      forward: {
        typeName: "nose",
        name: "Face_Nose",
        variant: "adult",
      },
    },
  ]);
});

test("writeAliases resolves segmented target variants", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      source: "head_extra_teen",
    },
    {
      type_name: "head",
      name: "Head Top",
      variants: ["adult", "teen"],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "head",
      originVariant: "source",
      forward: {
        typeName: "head",
        name: "head_extra",
        variant: "teen",
      },
    },
  ]);
});

test("writeAliases falls back to recolor variants when explicit variants are missing", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      old: "blue",
    },
    {
      type_name: "hair",
      name: "Hair Long",
      variants: [],
      recolors: [{ variants: ["blue", "black"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "hair",
      originVariant: "old",
      forward: {
        typeName: "hair",
        name: "Hair_Long",
        variant: "blue",
      },
    },
  ]);
});

test("writeAliases stores name-wildcard alias as a pattern key", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      "Fur_Pants_*": "Formal_Pants_*",
    },
    {
      type_name: "legs",
      name: "Formal Pants",
      variants: [],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "legs",
      originVariant: "Fur_Pants_*",
      forward: {
        typeName: "legs",
        name: "Formal_Pants",
        variant: "*",
      },
    },
  ]);
  assert.deepEqual(aliasMetadata.legs["Fur_Pants_*"], {
    typeName: "legs",
    name: "Formal_Pants",
    variant: "*",
  });
});

test("writeAliases name-wildcard respects explicit target type", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      "Old_Hat_*": "new_type=New_Hat_*",
    },
    {
      type_name: "head",
      name: "New Hat",
      variants: [],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, [
    {
      typeName: "head",
      originVariant: "Old_Hat_*",
      forward: {
        typeName: "new_type",
        name: "New_Hat",
        variant: "*",
      },
    },
  ]);
});

test("writeAliases skips unresolved alias targets", () => {
  resetTestState();

  const mappings = writeAliases(
    {
      old: "doesnotexist",
    },
    {
      type_name: "nose",
      name: "Face Nose",
      variants: ["adult"],
      recolors: [{ variants: ["brown"] }],
    },
  );

  assert.deepEqual(mappings, []);
  assert.deepEqual(aliasMetadata, {});
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseTree,
  sortCategoryTree,
  populateAndSortCategoryTree,
} from "../../../../scripts/generateSources/tree.ts";
import {
  categoryTree,
  itemMetadata,
} from "../../../../scripts/generateSources/state.ts";
import { buildPath, resetTestState } from "./test_helpers.js";

test("parseTree creates a category node from valid meta", () => {
  resetTestState();
  const sheetsDir = buildPath("build1-basic", "sheets");

  const node = parseTree(path.join(sheetsDir, "body"), "meta_body.json", {
    sheetsDir,
  });

  assert.equal(node.label, "Body");
  assert.equal(node.priority, 10);
  assert.deepEqual(node.required, ["male"]);
});

test("parseTree stores null priority when meta omits it", () => {
  resetTestState();
  const sheetsDir = fs.mkdtempSync(path.join(os.tmpdir(), "gen-tree-"));
  const bodyDir = path.join(sheetsDir, "body");
  fs.mkdirSync(bodyDir);
  fs.writeFileSync(
    path.join(bodyDir, "meta_body.json"),
    JSON.stringify({ label: "Body", required: ["male"] }),
  );

  const node = parseTree(bodyDir, "meta_body.json", { sheetsDir });

  assert.equal(node.label, "Body");
  assert.equal(node.priority, null);
});

test("parseTree does not overwrite existing node metadata", () => {
  resetTestState();
  const sheetsDir = buildPath("build1-basic", "sheets");
  const bodyDir = path.join(sheetsDir, "body");

  parseTree(bodyDir, "meta_body.json", { sheetsDir });
  const firstNode = categoryTree.children!.body;
  firstNode!.label = "Custom Label";

  parseTree(bodyDir, "meta_body.json", { sheetsDir });

  assert.equal(categoryTree.children!.body!.label, "Custom Label");
});

test("parseTree throws for malformed meta JSON", () => {
  resetTestState();
  const sheetsDir = buildPath("build3-errors", "sheets");
  const brokenMetaDir = path.join(
    buildPath("build3-errors", "meta-errors"),
    "body",
  );

  assert.throws(
    () => parseTree(brokenMetaDir, "meta_body_broken.json", { sheetsDir }),
    /SyntaxError|Expected/,
  );
});

test("sortCategoryTree sorts children and items recursively", () => {
  const root = {
    items: ["item_z", "item_a"],
    children: {
      second: {
        label: "Second",
        priority: 2,
        items: ["item_b"],
        children: {},
      },
      first: {
        label: "First",
        priority: 1,
        items: ["item_c"],
        children: {},
      },
    },
  };

  const metadata = {
    item_a: { priority: 1, name: "A" },
    item_z: { priority: 2, name: "Z" },
    item_b: { priority: 1, name: "B" },
    item_c: { priority: 1, name: "C" },
  };

  const sorted = sortCategoryTree(root, metadata);

  assert.deepEqual(Object.keys(sorted.children!), ["first", "second"]);
  assert.deepEqual(sorted.items, ["item_a", "item_z"]);
});

test("sortCategoryTree handles missing metadata and missing child collections", () => {
  const root = {
    items: ["unknown2", "unknown1"],
    children: {},
  };

  sortCategoryTree(root, {});

  assert.deepEqual(root.items, ["unknown1", "unknown2"]);
});

test("populateAndSortCategoryTree places items into correct category nodes", () => {
  resetTestState();

  itemMetadata.item_a = {
    path: ["body", "torso", "item_a"],
    priority: 1,
    name: "A",
  };
  itemMetadata.item_b = {
    path: ["body", "arms", "item_b"],
    priority: 2,
    name: "B",
  };

  populateAndSortCategoryTree();

  assert.deepEqual(categoryTree.children!.body!.children!.torso.items, [
    "item_a",
  ]);
  assert.deepEqual(categoryTree.children!.body!.children!.arms.items, [
    "item_b",
  ]);
});

test("populateAndSortCategoryTree falls back to Other for items with no path", () => {
  resetTestState();

  itemMetadata.item_no_path = { path: undefined, priority: 1, name: "No Path" };

  populateAndSortCategoryTree();

  // path defaults to ["Other"], categoryPath is [] (slice 0, -1), so item lands at root
  assert.ok(categoryTree.items!.includes("item_no_path"));
});

test("populateAndSortCategoryTree sorts children and items after population", () => {
  resetTestState();

  itemMetadata.item_z = { path: ["body", "item_z"], priority: 2, name: "Z" };
  itemMetadata.item_a = { path: ["body", "item_a"], priority: 1, name: "A" };

  populateAndSortCategoryTree();

  assert.deepEqual(categoryTree.children!.body!.items, ["item_a", "item_z"]);
});

test("populateAndSortCategoryTree appends to existing node items without duplicating children", () => {
  resetTestState();

  itemMetadata.item_1 = {
    path: ["torso", "item_1"],
    priority: 1,
    name: "First",
  };
  itemMetadata.item_2 = {
    path: ["torso", "item_2"],
    priority: 2,
    name: "Second",
  };

  populateAndSortCategoryTree();

  assert.equal(Object.keys(categoryTree.children!).length, 1);
  assert.deepEqual(categoryTree.children!.torso.items, ["item_1", "item_2"]);
});

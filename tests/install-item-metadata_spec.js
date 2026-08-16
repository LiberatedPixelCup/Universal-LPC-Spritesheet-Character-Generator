import { assert } from "chai";
import { describe, it, afterEach } from "mocha-globals";
import {
  loadAllMetadata,
  resetLoadAllMetadataCacheForTests,
} from "../sources/install-item-metadata.ts";
import { restoreAppCatalogAfterTest } from "./browser-catalog-fixture.js";

const CHUNK_KEYS = [
  "itemMetadata",
  "layersMetadata",
  "creditsMetadata",
  "aliasMetadata",
  "categoryTree",
  "paletteMetadata",
  "metadataIndexes",
];

describe("install-item-metadata.ts", function () {
  afterEach(async function () {
    await restoreAppCatalogAfterTest();
  });

  it("returns the same promise when loadAllMetadata is called twice", function () {
    const first = loadAllMetadata();
    const second = loadAllMetadata();
    assert.strictEqual(first, second);
  });

  it("loads a new chunk payload after the cache is reset", async function () {
    const first = loadAllMetadata();
    resetLoadAllMetadataCacheForTests();
    const second = loadAllMetadata();
    assert.notStrictEqual(first, second);

    const loaded = await second;
    for (const key of CHUNK_KEYS) {
      assert.property(loaded, key);
    }
    assert.isAbove(Object.keys(loaded.itemMetadata).length, 0);
  });
});

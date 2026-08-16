import { expect } from "chai";
import { describe, it } from "mocha-globals";
import { loadAllMetadata } from "../sources/install-item-metadata.ts";
import { createCatalog } from "../sources/state/catalog.ts";

describe("install-item-metadata.ts", () => {
  it("loads the supplied application catalog exactly once", async () => {
    const catalog = createCatalog();

    const loaded = await loadAllMetadata(catalog);
    await catalog.ready.onAllReady;

    expect(Object.keys(loaded.itemMetadata)).not.to.be.empty;
    expect(catalog.isIndexReady()).to.be.true;
    expect(catalog.isLiteReady()).to.be.true;
    expect(catalog.isCreditsReady()).to.be.true;
    expect(catalog.isPaletteReady()).to.be.true;
    expect(catalog.isLayersReady()).to.be.true;

    expect(() => loadAllMetadata(createCatalog())).to.throw(
      "loadAllMetadata() may only be called once",
    );
  });
});

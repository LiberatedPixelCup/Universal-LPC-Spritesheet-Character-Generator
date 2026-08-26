import { expect } from "chai";
import { describe, it } from "mocha-globals";
import {
  createLoadedCatalog,
  loadAllMetadata,
} from "../sources/install-item-metadata.ts";
import { createCatalog } from "../sources/state/catalog.ts";

describe("install-item-metadata.ts", () => {
  it("returns only the reader while metadata loads in the background", async () => {
    const catalog = createLoadedCatalog();
    expect(catalog).not.to.have.property("registerItemMetadata");
    await catalog.ready.onAllReady;
    expect(catalog.isLayersReady()).to.be.true;
  });

  it("loads generated metadata into each supplied catalog", async () => {
    const { reader: catalog, writer } = createCatalog();

    const loaded = await loadAllMetadata(writer);
    await catalog.ready.onAllReady;

    expect(Object.keys(loaded.itemMetadata)).not.to.be.empty;
    expect(catalog.isIndexReady()).to.be.true;
    expect(catalog.isLiteReady()).to.be.true;
    expect(catalog.isCreditsReady()).to.be.true;
    expect(catalog.isPaletteReady()).to.be.true;
    expect(catalog.isLayersReady()).to.be.true;

    const second = createCatalog();
    await loadAllMetadata(second.writer);
    await second.reader.ready.onAllReady;
    expect(second.reader.isLiteReady()).to.be.true;
  });
});

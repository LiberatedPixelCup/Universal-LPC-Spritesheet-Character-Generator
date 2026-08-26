import { expect } from "chai";
import { describe, it } from "mocha-globals";
import {
  createLoadedCatalog,
  loadAllMetadata,
} from "../sources/install-item-metadata.ts";
import {
  createCatalog,
  type CatalogHandles,
  type CatalogReader,
} from "../sources/state/catalog.ts";

describe("install-item-metadata.ts", () => {
  it("returns only the reader while metadata loads in the background", async () => {
    const catalog: CatalogReader = createLoadedCatalog();
    expect(catalog).to.not.have.property("registerItemMetadata");
    await catalog.ready.onAllReady;
    expect(catalog.isLayersReady()).to.equal(true);
  });

  it("loads generated metadata into each supplied catalog", async () => {
    const { reader: catalog, writer }: CatalogHandles = createCatalog();

    const loaded = await loadAllMetadata(writer);
    await catalog.ready.onAllReady;

    expect(Object.keys(loaded.itemMetadata).length).to.be.greaterThan(0);
    expect(catalog.isIndexReady()).to.equal(true);
    expect(catalog.isLiteReady()).to.equal(true);
    expect(catalog.isCreditsReady()).to.equal(true);
    expect(catalog.isPaletteReady()).to.equal(true);
    expect(catalog.isLayersReady()).to.equal(true);

    const second: CatalogHandles = createCatalog();
    await loadAllMetadata(second.writer);
    await second.reader.ready.onAllReady;
    expect(second.reader.isLiteReady()).to.equal(true);
  });
});

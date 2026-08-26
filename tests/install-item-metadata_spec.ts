import { expect } from "chai";
import { describe, it } from "mocha-globals";
import {
  CATALOG_CHUNK_MEASURE_NAMES,
  CATALOG_LOAD_MEASURE,
  createLoadedCatalog,
  installCatalogReadinessHooksForVisualTooling,
  loadAllMetadata,
} from "../sources/install-item-metadata.ts";
import {
  createCatalog,
  type AliasMetadata,
  type CatalogHandles,
  type CatalogReader,
} from "../sources/state/catalog.ts";

function measureCount(name: string): number {
  return performance.getEntriesByName(name, "measure").length;
}

function isStillPending(p: Promise<void>): Promise<boolean> {
  let settled = false;
  void p.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  return Promise.resolve().then(() => !settled);
}

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

  it("records catalog-load and catalog-chunk User Timing measures", async () => {
    performance.clearMarks();
    performance.clearMeasures();

    const first: CatalogHandles = createCatalog();
    await loadAllMetadata(first.writer);
    await first.reader.ready.onAllReady;

    expect(measureCount(CATALOG_LOAD_MEASURE)).to.be.at.least(1);
    for (const name of CATALOG_CHUNK_MEASURE_NAMES) {
      expect(measureCount(name)).to.be.at.least(1);
    }

    const second: CatalogHandles = createCatalog();
    await loadAllMetadata(second.writer);
    await second.reader.ready.onAllReady;
    expect(measureCount(CATALOG_LOAD_MEASURE)).to.be.at.least(2);
    for (const name of CATALOG_CHUNK_MEASURE_NAMES) {
      expect(measureCount(name)).to.be.at.least(2);
    }
  });

  it("installs index, lite, and all-ready hooks on the catalog", async () => {
    const { reader, writer }: CatalogHandles = createCatalog();
    installCatalogReadinessHooksForVisualTooling(reader);

    expect(typeof window.__LPC_waitCatalogIndexReady).to.equal("function");
    expect(typeof window.__LPC_waitCatalogLiteReady).to.equal("function");
    expect(typeof window.__LPC_waitCatalogAllReady).to.equal("function");

    const indexReady = window.__LPC_waitCatalogIndexReady!();
    const liteReady = window.__LPC_waitCatalogLiteReady!();
    const allReady = window.__LPC_waitCatalogAllReady!();

    writer.registerIndexMetadata({
      aliasMetadata: {} as AliasMetadata,
      categoryTree: { items: [], children: {} },
      metadataIndexes: { byTypeName: {}, hashMatch: {} },
    });
    await indexReady;
    expect(reader.isIndexReady()).to.equal(true);
    expect(await isStillPending(liteReady)).to.equal(true);
    expect(await isStillPending(allReady)).to.equal(true);

    writer.registerItemMetadata({});
    await liteReady;
    expect(reader.isLiteReady()).to.equal(true);
    expect(await isStillPending(allReady)).to.equal(true);

    writer.registerCreditsMetadata({});
    writer.registerPaletteMetadata({ versions: {}, materials: {} });
    writer.registerLayersMetadata({});
    await allReady;
    expect(reader.isCreditsReady()).to.equal(true);
    expect(reader.isPaletteReady()).to.equal(true);
    expect(reader.isLayersReady()).to.equal(true);

    installCatalogReadinessHooksForVisualTooling(reader);
    await window.__LPC_waitCatalogIndexReady!();
    await window.__LPC_waitCatalogLiteReady!();
    await window.__LPC_waitCatalogAllReady!();
  });
});

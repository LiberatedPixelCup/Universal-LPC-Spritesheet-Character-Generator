/**
 * Central catalog module — state, registration, and the typed Result-returning
 * consumer API in one place.
 *
 * Loaders call the matching `register*Metadata` method after each dynamic import; consumers use
 * the typed getters (returning `Result<T, LoadError>` from neverthrow) and
 * either `isXReady()` (sync) or `catalog.ready.onXReady` (async) for readiness
 * signals.
 *
 * Every getter returns `Result<T, LoadError>`:
 *   - `Ok(value)` when the chunk is registered and the id resolves.
 *   - `Err({ kind: "loading" })` when the chunk has not registered yet.
 *   - `Err({ kind: "not-found" })` when the chunk is registered but the id is absent.
 *
 * Dynamic-import failures intentionally crash today (no `Err` variant): the
 * chunk loading machinery in `install-item-metadata.ts` propagates the
 * rejection. If we ever need to recover instead of crash, add a `"load-failed"`
 * variant here.
 *
 * Consumer-side code pairs this with the `renderResult` helper (in the render
 * tree) or with `.match` / `.unwrapOr` / `if (r.isErr())` (everywhere else).
 *
 * `createCatalog()` constructs independent reader/writer capability pairs.
 * Application code receives the reader; metadata installers and fixtures hold
 * the writer only while registering data into the paired private stores.
 */

import { ok, err, type Result } from "neverthrow";
import {
  buildItemsByTypeNameLite,
  expandInternedItemLite,
  expandMetadataIndexesWithInternedArrays,
  hasInternedPalettes,
  isInternedItemLite,
} from "./resolve-hash-param.ts";

// ────────────────────────────────────────────────────────────────────────────
// Error shape
// ────────────────────────────────────────────────────────────────────────────

export type ChunkName = "index" | "lite" | "credits" | "palette" | "layers";

export type LoadError =
  { kind: "loading"; chunk: ChunkName } | { kind: "not-found"; id: string };

/** Human-readable description of a catalog `LoadError`. Shared formatter for
 *  every getter that returns `Result<T, LoadError>`. Exhaustive over `kind`. */
export function formatLoadError(e: LoadError): string {
  switch (e.kind) {
    case "loading":
      return `chunk "${e.chunk}" not loaded`;
    case "not-found":
      return `item ${e.id} not in catalog`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Catalog data shapes (audited from real consumer usage)
// ────────────────────────────────────────────────────────────────────────────

/** Shared by `PaletteRecolor.palettes` and `PaletteMaterialMeta.palettes`. */
export type PaletteMap = Record<string, Record<string, string[]>>;

export type PaletteRecolor = {
  material: string;
  palettes: PaletteMap;
  // Vary per recolor — only the first recolor in an item has a type_name
  // when it represents the item itself; subsequent recolors target sub-types.
  type_name?: string;
  variants?: string[];
  label?: string;
  matchBodyColor?: boolean;
  base?: string;
  source?: string[];
  default?: string;
};

export type ItemLite = {
  name: string;
  type_name: string;
  required: string[];
  animations: string[];
  recolors: PaletteRecolor[];
  matchBodyColor: boolean;
  variants: string[];
  path: string[];
  preview_row?: number;
};

export type Credit = {
  file: string;
  authors: string[];
  licenses: string[];
  urls: string[];
  notes?: string;
};

/**
 * A single `meta.layers[layer_N]` entry. Heterogeneous: known metadata fields
 * (`zPos`, `custom_animation`) plus body-type-keyed asset paths. Modeled as
 * an open shape because the body-type keys are dynamic.
 */
export type LayerEntry = {
  zPos?: number;
  custom_animation?: string;
  [bodyTypeOrField: string]: string | number | undefined;
};

export type ItemMerged = ItemLite & {
  layers: Record<string, LayerEntry>;
  credits: Credit[];
};

export type AliasEntry = {
  typeName: string;
  name: string;
  variant: string;
};

/** Outer key: source typeName. Inner key: `name_variant`. */
export type AliasMetadata = Record<string, Record<string, AliasEntry>>;

export type CategoryTreeNode = {
  items?: string[];
  children?: Record<string, CategoryTreeNode>;
};

export type CategoryTree = CategoryTreeNode;

/**
 * Slim row shape stored in `MetadataIndexes.byTypeName[typeName]` and
 * `hashMatch.itemsByTypeName[typeName]`. Documented in `resolve-hash-param.ts`:
 * just enough fields for hash-resolution and path-name lookups; the full
 * record lives in the lite item store.
 */
export type SlimByTypeNameRow = {
  itemId: string;
  name: string;
  type_name: string;
  variants: string[];
  recolors: { variants: string[] }[];
};

export type MetadataIndexes = {
  byTypeName: Record<string, SlimByTypeNameRow[]>;
  hashMatch: { itemsByTypeName?: Record<string, SlimByTypeNameRow[]> };
  // Only emitted when the build interned variant / palette tables — production
  // `index-metadata.js` includes them; in-memory test fixtures usually don't.
  variantArrays?: string[][];
  recolorVariantArrays?: string[][];
  paletteArrays?: PaletteMap[];
};

export type PaletteMaterialMeta = {
  palettes: PaletteMap;
  type: "material";
  label: string;
  desc: string;
  default: string;
  base: string;
};

export type PaletteVersionMeta = {
  type: "version";
  label: string;
  desc: string;
};

export type PaletteMetadata = {
  materials: Record<string, PaletteMaterialMeta>;
  // Production data always has versions, but several test fixtures provide
  // a minimal `{ materials: {...} }` without versions; keep optional for them.
  versions?: Record<string, PaletteVersionMeta>;
};

// ────────────────────────────────────────────────────────────────────────────
// Catalog interface — split into reader + writer halves
// ────────────────────────────────────────────────────────────────────────────

export type CatalogReady = {
  readonly onIndexReady: Promise<void>;
  readonly onLiteReady: Promise<void>;
  readonly onCreditsReady: Promise<void>;
  readonly onPaletteReady: Promise<void>;
  readonly onLayersReady: Promise<void>;
  readonly onAllReady: Promise<void>;
};

/** Read-only surface — what components and downstream factories should consume. */
export type CatalogReader = {
  chunkReady(chunk: ChunkName): Result<true, LoadError>;
  getItemLite(id: string): Result<ItemLite, LoadError>;
  getItemMerged(id: string): Result<ItemMerged, LoadError>;
  getItemCredits(id: string): Result<Credit[], LoadError>;
  getItemLayers(id: string): Result<Record<string, LayerEntry>, LoadError>;
  getPaletteMetadata(): Result<PaletteMetadata, LoadError>;
  getCategoryTree(): Result<CategoryTree, LoadError>;
  getMetadataIndexes(): Result<MetadataIndexes, LoadError>;
  getAliasMetadata(): Result<AliasMetadata, LoadError>;
  isIndexReady(): boolean;
  isLiteReady(): boolean;
  isCreditsReady(): boolean;
  isPaletteReady(): boolean;
  isLayersReady(): boolean;
  buildItemsByTypeNameFromRegisteredLite(): Record<string, SlimByTypeNameRow[]>;
  readonly ready: CatalogReady;
};

/** Write-only surface — only metadata installation and fixture setup hold it. */
export type CatalogWriter = {
  registerIndexMetadata(metadata: {
    aliasMetadata: AliasMetadata;
    categoryTree: CategoryTree;
    metadataIndexes: MetadataIndexes;
  }): void;
  registerPaletteMetadata(paletteMetadata: PaletteMetadata): void;
  registerItemMetadata(itemMetadata: Record<string, ItemLite>): void;
  registerCreditsMetadata(itemCredits: Record<string, Credit[]>): void;
  registerLayersMetadata(
    itemLayers: Record<string, Record<string, LayerEntry>>,
  ): void;
  loadCatalogFromFixtures(fixtureGlobals: {
    itemMetadata: Record<string, unknown>;
    aliasMetadata: AliasMetadata;
    categoryTree: CategoryTree;
    metadataIndexes: MetadataIndexes;
    paletteMetadata: PaletteMetadata;
  }): void;
};

export type CatalogHandles = {
  /** Runtime object containing no writer methods. */
  reader: CatalogReader;
  /** Runtime object containing no reader methods. */
  writer: CatalogWriter;
};

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers — pure, outside the factory
// ────────────────────────────────────────────────────────────────────────────

type Stage = {
  promise: Promise<void>;
  resolved: boolean;
  resolve: () => void;
};

function makeStage(): Stage {
  let resolveFn: (() => void) | undefined;
  const promise = new Promise<void>((r) => {
    resolveFn = r;
  });
  const stage: Stage = {
    promise,
    resolved: false,
    resolve: () => {
      stage.resolved = true;
      resolveFn?.();
    },
  };
  return stage;
}

function splitFullItemMetadataForCatalog(
  fullItemMetadata: Record<string, unknown>,
): {
  itemMetadataLite: Record<string, ItemLite>;
  itemCredits: Record<string, Credit[]>;
  itemLayers: Record<string, Record<string, LayerEntry>>;
} {
  const itemMetadataLite: Record<string, ItemLite> = {};
  const itemCredits: Record<string, Credit[]> = {};
  const itemLayers: Record<string, Record<string, LayerEntry>> = {};

  for (const [itemId, meta] of Object.entries(fullItemMetadata)) {
    const { layers, credits, ...lite } = meta as {
      layers?: Record<string, LayerEntry>;
      credits?: Credit[];
    } & Omit<ItemLite, "layers" | "credits">;
    itemMetadataLite[itemId] = lite as ItemLite;
    itemCredits[itemId] = credits ?? [];
    itemLayers[itemId] = layers ?? {};
  }
  return { itemMetadataLite, itemCredits, itemLayers };
}

const loading = (chunk: ChunkName): LoadError => ({ kind: "loading", chunk });
const notFound = (id: string): LoadError => ({ kind: "not-found", id });

// ────────────────────────────────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────────────────────────────────

export function createCatalog(): CatalogHandles {
  // Both capabilities close over these stores, but neither exposes the other.
  const indexStage = makeStage();
  const liteStage = makeStage();
  const creditsStage = makeStage();
  const paletteStage = makeStage();
  const layersStage = makeStage();

  let aliasMetadataStore: AliasMetadata | null = null;
  let categoryTreeStore: CategoryTree | null = null;
  let metadataIndexesStore: MetadataIndexes | null = null;
  let itemLiteStore: Record<string, ItemLite> | null = null;
  let itemCreditsStore: Record<string, Credit[]> | null = null;
  let itemLayersStore: Record<string, Record<string, LayerEntry>> | null = null;
  let paletteMetadataStore: PaletteMetadata | null = null;

  /**
   * Fills `variants`, `recolors[0].variants`, and per-recolor `palettes` from
   * `metadataIndexesStore` when the lite chunk was interned (`v` / `r` / `p`;
   * shared tables live only in `index-metadata.js`). Palette restore is
   * independent of variant intern.
   */
  function expandInternedItemLitesInStore(): void {
    if (itemLiteStore === null || metadataIndexesStore === null) return;
    const { variantArrays, recolorVariantArrays, paletteArrays } =
      metadataIndexesStore;
    for (const itemId of Object.keys(itemLiteStore)) {
      const cur = itemLiteStore[itemId];
      if (!isInternedItemLite(cur) && !hasInternedPalettes(cur)) continue;
      itemLiteStore[itemId] = expandInternedItemLite(
        cur,
        variantArrays,
        recolorVariantArrays,
        paletteArrays,
      ) as ItemLite;
    }
  }

  const ready: CatalogReady = {
    get onIndexReady() {
      return indexStage.promise;
    },
    get onLiteReady() {
      return liteStage.promise;
    },
    get onCreditsReady() {
      return creditsStage.promise;
    },
    get onPaletteReady() {
      return paletteStage.promise;
    },
    get onLayersReady() {
      return layersStage.promise;
    },
    get onAllReady() {
      return Promise.all([
        indexStage.promise,
        liteStage.promise,
        creditsStage.promise,
        paletteStage.promise,
        layersStage.promise,
      ]).then(() => {});
    },
  };

  const reader: CatalogReader = {
    ready,

    // readiness predicates
    isIndexReady: () => indexStage.resolved,
    isLiteReady: () => liteStage.resolved,
    isCreditsReady: () => creditsStage.resolved,
    isPaletteReady: () => paletteStage.resolved,
    isLayersReady: () => layersStage.resolved,

    chunkReady(chunk) {
      const stage = (
        {
          index: indexStage,
          lite: liteStage,
          credits: creditsStage,
          palette: paletteStage,
          layers: layersStage,
        } as const
      )[chunk];
      return stage.resolved ? ok(true as const) : err(loading(chunk));
    },

    // result-returning getters
    getItemLite(id) {
      if (!liteStage.resolved) return err(loading("lite"));
      const item = itemLiteStore?.[id];
      return item ? ok(item) : err(notFound(id));
    },

    getItemMerged(id) {
      if (!liteStage.resolved) return err(loading("lite"));
      const lite = itemLiteStore?.[id];
      if (!lite) return err(notFound(id));
      const layers = layersStage.resolved ? (itemLayersStore?.[id] ?? {}) : {};
      const credits = creditsStage.resolved
        ? (itemCreditsStore?.[id] ?? [])
        : [];
      return ok({ ...lite, layers, credits });
    },

    getItemCredits(id) {
      if (!creditsStage.resolved) return err(loading("credits"));
      const credits = itemCreditsStore?.[id];
      return credits ? ok(credits) : err(notFound(id));
    },

    getItemLayers(id) {
      if (!layersStage.resolved) return err(loading("layers"));
      const layers = itemLayersStore?.[id];
      return layers ? ok(layers) : err(notFound(id));
    },

    getPaletteMetadata() {
      if (!paletteStage.resolved) return err(loading("palette"));
      // Non-null by construction: registerPaletteMetadata sets the store
      // before resolving the stage.
      return ok(paletteMetadataStore!);
    },

    getCategoryTree() {
      if (!indexStage.resolved) return err(loading("index"));
      return ok(categoryTreeStore!);
    },

    getMetadataIndexes() {
      if (!indexStage.resolved) return err(loading("index"));
      return ok(metadataIndexesStore!);
    },

    getAliasMetadata() {
      if (!indexStage.resolved) return err(loading("index"));
      return ok(aliasMetadataStore!);
    },

    /**
     * `byTypeName` for hash resolution when the index module is not registered
     * yet. Rows match `buildSlimByTypeNameRow` (itemId, name, type_name,
     * variants, recolors minimal array).
     */
    buildItemsByTypeNameFromRegisteredLite() {
      if (!itemLiteStore) return {};
      const synthetic: Record<string, ItemMerged> = {};
      for (const [id, lite] of Object.entries(itemLiteStore)) {
        synthetic[id] = { ...lite, layers: {}, credits: [] };
      }
      return buildItemsByTypeNameLite(synthetic) as Record<
        string,
        SlimByTypeNameRow[]
      >;
    },
  };

  function registerIndexMetadata(metadata: {
    aliasMetadata: AliasMetadata;
    categoryTree: CategoryTree;
    metadataIndexes: MetadataIndexes;
  }): void {
    aliasMetadataStore = metadata.aliasMetadata;
    categoryTreeStore = metadata.categoryTree;
    metadataIndexesStore = expandMetadataIndexesWithInternedArrays(
      metadata.metadataIndexes,
    ) as MetadataIndexes;
    indexStage.resolve();
    expandInternedItemLitesInStore();
  }

  function registerPaletteMetadata(paletteMetadata: PaletteMetadata): void {
    paletteMetadataStore = paletteMetadata;
    paletteStage.resolve();
  }

  function registerItemMetadata(itemMetadata: Record<string, ItemLite>): void {
    itemLiteStore = itemMetadata;
    expandInternedItemLitesInStore();
    liteStage.resolve();
  }

  function registerCreditsMetadata(
    itemCredits: Record<string, Credit[]>,
  ): void {
    itemCreditsStore = itemCredits;
    creditsStage.resolve();
  }

  function registerLayersMetadata(
    itemLayers: Record<string, Record<string, LayerEntry>>,
  ): void {
    itemLayersStore = itemLayers;
    layersStage.resolve();
  }

  const writer: CatalogWriter = {
    registerIndexMetadata,
    registerPaletteMetadata,
    registerItemMetadata,
    registerCreditsMetadata,
    registerLayersMetadata,

    /**
     * Loads the catalog from `extractMetadataGlobalsFromWrites` / `runBuild`
     * `.globals` (merged `itemMetadata` is split into lite, credits, layers).
     */
    loadCatalogFromFixtures(fixtureGlobals) {
      const {
        itemMetadata,
        aliasMetadata,
        categoryTree,
        metadataIndexes,
        paletteMetadata,
      } = fixtureGlobals;
      registerIndexMetadata({ aliasMetadata, categoryTree, metadataIndexes });
      registerPaletteMetadata(paletteMetadata);
      const { itemMetadataLite, itemCredits, itemLayers } =
        splitFullItemMetadataForCatalog(itemMetadata);
      registerItemMetadata(itemMetadataLite);
      registerCreditsMetadata(itemCredits);
      registerLayersMetadata(itemLayers);
    },
  };

  return { reader, writer };
}

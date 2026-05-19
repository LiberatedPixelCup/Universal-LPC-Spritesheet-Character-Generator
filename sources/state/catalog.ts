/**
 * Central catalog module — state, registration, and the typed Result-returning
 * consumer API in one place.
 *
 * Loaders call `registerFromXModule` after each dynamic import; consumers use
 * the typed getters (returning `Result<T, LoadError>` from neverthrow) and
 * either `isXReady()` (sync) or `catalogReady.onXReady` (async) for readiness
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
 * Catalog DI migration:
 *   - `createCatalog()` is the factory used by `main.ts` and by tests that
 *     want an isolated instance.
 *   - `defaultCatalog` is a module-level instance — the same shared state we
 *     had before the factory, just encapsulated. Legacy free-function exports
 *     delegate to it; they're thin wrappers preserved for incremental
 *     migration and get removed in the final cleanup phase.
 */

import { ok, err, type Result } from "neverthrow";
import {
  buildItemsByTypeNameLite,
  expandInternedItemLite,
  expandMetadataIndexesWithInternedArrays,
  isInternedItemLite,
} from "./resolve-hash-param.ts";

// ────────────────────────────────────────────────────────────────────────────
// Error shape
// ────────────────────────────────────────────────────────────────────────────

export type ChunkName = "index" | "lite" | "credits" | "palette" | "layers";

export type LoadError =
  | { kind: "loading"; chunk: ChunkName }
  | { kind: "not-found"; id: string };

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
  // Only emitted when the build interned variant indices — production
  // `index-metadata.js` includes them; in-memory test fixtures usually don't.
  variantArrays?: string[][];
  recolorVariantArrays?: string[][];
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

/** Write-only surface — only the boot path (`install-item-metadata.ts`) and
 *  test setup should hold this. */
export type CatalogWriter = {
  registerFromIndexModule(exports_: {
    aliasMetadata: AliasMetadata;
    categoryTree: CategoryTree;
    metadataIndexes: MetadataIndexes;
  }): void;
  registerFromPaletteModule(exports_: {
    paletteMetadata: PaletteMetadata;
  }): void;
  registerFromItemModule(exports_: {
    itemMetadata: Record<string, ItemLite>;
  }): void;
  registerFromCreditsModule(exports_: {
    itemCredits: Record<string, Credit[]>;
  }): void;
  registerFromLayersModule(exports_: {
    itemLayers: Record<string, Record<string, LayerEntry>>;
  }): void;
  loadCatalogFromFixtures(fixtureGlobals: {
    itemMetadata: Record<string, unknown>;
    aliasMetadata: AliasMetadata;
    categoryTree: CategoryTree;
    metadataIndexes: MetadataIndexes;
    paletteMetadata: PaletteMetadata;
  }): void;
  resetForTests(): void;
};

export type Catalog = CatalogReader & CatalogWriter;

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

export function createCatalog(): Catalog {
  // All stage trackers and stores live in this closure — unreachable from
  // outside the factory. Mutation only happens through the registrar methods
  // returned below.
  let indexStage = makeStage();
  let liteStage = makeStage();
  let creditsStage = makeStage();
  let paletteStage = makeStage();
  let layersStage = makeStage();

  let aliasMetadataStore: AliasMetadata | null = null;
  let categoryTreeStore: CategoryTree | null = null;
  let metadataIndexesStore: MetadataIndexes | null = null;
  let itemLiteStore: Record<string, ItemLite> | null = null;
  let itemCreditsStore: Record<string, Credit[]> | null = null;
  let itemLayersStore: Record<string, Record<string, LayerEntry>> | null = null;
  let paletteMetadataStore: PaletteMetadata | null = null;

  /**
   * Fills `variants` and `recolors[0].variants` from `metadataIndexesStore`
   * when the lite chunk was emitted with interned `v` / `r` (shared tables
   * live only in `index-metadata.js`).
   */
  function expandInternedItemLitesInStore(): void {
    if (itemLiteStore === null || metadataIndexesStore === null) return;
    const { variantArrays, recolorVariantArrays } = metadataIndexesStore;
    if (!Array.isArray(variantArrays) || !Array.isArray(recolorVariantArrays)) {
      return;
    }
    for (const itemId of Object.keys(itemLiteStore)) {
      const cur = itemLiteStore[itemId];
      if (isInternedItemLite(cur)) {
        itemLiteStore[itemId] = expandInternedItemLite(
          cur,
          variantArrays,
          recolorVariantArrays,
        ) as ItemLite;
      }
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

  return {
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
      // Non-null by construction: registerFromPaletteModule sets the store
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

    // writer — only `install-item-metadata.ts` and test setup should call these
    registerFromIndexModule(exports_) {
      aliasMetadataStore = exports_.aliasMetadata;
      categoryTreeStore = exports_.categoryTree;
      metadataIndexesStore = expandMetadataIndexesWithInternedArrays(
        exports_.metadataIndexes,
      ) as MetadataIndexes;
      indexStage.resolve();
      expandInternedItemLitesInStore();
    },

    registerFromPaletteModule(exports_) {
      paletteMetadataStore = exports_.paletteMetadata;
      paletteStage.resolve();
    },

    registerFromItemModule(exports_) {
      itemLiteStore = exports_.itemMetadata;
      expandInternedItemLitesInStore();
      liteStage.resolve();
    },

    registerFromCreditsModule(exports_) {
      itemCreditsStore = exports_.itemCredits;
      creditsStage.resolve();
    },

    registerFromLayersModule(exports_) {
      itemLayersStore = exports_.itemLayers;
      layersStage.resolve();
    },

    /**
     * Loads the catalog from `extractMetadataGlobalsFromWrites` / `runBuild`
     * `.globals` (merged `itemMetadata` is split into lite, credits, layers).
     */
    loadCatalogFromFixtures(fixtureGlobals) {
      this.resetForTests();
      const {
        itemMetadata,
        aliasMetadata,
        categoryTree,
        metadataIndexes,
        paletteMetadata,
      } = fixtureGlobals;
      this.registerFromIndexModule({
        aliasMetadata,
        categoryTree,
        metadataIndexes,
      });
      this.registerFromPaletteModule({ paletteMetadata });
      const { itemMetadataLite, itemCredits, itemLayers } =
        splitFullItemMetadataForCatalog(itemMetadata);
      this.registerFromItemModule({ itemMetadata: itemMetadataLite });
      this.registerFromCreditsModule({ itemCredits });
      this.registerFromLayersModule({ itemLayers });
    },

    /**
     * Reset to a fresh empty state. Used by tests that share `defaultCatalog`
     * across cases. Tests can also construct a brand-new `createCatalog()` to
     * sidestep this entirely.
     */
    resetForTests() {
      indexStage = makeStage();
      liteStage = makeStage();
      creditsStage = makeStage();
      paletteStage = makeStage();
      layersStage = makeStage();

      aliasMetadataStore = null;
      categoryTreeStore = null;
      metadataIndexesStore = null;
      itemLiteStore = null;
      itemCreditsStore = null;
      itemLayersStore = null;
      paletteMetadataStore = null;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Default instance + legacy free-function exports (transitional)
// ────────────────────────────────────────────────────────────────────────────
//
// All exports below preserve the pre-factory module surface for incremental
// migration. They delegate to a single shared `defaultCatalog`. Phase Final
// of the migration deletes everything between these comment fences; main.ts
// will own the only `createCatalog()` instance at that point.

export const defaultCatalog: Catalog = createCatalog();

export const catalogReady = defaultCatalog.ready;

export const isIndexReady = (): boolean => defaultCatalog.isIndexReady();
export const isLiteReady = (): boolean => defaultCatalog.isLiteReady();
export const isCreditsReady = (): boolean => defaultCatalog.isCreditsReady();
export const isPaletteReady = (): boolean => defaultCatalog.isPaletteReady();
export const isLayersReady = (): boolean => defaultCatalog.isLayersReady();

export const chunkReady = (chunk: ChunkName): Result<true, LoadError> =>
  defaultCatalog.chunkReady(chunk);

export const getItemLite = (id: string): Result<ItemLite, LoadError> =>
  defaultCatalog.getItemLite(id);

export const getItemMerged = (id: string): Result<ItemMerged, LoadError> =>
  defaultCatalog.getItemMerged(id);

export const getItemCredits = (id: string): Result<Credit[], LoadError> =>
  defaultCatalog.getItemCredits(id);

export const getItemLayers = (
  id: string,
): Result<Record<string, LayerEntry>, LoadError> =>
  defaultCatalog.getItemLayers(id);

export const getPaletteMetadata = (): Result<PaletteMetadata, LoadError> =>
  defaultCatalog.getPaletteMetadata();

export const getCategoryTree = (): Result<CategoryTree, LoadError> =>
  defaultCatalog.getCategoryTree();

export const getMetadataIndexes = (): Result<MetadataIndexes, LoadError> =>
  defaultCatalog.getMetadataIndexes();

export const getAliasMetadata = (): Result<AliasMetadata, LoadError> =>
  defaultCatalog.getAliasMetadata();

export const buildItemsByTypeNameFromRegisteredLite = (): Record<
  string,
  SlimByTypeNameRow[]
> => defaultCatalog.buildItemsByTypeNameFromRegisteredLite();

export const registerFromIndexModule = (exports_: {
  aliasMetadata: AliasMetadata;
  categoryTree: CategoryTree;
  metadataIndexes: MetadataIndexes;
}): void => defaultCatalog.registerFromIndexModule(exports_);

export const registerFromPaletteModule = (exports_: {
  paletteMetadata: PaletteMetadata;
}): void => defaultCatalog.registerFromPaletteModule(exports_);

export const registerFromItemModule = (exports_: {
  itemMetadata: Record<string, ItemLite>;
}): void => defaultCatalog.registerFromItemModule(exports_);

export const registerFromCreditsModule = (exports_: {
  itemCredits: Record<string, Credit[]>;
}): void => defaultCatalog.registerFromCreditsModule(exports_);

export const registerFromLayersModule = (exports_: {
  itemLayers: Record<string, Record<string, LayerEntry>>;
}): void => defaultCatalog.registerFromLayersModule(exports_);

export const loadCatalogFromFixtures = (fixtureGlobals: {
  itemMetadata: Record<string, unknown>;
  aliasMetadata: AliasMetadata;
  categoryTree: CategoryTree;
  metadataIndexes: MetadataIndexes;
  paletteMetadata: PaletteMetadata;
}): void => defaultCatalog.loadCatalogFromFixtures(fixtureGlobals);

// TODO (Catalog DI migration): once every consumer migrates to receive
// `catalog: CatalogReader` via DI, drop this — tests will construct a fresh
// `createCatalog()` per case instead of resetting a shared one.
export const resetCatalogForTests = (): void => defaultCatalog.resetForTests();

// ────────────────────────────────────────────────────────────────────────────
// Boot-time globalThis shims (Playwright, Argos, dump-computed-styles)
// ────────────────────────────────────────────────────────────────────────────

if (typeof globalThis !== "undefined") {
  /**
   * Playwright, Argos, and `dump-computed-styles` (production / vite preview).
   * Inlined here so the assignment is not tree-shaken.
   */
  (
    globalThis as unknown as { __LPC_waitCatalogAllReady: () => Promise<void> }
  ).__LPC_waitCatalogAllReady = async () => {
    await defaultCatalog.ready.onAllReady;
  };
  /**
   * Same gates as `PaletteSelectModal` (split metadata: palette + layers must
   * be present). Used when a stale preview build omits `__LPC_waitCatalogAllReady`
   * so we do not treat "shell un-spinner" as sufficient — otherwise the
   * skintone modal stays on "Loading layer data…" and `data-previews-ready`
   * never flips to true.
   */
  (
    globalThis as unknown as {
      __LPC_arePaletteModalMetadataChunksReady: () => boolean;
    }
  ).__LPC_arePaletteModalMetadataChunksReady = () =>
    defaultCatalog.isIndexReady() &&
    defaultCatalog.isLiteReady() &&
    defaultCatalog.isCreditsReady() &&
    defaultCatalog.isPaletteReady() &&
    defaultCatalog.isLayersReady();
}

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
// Internal: stage + store state
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

// ────────────────────────────────────────────────────────────────────────────
// Public: catalogReady promises + isXReady predicates
// ────────────────────────────────────────────────────────────────────────────

/**
 * Promises that settle once when the corresponding chunk registers (idempotent
 * per stage). After `resetCatalogForTests()`, use these getters again for
 * fresh promises.
 */
export const catalogReady = {
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

/**
 * Synchronous readiness predicates (mirrors `catalogReady` but without
 * awaiting). Useful in render paths and event handlers where you need a
 * boolean without subscribing to a promise.
 */
export const isIndexReady = (): boolean => indexStage.resolved;
export const isLiteReady = (): boolean => liteStage.resolved;
export const isCreditsReady = (): boolean => creditsStage.resolved;
export const isPaletteReady = (): boolean => paletteStage.resolved;
export const isLayersReady = (): boolean => layersStage.resolved;

// ────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────────

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

/**
 * Fills `variants` and `recolors[0].variants` from `metadataIndexesStore` when
 * the lite chunk was emitted with interned `v` / `r` (shared tables live only
 * in `index-metadata.js`).
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

// ────────────────────────────────────────────────────────────────────────────
// Public: registers (called by `install-item-metadata.ts` after each chunk's
// dynamic import resolves)
// ────────────────────────────────────────────────────────────────────────────

export function registerFromIndexModule(exports_: {
  aliasMetadata: AliasMetadata;
  categoryTree: CategoryTree;
  metadataIndexes: MetadataIndexes;
}): void {
  aliasMetadataStore = exports_.aliasMetadata;
  categoryTreeStore = exports_.categoryTree;
  metadataIndexesStore = expandMetadataIndexesWithInternedArrays(
    exports_.metadataIndexes,
  ) as MetadataIndexes;
  indexStage.resolve();
  expandInternedItemLitesInStore();
}

export function registerFromPaletteModule(exports_: {
  paletteMetadata: PaletteMetadata;
}): void {
  paletteMetadataStore = exports_.paletteMetadata;
  paletteStage.resolve();
}

export function registerFromItemModule(exports_: {
  itemMetadata: Record<string, ItemLite>;
}): void {
  itemLiteStore = exports_.itemMetadata;
  expandInternedItemLitesInStore();
  liteStage.resolve();
}

export function registerFromCreditsModule(exports_: {
  itemCredits: Record<string, Credit[]>;
}): void {
  itemCreditsStore = exports_.itemCredits;
  creditsStage.resolve();
}

export function registerFromLayersModule(exports_: {
  itemLayers: Record<string, Record<string, LayerEntry>>;
}): void {
  itemLayersStore = exports_.itemLayers;
  layersStage.resolve();
}

// ────────────────────────────────────────────────────────────────────────────
// Public: hash-resolution helper
// ────────────────────────────────────────────────────────────────────────────

/**
 * `byTypeName` for hash resolution when the index module is not registered yet.
 * Rows match `buildSlimByTypeNameRow` (itemId, name, type_name, variants,
 * recolors minimal array).
 */
export function buildItemsByTypeNameFromRegisteredLite(): Record<
  string,
  SlimByTypeNameRow[]
> {
  if (!itemLiteStore) return {};
  const synthetic: Record<string, ItemMerged> = {};
  for (const [id, lite] of Object.entries(itemLiteStore)) {
    synthetic[id] = { ...lite, layers: {}, credits: [] };
  }
  return buildItemsByTypeNameLite(synthetic) as Record<
    string,
    SlimByTypeNameRow[]
  >;
}

// ────────────────────────────────────────────────────────────────────────────
// Public: test utilities
// ────────────────────────────────────────────────────────────────────────────

/**
 * Loads the catalog from `extractMetadataGlobalsFromWrites` / `runBuild`
 * `.globals` (merged `itemMetadata` is split into lite, credits, and layers).
 */
export function loadCatalogFromFixtures(fixtureGlobals: {
  itemMetadata: Record<string, unknown>;
  aliasMetadata: AliasMetadata;
  categoryTree: CategoryTree;
  metadataIndexes: MetadataIndexes;
  paletteMetadata: PaletteMetadata;
}): void {
  resetCatalogForTests();
  const {
    itemMetadata,
    aliasMetadata,
    categoryTree,
    metadataIndexes,
    paletteMetadata,
  } = fixtureGlobals;
  registerFromIndexModule({ aliasMetadata, categoryTree, metadataIndexes });
  registerFromPaletteModule({ paletteMetadata });
  const { itemMetadataLite, itemCredits, itemLayers } =
    splitFullItemMetadataForCatalog(itemMetadata);
  registerFromItemModule({ itemMetadata: itemMetadataLite });
  registerFromCreditsModule({ itemCredits });
  registerFromLayersModule({ itemLayers });
}

// TODO: Replace module-level singletons with a `createCatalog()` factory + DI.
// This reset exists only because catalog state lives at module scope; tests
// have to scrub it between cases. With a factory, each test would construct
// its own instance, consumers would receive the catalog via context (e.g. a
// Mithril provider component or `state.catalog`) instead of importing it
// directly, and this function would disappear. Defer until after the
// Result-API migration lands so the consumer surface is already typed.
export function resetCatalogForTests(): void {
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
}

// ────────────────────────────────────────────────────────────────────────────
// Public: Result-returning getters
// ────────────────────────────────────────────────────────────────────────────

const loading = (chunk: ChunkName): LoadError => ({ kind: "loading", chunk });
const notFound = (id: string): LoadError => ({ kind: "not-found", id });

/**
 * Boundary primitive: returns `Ok(true)` once the named chunk has registered,
 * `Err({kind: "loading"})` otherwise. Use with `Result.combine` to gate a
 * subtree on a chunk that has no consumer-facing data getter (e.g. layers).
 */
export function chunkReady(chunk: ChunkName): Result<true, LoadError> {
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
}

export function getItemLite(id: string): Result<ItemLite, LoadError> {
  if (!liteStage.resolved) return err(loading("lite"));
  const item = itemLiteStore?.[id];
  return item ? ok(item) : err(notFound(id));
}

/**
 * "Best-effort" merge: returns Ok as soon as the lite chunk is ready, with
 * `layers` and `credits` defaulting to `{}` / `[]` when their chunks have not
 * loaded yet. This is intentional — it lets the UI render item names + tree
 * structure during the initial load while layers/credits stream in.
 *
 * Consumers that need to distinguish "loading" from "actually empty" should
 * use `getItemCredits` / `getItemLayers` directly (those are strict and
 * return `Err({kind:"loading"})` until their chunk lands), or compose via
 * `Result.combine` to wait on every needed chunk.
 */
export function getItemMerged(id: string): Result<ItemMerged, LoadError> {
  if (!liteStage.resolved) return err(loading("lite"));
  const lite = itemLiteStore?.[id];
  if (!lite) return err(notFound(id));
  const layers = layersStage.resolved ? (itemLayersStore?.[id] ?? {}) : {};
  const credits = creditsStage.resolved ? (itemCreditsStore?.[id] ?? []) : [];
  return ok({ ...lite, layers, credits });
}

export function getItemCredits(id: string): Result<Credit[], LoadError> {
  if (!creditsStage.resolved) return err(loading("credits"));
  const credits = itemCreditsStore?.[id];
  return credits ? ok(credits) : err(notFound(id));
}

export function getItemLayers(
  id: string,
): Result<Record<string, LayerEntry>, LoadError> {
  if (!layersStage.resolved) return err(loading("layers"));
  const layers = itemLayersStore?.[id];
  return layers ? ok(layers) : err(notFound(id));
}

export function getPaletteMetadata(): Result<PaletteMetadata, LoadError> {
  if (!paletteStage.resolved) return err(loading("palette"));
  // Non-null by construction: registerFromPaletteModule sets the store before
  // resolving the stage.
  return ok(paletteMetadataStore!);
}

export function getCategoryTree(): Result<CategoryTree, LoadError> {
  if (!indexStage.resolved) return err(loading("index"));
  return ok(categoryTreeStore!);
}

export function getMetadataIndexes(): Result<MetadataIndexes, LoadError> {
  if (!indexStage.resolved) return err(loading("index"));
  return ok(metadataIndexesStore!);
}

export function getAliasMetadata(): Result<AliasMetadata, LoadError> {
  if (!indexStage.resolved) return err(loading("index"));
  return ok(aliasMetadataStore!);
}

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
    await catalogReady.onAllReady;
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
    indexStage.resolved &&
    liteStage.resolved &&
    creditsStage.resolved &&
    paletteStage.resolved &&
    layersStage.resolved;
}

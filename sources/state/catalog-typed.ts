/**
 * Typed, Result-returning façade over `catalog.js`.
 *
 * Every getter returns `Result<T, LoadError>`:
 *   - `Ok(value)` when the chunk is registered and the id resolves.
 *   - `Err({ kind: "loading" })` when the chunk has not registered yet.
 *   - `Err({ kind: "not-found" })` when the chunk is registered but the id is absent.
 *
 * Dynamic-import failures intentionally crash today (no `Err` variant): the chunk
 * loading machinery in `install-item-metadata.js` propagates the rejection.
 * If we ever need to recover instead of crash, add a `"load-failed"` variant here.
 *
 * Consumer-side code pairs this with the `ResultBoundary` component (in the render tree)
 * or with `.match` / `.unwrapOr` / `if (r.isErr())` (everywhere else).
 */

import { ok, err, type Result } from "neverthrow";
import * as raw from "./catalog.js";

// ────────────────────────────────────────────────────────────────────────────
// Error shape
// ────────────────────────────────────────────────────────────────────────────

export type ChunkName = "index" | "lite" | "credits" | "palette" | "layers";

export type LoadError =
  | { kind: "loading"; chunk: ChunkName }
  | { kind: "not-found"; id: string };

// ────────────────────────────────────────────────────────────────────────────
// Catalog data shapes (audited from real consumer usage; conservative widening)
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
  preview_row?: number;
};

export type Credit = {
  file: string;
  authors: string[];
  licenses: string[];
  urls: string[];
  notes?: string;
};

export type LayerEntry = Record<string, string>;

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
 * `hashMatch.itemsByTypeName[typeName]`. Documented in `resolve-hash-param.js`:
 * just enough fields for hash-resolution and path-name lookups; the full record
 * lives in the lite item store.
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
  versions: Record<string, PaletteVersionMeta>;
};

// ────────────────────────────────────────────────────────────────────────────
// Result-returning getters
// ────────────────────────────────────────────────────────────────────────────

const loading = (chunk: ChunkName): LoadError => ({ kind: "loading", chunk });
const notFound = (id: string): LoadError => ({ kind: "not-found", id });

export function getItemLite(id: string): Result<ItemLite, LoadError> {
  if (!raw.stages.lite.resolved) return err(loading("lite"));
  const item = raw.getItemLite(id) as ItemLite | undefined;
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
  if (!raw.stages.lite.resolved) return err(loading("lite"));
  const merged = raw.getItemMerged(id) as ItemMerged | undefined;
  return merged ? ok(merged) : err(notFound(id));
}

export function getItemCredits(id: string): Result<Credit[], LoadError> {
  if (!raw.stages.credits.resolved) return err(loading("credits"));
  return ok(raw.getItemCredits(id) as Credit[]);
}

export function getItemLayers(
  id: string,
): Result<Record<string, LayerEntry>, LoadError> {
  if (!raw.stages.layers.resolved) return err(loading("layers"));
  return ok(raw.getItemLayers(id) as Record<string, LayerEntry>);
}

export function getPaletteMetadata(): Result<PaletteMetadata, LoadError> {
  if (!raw.stages.palette.resolved) return err(loading("palette"));
  return ok(raw.getPaletteMetadata() as PaletteMetadata);
}

export function getCategoryTree(): Result<CategoryTree, LoadError> {
  if (!raw.stages.index.resolved) return err(loading("index"));
  return ok(raw.getCategoryTree() as CategoryTree);
}

export function getMetadataIndexes(): Result<MetadataIndexes, LoadError> {
  if (!raw.stages.index.resolved) return err(loading("index"));
  return ok(raw.getMetadataIndexes() as MetadataIndexes);
}

export function getAliasMetadata(): Result<AliasMetadata, LoadError> {
  if (!raw.stages.index.resolved) return err(loading("index"));
  return ok(raw.getAliasMetadata() as AliasMetadata);
}

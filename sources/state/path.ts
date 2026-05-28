import "../install-item-metadata.ts";
import { ok, err, type Result } from "neverthrow";
import { ANIMATIONS } from "./constants.ts";
import { getHashParamsforSelections } from "./hash.ts";
import {
  type CatalogReader,
  type ItemMerged,
  type LoadError,
  type SlimByTypeNameRow,
} from "./catalog.ts";
import { variantToFilename, es6DynamicTemplate } from "../utils/helpers.ts";
import { debugLog } from "../utils/debug.ts";
import type { Selections } from "./state.ts";
import type { AnimationEntry } from "./filters.ts";

/**
 * `meta` arguments to `getSpritePath` / `replaceInPath` come from a few
 * sources: production callers pass an `ItemMerged`, tests pass partial
 * fixtures, and `replaceInPath` reads a `replace_in_path` field that's not
 * part of the catalog's published `ItemMerged` shape. Modeling as
 * `Partial<ItemMerged>` plus the extra field captures all of that.
 */
type PathMeta = Partial<ItemMerged> & {
  replace_in_path?: Record<string, Record<string, string>>;
};

/** Subset of `SlimByTypeNameRow` consumed by `getNameWithoutVariant`. */
type NameVariantRow = {
  variants?: string[];
  recolors?: { variants?: string[] }[];
};

/**
 * Why `getSpritePath` couldn't produce a path. `LoadError` reflects a real
 * fetch failure; the other two are "not applicable" outcomes that callers
 * routinely encounter as they iterate layers and body types.
 */
export type PathError =
  | LoadError
  | { kind: "missing-layer"; layerNum: number }
  | { kind: "missing-bodytype-path"; bodyType: string };

type PathDeps = {
  variantToFilename: (variant: string) => string;
  es6DynamicTemplate: (
    template: string,
    vars: Record<string, string>,
  ) => string;
  debugLog: (message: string) => void;
  animations: AnimationEntry[];
};

function createDefaultPathDeps(): PathDeps {
  return {
    variantToFilename,
    es6DynamicTemplate,
    debugLog,
    animations: ANIMATIONS,
  };
}

let pathDeps = createDefaultPathDeps();

export function setPathDeps(overrides: Partial<PathDeps>): void {
  Object.assign(pathDeps, overrides);
}

export function resetPathDeps(): void {
  pathDeps = createDefaultPathDeps();
}

export function getPathDeps(): PathDeps {
  return pathDeps;
}

/**
 * Extract the base asset name from a `name_variant` string. Both names and
 * variants may contain underscores, so this scans for the longest variant
 * suffix that appears in the catalog rows for this type.
 *
 * TODO: change item-id naming to disambiguate (e.g. double-underscore between
 * name and variant) so we can drop this scan.
 */
export function getNameWithoutVariant(
  nameAndVariant: string,
  itemsForType: NameVariantRow[] | SlimByTypeNameRow[],
): string {
  let variant = "";
  const nameAndVariantPath = nameAndVariant.split("_");
  const l = nameAndVariantPath.length;
  const names = itemsForType || [];
  const variants = names
    .flatMap((n) => n.variants || [])
    .map((v) => v.toLowerCase());
  const recolors = names
    .flatMap((n) => n.recolors?.[0]?.variants || [])
    .map((v) => v.toLowerCase());
  let j = l;
  let v = 0;
  while (--j > 0) {
    const part = nameAndVariantPath.slice(j, l).join("_");
    const hasPart = (flatMap: string[], part: string) =>
      flatMap?.includes(part.toLowerCase());
    if (hasPart(variants, part) || hasPart(recolors, part)) {
      variant = part;
      v = j;
    }
  }
  const name = variant
    ? nameAndVariantPath.slice(0, v).join("_")
    : nameAndVariantPath.slice(0, l - 1).join("_");
  return name;
}

/** Build a sprite-path string for a specific item layer + animation + variant. */
export function getSpritePath(
  catalog: CatalogReader,
  itemId: string,
  variant: string | null,
  recolors: Record<string, string> | boolean | null,
  bodyType: string,
  animName: string,
  layerNum: number = 1,
  selections: Selections = {},
  meta: PathMeta | null = null,
): Result<string, PathError> {
  if (!meta) {
    const r = catalog.getItemMerged(itemId);
    if (r.isErr()) return err(r.error);
    meta = r.value;
  }

  const layerKey = `layer_${layerNum}`;
  const layer = meta.layers?.[layerKey];
  if (!layer) return err({ kind: "missing-layer", layerNum });

  let basePath = layer[bodyType] as string | undefined;
  if (!basePath) return err({ kind: "missing-bodytype-path", bodyType });

  if (basePath.includes("${")) {
    basePath = replaceInPath(catalog, basePath, selections, meta);
  }

  // If no variant specified, try to extract from itemId.
  if (!variant && !recolors) {
    const parts = itemId.split("_");
    variant = parts[parts.length - 1];
  }

  const animation = pathDeps.animations.find((a) => a.value === animName);
  if (animation?.folderName) {
    animName = animation.folderName;
  }

  // `variant` is guaranteed non-null when `!recolors` here: if both inputs
  // were falsy the block above derived `variant` from the itemId.
  const fileName = !recolors ? `/${pathDeps.variantToFilename(variant!)}` : "";
  return ok(`spritesheets/${basePath}${animName}${fileName}.png`);
}

/** Replace `${typeName}` placeholders in a path using the current selections. */
export function replaceInPath(
  catalog: CatalogReader,
  path: string,
  selections: Selections | null | undefined,
  meta: PathMeta,
): string {
  if (path.includes("${")) {
    // TODO: optimize — recomputed on every layer/frame today; could be cached
    // per-selection-change or skipped when `path` doesn't contain `${`.
    const hashParams = getHashParamsforSelections(catalog, selections || {});
    const replacements = Object.fromEntries(
      Object.entries(hashParams).map(([typeName, nameAndVariant]) => {
        const name = _getNameWithoutVariant(catalog, typeName, nameAndVariant);
        // `meta.replace_in_path` may be undefined; preserved JS behavior is to
        // throw when the path has placeholders but the field is missing.
        const replacement = meta.replace_in_path![typeName]?.[name];
        if (path.includes(`\${${typeName}}`) && !replacement) {
          pathDeps.debugLog(
            `Warning: No replacement found for ${typeName}="${name}" in path template.`,
          );
        }
        return [typeName, replacement];
      }),
    );

    return pathDeps.es6DynamicTemplate(path, replacements);
  }

  return path;
}

function _getNameWithoutVariant(
  catalog: CatalogReader,
  typeName: string,
  nameAndVariant: string,
): string {
  const indexes = catalog.getMetadataIndexes().unwrapOr(null);
  const itemsForType = indexes?.byTypeName?.[typeName] ?? [];
  return getNameWithoutVariant(nameAndVariant, itemsForType);
}

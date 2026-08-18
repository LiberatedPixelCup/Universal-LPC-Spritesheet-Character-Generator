import fs from "node:fs";
import path from "node:path";
import type {
  AliasMetadata,
  Credit,
  ItemLite,
  LayerEntry,
  PaletteMetadata,
  SlimByTypeNameRow,
} from "../../sources/state/catalog.ts";
import { buildSlimByTypeNameRow } from "../../sources/state/resolve-hash-param.ts";

export const SHEETS_DIR = "sheet_definitions" + path.sep;
export const PALETTES_DIR = "palette_definitions" + path.sep;
export const METADATA_OUTPUT = "item-metadata.js";
export const onlyIfTemplate = false;

export const METADATA_MODULE_BASENAMES = [
  "index-metadata.js",
  "palette-metadata.js",
  "item-metadata.js",
  "credits-metadata.js",
  "layers-metadata.js",
] as const;

export type MetadataEnv = "development" | "production";

export type DirTreeEntry = {
  parentPath: string;
  name: string;
};

export type CsvListEntry = {
  path: string;
  csv: Array<{ priority?: number | null; lineText: string }>;
};

/**
 * Item record in generator state. Parsers fill fields incrementally, so this is
 * {@link ItemMerged} with optional catalog fields plus extras written during parse.
 */
export type GeneratorItem = Omit<Partial<ItemLite>, "recolors"> & {
  layers?: Record<string, LayerEntry>;
  credits?: Array<Partial<Credit>>;
  licenses?: Record<string, string[]>;
  priority?: number | null;
  tags?: string[];
  required_tags?: string[];
  excluded_tags?: string[];
  replace_in_path?: Record<string, Record<string, string>>;
  preview_column?: number;
  preview_x_offset?: number;
  preview_y_offset?: number;
  /** Palettes start as token lists, then expand to maps during normalizeRecolors. */
  recolors?: Array<{
    material?: string;
    palettes?: string[] | Record<string, string[]>;
    type_name?: string | null;
    variants?: string[];
    label?: string;
    default?: string;
    base?: string;
  }>;
};

/** Category tree node as written by generateSources (label/priority/required/animations). */
export type GeneratorTreeNode = {
  items?: string[];
  children?: Record<string, GeneratorTreeNode>;
  label?: string;
  priority?: number | null;
  required?: string[];
  animations?: string[];
};

export type InternedSlimByTypeNameRow = Pick<
  SlimByTypeNameRow,
  "itemId" | "name" | "type_name"
> & {
  v: number;
  r: number;
};

export type MetadataModuleSources = {
  itemMetadata?: Record<string, GeneratorItem>;
  aliasMetadata?: AliasMetadata;
  categoryTree?: GeneratorTreeNode;
};

export const licensesFound: string[] = [];
export const csvList: CsvListEntry[] = [];
export const itemMetadata: Record<string, GeneratorItem> = {};
export const paletteMetadata: PaletteMetadata = { versions: {}, materials: {} };
export const aliasMetadata: AliasMetadata = {};
export const categoryTree: GeneratorTreeNode = { items: [], children: {} };

const METADATA_FILE_BANNER = `// THIS FILE IS AUTO-GENERATED. PLEASE DON'T ALTER IT MANUALLY
// Generated from sheet_definitions/*.json by scripts/generate_sources.ts
`;

function clearObject(obj: object): void {
  for (const key of Object.keys(obj)) {
    delete (obj as Record<string, unknown>)[key];
  }
}

/**
 * Clears shared generator state so repeated full runs (e.g. Vite watch without a fresh module load)
 * do not accumulate stale keys in itemMetadata and related structures.
 */
export function resetGeneratorState() {
  licensesFound.length = 0;
  csvList.length = 0;
  clearObject(itemMetadata);
  paletteMetadata.versions = {};
  paletteMetadata.materials = {};
  clearObject(aliasMetadata);
  categoryTree.items = [];
  categoryTree.children = {};
}

export function getMetadataJsonIndent(
  env: MetadataEnv = "production",
): number | undefined {
  return env === "development" ? 2 : undefined;
}

/**
 * Sorts recursive directory entries by depth first, then locale-aware path name.
 */
export function sortDirTree(a: DirTreeEntry, b: DirTreeEntry): number {
  const pa = path.join(a.parentPath, a.name);
  const pb = path.join(b.parentPath, b.name);

  const depthA = pa.split(path.sep).length;
  const depthB = pb.split(path.sep).length;
  if (depthA !== depthB) return depthA - depthB;

  return pa.localeCompare(pb, ["en"]);
}

/**
 * Reads and parses a Directory Tree and sorts it.
 */
export function readDirTree(dirToRead: string): fs.Dirent[] {
  return fs
    .readdirSync(dirToRead, {
      recursive: true,
      withFileTypes: true,
    })
    .sort(sortDirTree);
}

/**
 * Reads and parses a JSON file from disk.
 */
export function parseJson(fullPath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(fullPath).toString());
  } catch (e) {
    console.error("Error parsing JSON from file:", fullPath);
    throw e;
  }
}

/**
 * Splits full generator item entries into lite fields, credits, and layers maps.
 */
export function splitItemMetadataMaps(
  fullItemMetadata: Record<string, GeneratorItem>,
): {
  itemMetadataLite: Record<string, Omit<GeneratorItem, "layers" | "credits">>;
  itemCredits: Record<string, Array<Partial<Credit>>>;
  itemLayers: Record<string, Record<string, LayerEntry>>;
} {
  const itemMetadataLite: Record<
    string,
    Omit<GeneratorItem, "layers" | "credits">
  > = {};
  const itemCredits: Record<string, Array<Partial<Credit>>> = {};
  const itemLayers: Record<string, Record<string, LayerEntry>> = {};

  for (const [itemId, meta] of Object.entries(fullItemMetadata)) {
    const { layers, credits, ...lite } = meta;
    itemMetadataLite[itemId] = lite;
    itemCredits[itemId] = credits ?? [];
    itemLayers[itemId] = layers ?? {};
  }

  return { itemMetadataLite, itemCredits, itemLayers };
}

/**
 * Builds `metadataIndexes.byTypeName` for path/hash helpers.
 * `_aliasMetadata` is reserved for future alias-aware indexes.
 */
export function buildMetadataIndexes(
  fullItemMetadata: Record<string, GeneratorItem>,
  _aliasMetadata: AliasMetadata | Record<string, unknown>,
): { byTypeName: Record<string, SlimByTypeNameRow[]> } {
  const keys = Object.keys(fullItemMetadata);
  const byTypeName: Record<string, SlimByTypeNameRow[]> = {};
  for (const itemId of keys) {
    const meta = fullItemMetadata[itemId];
    const t = meta.type_name ?? "";
    if (!byTypeName[t]) byTypeName[t] = [];
    byTypeName[t].push(
      buildSlimByTypeNameRow(itemId, {
        name: meta.name ?? "",
        type_name: meta.type_name ?? "",
        variants: meta.variants,
        recolors: meta.recolors,
      }),
    );
  }
  return { byTypeName };
}

/**
 * Deduplicate repeated `variants` and `recolor[0].variants` across slim rows.
 */
export function internSlimByTypeNameRows(
  byTypeNameFull: Record<string, SlimByTypeNameRow[]>,
): {
  variantArrays: string[][];
  recolorVariantArrays: string[][];
  byTypeName: Record<string, InternedSlimByTypeNameRow[]>;
} {
  const vKey = new Map<string, number>();
  const rKey = new Map<string, number>();
  const variantArrays: string[][] = [];
  const recolorVariantArrays: string[][] = [];

  function internVariants(variants: string[] | undefined): number {
    const k = JSON.stringify(variants);
    const existing = vKey.get(k);
    if (existing !== undefined) return existing;
    const idx = variantArrays.length;
    vKey.set(k, idx);
    variantArrays.push(Array.isArray(variants) ? [...variants] : []);
    return idx;
  }

  function internRecolorVariants(
    recolors: SlimByTypeNameRow["recolors"] | undefined,
  ): number {
    const v0 = recolors?.[0]?.variants;
    const arr = Array.isArray(v0) && v0.length > 0 ? [...v0] : [];
    const k = JSON.stringify(arr);
    const existing = rKey.get(k);
    if (existing !== undefined) return existing;
    const idx = recolorVariantArrays.length;
    rKey.set(k, idx);
    recolorVariantArrays.push(arr);
    return idx;
  }

  const byTypeName: Record<string, InternedSlimByTypeNameRow[]> = {};
  for (const [t, rows] of Object.entries(byTypeNameFull)) {
    byTypeName[t] = rows.map((row) => ({
      itemId: row.itemId,
      name: row.name,
      type_name: row.type_name,
      v: internVariants(row.variants),
      r: internRecolorVariants(row.recolors),
    }));
  }
  return { variantArrays, recolorVariantArrays, byTypeName };
}

/**
 * Drop duplicate variant strings on `recolors[0]`; runtime restores them from
 * `recolorVariantArrays[r]` in `index-metadata.js`.
 */
function stripRecolorEntryZeroVariantsForEmit(
  recolors: NonNullable<GeneratorItem["recolors"]> | undefined,
): NonNullable<GeneratorItem["recolors"]> {
  if (!Array.isArray(recolors) || recolors.length === 0) {
    return recolors ?? [];
  }
  return recolors.map((entry, i) => {
    if (i !== 0 || !entry || typeof entry !== "object") {
      return entry;
    }
    return { ...entry, variants: [] };
  });
}

function buildInternedItemMetadataLiteMap(
  itemMetadataLite: Record<string, Omit<GeneratorItem, "layers" | "credits">>,
  internedByTypeName: Record<string, InternedSlimByTypeNameRow[]>,
): Record<string, unknown> {
  const itemIdToVr = new Map<string, { v: number; r: number }>();
  for (const rows of Object.values(internedByTypeName)) {
    for (const row of rows) {
      itemIdToVr.set(row.itemId, { v: row.v, r: row.r });
    }
  }
  const out: Record<string, unknown> = {};
  for (const [itemId, lite] of Object.entries(itemMetadataLite)) {
    const vr = itemIdToVr.get(itemId);
    if (vr == null) {
      out[itemId] = lite;
      continue;
    }
    const { variants: _dropV, recolors, ...rest } = lite;
    out[itemId] = {
      ...rest,
      v: vr.v,
      r: vr.r,
      recolors: stripRecolorEntryZeroVariantsForEmit(recolors ?? []),
    };
  }
  return out;
}

function buildNamedConstModule(
  constName: string,
  valueJson: string,
  exportNames: string[],
): string {
  const exports = exportNames.join(", ");
  return `${METADATA_FILE_BANNER}
const ${constName} = ${valueJson};

export { ${exports} };
`;
}

export function buildIndexMetadataJs(
  aliasMetadataArg: AliasMetadata,
  categoryTreeArg: GeneratorTreeNode,
  fullItemMetadata: Record<string, GeneratorItem>,
  env: MetadataEnv = "production",
): string {
  const indent = getMetadataJsonIndent(env);
  const { byTypeName: byTypeNameFull } = buildMetadataIndexes(
    fullItemMetadata,
    aliasMetadataArg,
  );
  const { variantArrays, recolorVariantArrays, byTypeName } =
    internSlimByTypeNameRows(byTypeNameFull);
  const variantArraysJson = JSON.stringify(variantArrays, null, indent);
  const recolorVariantArraysJson = JSON.stringify(
    recolorVariantArrays,
    null,
    indent,
  );
  const byTypeJson = JSON.stringify(byTypeName, null, indent);
  const aliasJson = JSON.stringify(aliasMetadataArg, null, indent);
  const treeJson = JSON.stringify(categoryTreeArg, null, indent);

  return `${METADATA_FILE_BANNER}
const variantArrays = ${variantArraysJson};

const recolorVariantArrays = ${recolorVariantArraysJson};

const byTypeName = ${byTypeJson};

const metadataIndexes = {
  variantArrays,
  recolorVariantArrays,
  byTypeName,
  hashMatch: { itemsByTypeName: byTypeName },
};

const aliasMetadata = ${aliasJson};

const categoryTree = ${treeJson};

export { aliasMetadata, categoryTree, metadataIndexes };
`;
}

export function buildPaletteMetadataJs(
  env: MetadataEnv = "production",
): string {
  const indent = getMetadataJsonIndent(env);
  const paletteJson = JSON.stringify(paletteMetadata, null, indent);
  return buildNamedConstModule("paletteMetadata", paletteJson, [
    "paletteMetadata",
  ]);
}

export function buildItemMetadataLiteJs(
  fullItemMetadata: Record<string, GeneratorItem>,
  env: MetadataEnv = "production",
): string {
  const indent = getMetadataJsonIndent(env);
  const { itemMetadataLite } = splitItemMetadataMaps(fullItemMetadata);
  const { byTypeName: byTypeNameFull } = buildMetadataIndexes(
    fullItemMetadata,
    {},
  );
  const { byTypeName: internedByType } =
    internSlimByTypeNameRows(byTypeNameFull);
  const internedLite = buildInternedItemMetadataLiteMap(
    itemMetadataLite,
    internedByType,
  );
  const itemJson = JSON.stringify(internedLite, null, indent);
  return buildNamedConstModule("itemMetadata", itemJson, ["itemMetadata"]);
}

export function buildCreditsMetadataJs(
  fullItemMetadata: Record<string, GeneratorItem>,
  env: MetadataEnv = "production",
): string {
  const indent = getMetadataJsonIndent(env);
  const { itemCredits } = splitItemMetadataMaps(fullItemMetadata);
  const json = JSON.stringify(itemCredits, null, indent);
  return buildNamedConstModule("itemCredits", json, ["itemCredits"]);
}

export function buildLayersMetadataJs(
  fullItemMetadata: Record<string, GeneratorItem>,
  env: MetadataEnv = "production",
): string {
  const indent = getMetadataJsonIndent(env);
  const { itemLayers } = splitItemMetadataMaps(fullItemMetadata);
  const json = JSON.stringify(itemLayers, null, indent);
  return buildNamedConstModule("itemLayers", json, ["itemLayers"]);
}

export function buildAllMetadataModules(
  env: MetadataEnv = "production",
  sources: MetadataModuleSources = {},
): Map<string, string> {
  const fullItems = sources.itemMetadata ?? itemMetadata;
  const aliases = sources.aliasMetadata ?? aliasMetadata;
  const tree = sources.categoryTree ?? categoryTree;

  const out = new Map<string, string>();
  out.set(
    "index-metadata.js",
    buildIndexMetadataJs(aliases, tree, fullItems, env),
  );
  out.set("palette-metadata.js", buildPaletteMetadataJs(env));
  out.set("item-metadata.js", buildItemMetadataLiteJs(fullItems, env));
  out.set("credits-metadata.js", buildCreditsMetadataJs(fullItems, env));
  out.set("layers-metadata.js", buildLayersMetadataJs(fullItems, env));
  return out;
}

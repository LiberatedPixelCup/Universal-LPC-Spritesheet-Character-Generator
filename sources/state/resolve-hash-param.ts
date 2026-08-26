/**
 * Indexed hash param resolution: same tie-breaking as legacy `Object.entries(itemMetadata)` scans
 * when `itemsByTypeName[typeName]` lists rows in `Object.keys(itemMetadata)` order (see
 * `buildMetadataIndexes` in `scripts/generateSources/state.ts`).
 *
 * `byTypeName` / `buildItemsByTypeNameLite` store only the fields used by
 * `resolveHashParamFromHashMatch` and `path.getNameWithoutVariant` (plus `itemId`); the full
 * item record lives in the lite item map.
 *
 * Emitted `index-metadata.js` may store interned rows (`v` / `r` into `variantArrays` /
 * `recolorVariantArrays`) and `paletteArrays`; `writer.registerIndexMetadata` expands
 * `byTypeName` to the slim row shape and keeps the array tables for expanding interned
 * `item-metadata.js` lites. Emitted `item-metadata.js` may store per-item `v` / `r`,
 * per-recolor `p`, and stripped `recolors[0].variants` / `recolors[].palettes`. Palette
 * restore (`p` / `paletteArrays`) is independent of variant restore.
 */

import type {
  ItemLite,
  MetadataIndexes,
  PaletteMap,
  PaletteRecolor,
  SlimByTypeNameRow,
} from "./catalog.ts";

/**
 * Recolor as emitted with interned palette maps: `p` indexes `paletteArrays` in
 * `index-metadata.js`. The expanded form is `PaletteRecolor` (`palettes` required).
 */
export type InternedPaletteRecolor = Omit<PaletteRecolor, "palettes"> & {
  p: number;
};

/**
 * Lite item as emitted with interned variant indices: `v` / `r` point into the
 * shared `variantArrays` / `recolorVariantArrays` tables in `index-metadata.js`.
 * Recolors may also carry `p` instead of `palettes`. The expanded form is `ItemLite`.
 */
export type InternedItemLite = Omit<ItemLite, "variants" | "recolors"> & {
  v: number;
  r: number;
  recolors: Array<PaletteRecolor | InternedPaletteRecolor>;
};

/**
 * Expands `metadataIndexes` as emitted with interned `variantArrays` + `recolorVariantArrays` and
 * per-row `v` / `r` indices (production `index-metadata.js`). In-memory / test fixtures with full
 * `variants` + `recolors` on each row are returned unchanged.
 */
export function expandMetadataIndexesWithInternedArrays(
  metadataIndexes: MetadataIndexes | null | undefined,
): MetadataIndexes | null | undefined {
  if (!metadataIndexes || !metadataIndexes.byTypeName) {
    return metadataIndexes;
  }
  const { byTypeName, variantArrays, recolorVariantArrays } = metadataIndexes;
  if (!Array.isArray(variantArrays) || !Array.isArray(recolorVariantArrays)) {
    return metadataIndexes;
  }
  const firstType = Object.values(byTypeName).find(
    (rows) => Array.isArray(rows) && rows.length > 0,
  );
  const firstRow = firstType?.[0] as
    (SlimByTypeNameRow & { v?: number; r?: number }) | undefined;
  if (
    !firstRow ||
    firstRow.variants !== undefined ||
    !Object.prototype.hasOwnProperty.call(firstRow, "v") ||
    !Object.prototype.hasOwnProperty.call(firstRow, "r")
  ) {
    return metadataIndexes;
  }

  const V = variantArrays;
  const R = recolorVariantArrays;
  const expanded: Record<string, SlimByTypeNameRow[]> = {};
  for (const [t, rows] of Object.entries(byTypeName)) {
    expanded[t] = rows.map((row) => {
      const internedRow = row as unknown as SlimByTypeNameRow & {
        v: number;
        r: number;
      };
      const variants = V[internedRow.v] ?? [];
      const rArr = R[internedRow.r] ?? [];
      const recolors =
        Array.isArray(rArr) && rArr.length > 0 ? [{ variants: rArr }] : [];
      return {
        itemId: internedRow.itemId,
        name: internedRow.name,
        type_name: internedRow.type_name,
        variants: [...variants],
        recolors,
      };
    });
  }
  const {
    variantArrays: variantArraysKept,
    recolorVariantArrays: recolorVariantArraysKept,
    paletteArrays: paletteArraysKept,
    ...rest
  } = metadataIndexes;
  return {
    ...rest,
    byTypeName: expanded,
    hashMatch: { itemsByTypeName: expanded },
    variantArrays: variantArraysKept,
    recolorVariantArrays: recolorVariantArraysKept,
    ...(paletteArraysKept !== undefined
      ? { paletteArrays: paletteArraysKept }
      : {}),
  };
}

export function isInternedItemLite(lite: unknown): boolean {
  if (lite == null || typeof lite !== "object") return false;
  const obj = lite as Record<string, unknown>;
  return (
    typeof obj.v === "number" &&
    typeof obj.r === "number" &&
    !Object.prototype.hasOwnProperty.call(obj, "variants")
  );
}

/** True when any recolor stores interned `p` instead of (or besides) a palettes map. */
export function hasInternedPalettes(lite: unknown): boolean {
  if (lite == null || typeof lite !== "object") return false;
  const recolors = (lite as { recolors?: unknown }).recolors;
  if (!Array.isArray(recolors)) return false;
  return recolors.some(
    (color) =>
      color != null &&
      typeof color === "object" &&
      typeof (color as { p?: unknown }).p === "number",
  );
}

type LooseRecolor = {
  variants?: string[];
  palettes?: PaletteMap;
  p?: number;
} & Record<string, unknown>;

/** Outer map + each nested version object; colour arrays are shared. */
function clonePaletteMap(map: PaletteMap): PaletteMap {
  const cloned: PaletteMap = {};
  for (const [key, nested] of Object.entries(map)) {
    cloned[key] = { ...nested };
  }
  return cloned;
}

function expandInternedPaletteRecolors(
  recolors: LooseRecolor[],
  paletteArrays?: PaletteMap[],
): LooseRecolor[] {
  return recolors.map((color) => {
    if (
      color == null ||
      typeof color !== "object" ||
      typeof color.p !== "number"
    ) {
      return color;
    }
    const { p, palettes: existing, ...rest } = color;
    if (
      existing != null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      return { ...rest, palettes: existing };
    }
    const table = Array.isArray(paletteArrays) ? paletteArrays[p] : undefined;
    const palettes =
      table != null && typeof table === "object" && !Array.isArray(table)
        ? clonePaletteMap(table)
        : {};
    return { ...rest, palettes };
  });
}

/**
 * Restores `variants`, `recolors[0].variants`, and per-recolor `palettes` from
 * the shared tables (same as `index-metadata.js`). Palette restore is gated on
 * `p`, not on `v` / `r`.
 */
export function expandInternedItemLite(
  lite: ItemLite | InternedItemLite,
  variantArrays?: string[][],
  recolorVariantArrays?: string[][],
  paletteArrays?: PaletteMap[],
): ItemLite | InternedItemLite {
  let out: ItemLite | InternedItemLite = lite;
  if (
    isInternedItemLite(lite) &&
    Array.isArray(variantArrays) &&
    Array.isArray(recolorVariantArrays)
  ) {
    const interned = lite as unknown as Omit<InternedItemLite, "recolors"> & {
      recolors?: LooseRecolor[];
    };
    const { v, r, recolors: rcIn, ...rest } = interned;
    const variants = variantArrays[v] ?? [];
    const rList = recolorVariantArrays[r] ?? [];
    let recolors: LooseRecolor[] = Array.isArray(rcIn) ? rcIn : [];
    if (recolors.length > 0) {
      const [head, ...tail] = recolors;
      if (head && typeof head === "object") {
        const merged0 = { ...head, variants: rList.length ? [...rList] : [] };
        recolors = [merged0, ...tail];
      }
    } else if (rList.length > 0) {
      recolors = [{ variants: [...rList] }];
    }
    out = { ...rest, variants, recolors } as unknown as ItemLite;
  }
  if (hasInternedPalettes(out)) {
    const recolors = expandInternedPaletteRecolors(
      (out as { recolors: LooseRecolor[] }).recolors,
      paletteArrays,
    );
    out = { ...out, recolors } as unknown as ItemLite;
  }
  return out;
}

type ItemLikeForSlimRow = Pick<ItemLite, "name" | "type_name"> & {
  variants?: ItemLite["variants"];
  recolors?: { variants?: string[] }[];
};

export function buildSlimByTypeNameRow(
  itemId: string,
  meta: ItemLikeForSlimRow,
): SlimByTypeNameRow {
  const variants = Array.isArray(meta.variants) ? meta.variants : [];
  const v0 = meta.recolors?.[0]?.variants;
  const recolors =
    Array.isArray(v0) && v0.length > 0 ? [{ variants: [...v0] }] : [];
  return {
    itemId,
    name: meta.name,
    type_name: meta.type_name,
    variants,
    recolors,
  };
}

export function buildItemsByTypeNameLite(
  itemMetadata: Record<string, ItemLikeForSlimRow>,
): Record<string, SlimByTypeNameRow[]> {
  const byType: Record<string, SlimByTypeNameRow[]> = {};
  for (const [itemId, meta] of Object.entries(itemMetadata)) {
    const t = meta.type_name;
    if (!byType[t]) byType[t] = [];
    byType[t].push(buildSlimByTypeNameRow(itemId, meta));
  }
  return byType;
}

/**
 * Normalize a hash/catalog variant so `dark_brown`, `dark brown`, and
 * `dark%20brown` compare equal (issue #296).
 */
export function normalizeVariantForHashMatch(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the raw string when percent-encoding is malformed.
  }
  return decoded.replaceAll(" ", "_").toLowerCase();
}

function hashVariantsEqual(a: string, b: string): boolean {
  return normalizeVariantForHashMatch(a) === normalizeVariantForHashMatch(b);
}

export function resolveHashParamFromHashMatch({
  typeName,
  nameAndVariant,
  itemsByTypeName,
}: {
  typeName: string;
  nameAndVariant: string;
  itemsByTypeName: Record<string, SlimByTypeNameRow[]>;
}): {
  foundItemId: string | null;
  matchedVariant: string;
  matchedRecolor: string;
} {
  let foundItemId: string | null = null;
  let matchedVariant = "";
  let matchedRecolor = "";

  const parts = nameAndVariant.split("_");
  const metasForType = itemsByTypeName[typeName] || [];

  for (let i = 1; i <= parts.length; i++) {
    const nameToMatch = parts.slice(0, i).join("_");
    const variants = parts.slice(i).join("_");
    const variantToMatch = variants.split("|")[0] ?? "";
    const recolorToMatch = variants.split("|")[1] || "";

    for (const row of metasForType) {
      const itemId = row.itemId;
      const meta = row;
      if (meta.type_name !== typeName) continue;

      const metaNameNormalized = meta.name.replaceAll(" ", "_");

      if (metaNameNormalized.toLowerCase() === nameToMatch.toLowerCase()) {
        if (meta.variants?.length > 0) {
          for (const variant of meta.variants) {
            if (hashVariantsEqual(variant, variantToMatch)) {
              foundItemId = itemId;
              matchedVariant = variant;
              matchedRecolor = "";
              break;
            }
          }
        }
        if ((meta.recolors?.[0]?.variants?.length ?? 0) > 0) {
          for (const variant of meta.recolors[0]?.variants ?? []) {
            if (
              (recolorToMatch !== "" &&
                hashVariantsEqual(variant, recolorToMatch)) ||
              (recolorToMatch === "" &&
                hashVariantsEqual(variant, variantToMatch))
            ) {
              foundItemId = itemId;
              matchedVariant = "";
              matchedRecolor = variant;
              break;
            }
          }
        }
        if (variantToMatch === "") {
          foundItemId = itemId;
          matchedVariant = "";
          matchedRecolor = "";
          break;
        }
      }

      if (foundItemId) break;
    }

    if (foundItemId) break;
  }

  return { foundItemId, matchedVariant, matchedRecolor };
}

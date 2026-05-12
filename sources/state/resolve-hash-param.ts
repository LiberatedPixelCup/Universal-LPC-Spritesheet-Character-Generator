/**
 * Indexed hash param resolution: same tie-breaking as legacy `Object.entries(itemMetadata)` scans
 * when `itemsByTypeName[typeName]` lists rows in `Object.keys(itemMetadata)` order (see
 * `buildMetadataIndexes` in `scripts/generateSources/state.js`).
 *
 * `byTypeName` / `buildItemsByTypeNameLite` store only the fields used by
 * `resolveHashParamFromHashMatch` and `path.getNameWithoutVariant` (plus `itemId`); the full
 * item record lives in the lite item map.
 *
 * Emitted `index-metadata.js` may store interned rows (`v` / `r` into `variantArrays` /
 * `recolorVariantArrays`); `catalog.registerFromIndexModule` expands `byTypeName` to the slim row
 * shape and keeps the two array tables for expanding interned `item-metadata.js` lites. Emitted
 * `item-metadata.js` may store per-item `v` / `r` and stripped `recolors[0].variants` only.
 */

import type {
  ItemLite,
  MetadataIndexes,
  SlimByTypeNameRow,
} from "./catalog.ts";

/**
 * Lite item as emitted with interned variant indices: `v` / `r` point into the
 * shared `variantArrays` / `recolorVariantArrays` tables in `index-metadata.js`.
 * The expanded form is `ItemLite`.
 */
export type InternedItemLite = Omit<ItemLite, "variants"> & {
  v: number;
  r: number;
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
    | (SlimByTypeNameRow & { v?: number; r?: number })
    | undefined;
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
    ...rest
  } = metadataIndexes;
  return {
    ...rest,
    byTypeName: expanded,
    hashMatch: { itemsByTypeName: expanded },
    variantArrays: variantArraysKept,
    recolorVariantArrays: recolorVariantArraysKept,
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

/**
 * Restores `variants` and `recolors[0].variants` from the shared tables (same as `index-metadata.js`).
 */
export function expandInternedItemLite(
  lite: ItemLite | InternedItemLite,
  variantArrays?: string[][],
  recolorVariantArrays?: string[][],
): ItemLite | InternedItemLite {
  if (
    !isInternedItemLite(lite) ||
    !Array.isArray(variantArrays) ||
    !Array.isArray(recolorVariantArrays)
  ) {
    return lite;
  }
  type LooseRecolor = { variants?: string[] } & Record<string, unknown>;
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
  return { ...rest, variants, recolors } as unknown as ItemLite;
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
            if (variant.toLowerCase() === variantToMatch.toLowerCase()) {
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
                variant.toLowerCase() === recolorToMatch.toLowerCase()) ||
              (recolorToMatch === "" &&
                variant.toLowerCase() === variantToMatch.toLowerCase())
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

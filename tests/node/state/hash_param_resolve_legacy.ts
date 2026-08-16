/**
 * Legacy hash param resolution (full `itemMetadata` scan). Used only from tests (Commit 7b parity).
 * Mirrors `loadSelectionsFromHash` item-matching loops from `sources/state/hash.ts` pre-index.
 */

import { normalizeVariantForHashMatch } from "../../../sources/state/resolve-hash-param.ts";

type LegacyItemMeta = {
  type_name: string;
  name: string;
  variants?: string[];
  recolors?: { variants?: string[] }[];
};

type HashResolution = {
  foundItemId: string | null;
  matchedVariant: string;
  matchedRecolor: string;
};

function hashVariantsEqual(a: string, b: string): boolean {
  return normalizeVariantForHashMatch(a) === normalizeVariantForHashMatch(b);
}

export function resolveHashParamLegacy({
  typeName,
  nameAndVariant,
  itemMetadata,
}: {
  typeName: string;
  nameAndVariant: string;
  itemMetadata: Record<string, LegacyItemMeta> | null | undefined;
}): HashResolution {
  let foundItemId: string | null = null;
  let matchedVariant = "";
  let matchedRecolor = "";

  const parts = nameAndVariant.split("_");

  for (let i = 1; i <= parts.length; i++) {
    const nameToMatch = parts.slice(0, i).join("_");
    const variants = parts.slice(i).join("_");
    const variantToMatch = variants.split("|")[0] ?? "";
    const recolorToMatch = variants.split("|")[1] || "";

    for (const [itemId, meta] of Object.entries(itemMetadata || {})) {
      if (meta.type_name !== typeName) continue;

      const metaNameNormalized = meta.name.replaceAll(" ", "_");

      if (metaNameNormalized.toLowerCase() === nameToMatch.toLowerCase()) {
        const itemVariants = meta.variants ?? [];
        if (itemVariants.length > 0) {
          for (const variant of itemVariants) {
            if (hashVariantsEqual(variant, variantToMatch)) {
              foundItemId = itemId;
              matchedVariant = variant;
              matchedRecolor = "";
              break;
            }
          }
        }
        const recolorVariants = meta.recolors?.[0]?.variants ?? [];
        if (recolorVariants.length > 0) {
          for (const variant of recolorVariants) {
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

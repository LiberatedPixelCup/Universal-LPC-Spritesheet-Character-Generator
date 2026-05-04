/**
 * Legacy hash param resolution (full `itemMetadata` scan). Used only from tests (Commit 7b parity).
 * Mirrors `loadSelectionsFromHash` item-matching loops from `sources/state/hash.ts` pre-index.
 */

/**
 * @param {object} opts
 * @param {string} opts.typeName
 * @param {string} opts.nameAndVariant
 * @param {Record<string, object>|null|undefined} opts.itemMetadata
 * @returns {{ foundItemId: string|null, matchedVariant: string, matchedRecolor: string }}
 */
export function resolveHashParamLegacy({
  typeName,
  nameAndVariant,
  itemMetadata,
}) {
  let foundItemId = null;
  let matchedVariant = "";
  let matchedRecolor = "";

  const parts = nameAndVariant.split("_");

  for (let i = 1; i <= parts.length; i++) {
    const nameToMatch = parts.slice(0, i).join("_");
    const variants = parts.slice(i).join("_");
    const variantToMatch = variants.split("|")[0];
    const recolorToMatch = variants.split("|")[1] || "";

    for (const [itemId, meta] of Object.entries(itemMetadata || {})) {
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
        if (meta.recolors?.[0]?.variants?.length > 0) {
          for (const variant of meta.recolors[0].variants) {
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

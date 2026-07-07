import debugUtils from "../utils/debug.js";
import { aliasMetadata } from "./state.js";

const { debugWarn } = debugUtils;

/**
 * Derives the variant list used for alias target resolution.
 * @param {Object} meta Item metadata.
 * @return {string[]} Variant names to match against alias targets.
 */
function getAliasVariants(meta) {
  if (meta.variants && meta.variants.length) {
    return meta.variants;
  }
  return meta.recolors[0].variants;
}

/**
 * Resolves segmented alias targets by shifting name tokens until a variant match is found.
 * @param {string[]} variants Candidate variants.
 * @param {string} aliasVariant Alias variant expression.
 * @return {{targetName: string, targetVariant: string}} Resolved name/variant pair.
 */
function resolveSegmentedTarget(variants, aliasVariant) {
  const parts = aliasVariant.split("_");
  let targetName = "";
  let targetVariant = "";

  while (parts.length > 1) {
    targetName += (targetName !== "" ? "_" : "") + parts.shift();
    targetVariant = parts.join("_");
    if (variants.indexOf(targetVariant) !== -1) {
      break;
    }
  }

  return { targetName, targetVariant };
}

/**
 * Resolves a name-wildcard alias where both sides end with "_*"
 * (e.g., "Fur_Pants_*" → "Formal_Pants_*"). Returns the forward object when
 * the pattern matches, or null when either side is not a name-wildcard.
 * @param {string} originVariant Origin variant expression (left side of alias).
 * @param {string} aliasVariant Target variant expression (right side of alias).
 * @param {string|undefined} aliasType Explicit target type, if provided.
 * @param {string} defaultTypeName Fallback type name from item metadata.
 * @return {{typeName: string, name: string, variant: string}|null} Forward object or null.
 */
function resolveNameWildcardAlias(
  originVariant,
  aliasVariant,
  aliasType,
  defaultTypeName,
) {
  if (!originVariant.endsWith("_*") || !aliasVariant.endsWith("_*")) {
    return null;
  }
  return {
    typeName: aliasType ?? defaultTypeName,
    name: aliasVariant.slice(0, -2),
    variant: "*",
  };
}

/**
 * Resolves alias target metadata for a single alias entry.
 * @param {Object} meta Item metadata.
 * @param {string} aliasVariant Alias variant expression.
 * @param {string|undefined} aliasType Alias type expression.
 * @return {{targetName: string, targetVariant: string, typeName: string}|null} Resolved target data or null when invalid.
 */
function resolveAliasTarget(meta, aliasVariant, aliasType) {
  const variants = getAliasVariants(meta);

  // Wildcard Match
  if (aliasVariant === "*" && aliasType) {
    return {
      targetName: aliasVariant,
      targetVariant: aliasVariant,
      typeName: aliasType,
    };
  }

  // Found Exact Match
  if (variants.indexOf(aliasVariant) !== -1) {
    return {
      targetName: meta.name.replaceAll(" ", "_"),
      targetVariant: aliasVariant,
      typeName: aliasType ?? meta.type_name,
    };
  }

  // Found Loosely Related Match
  const segmented = resolveSegmentedTarget(variants, aliasVariant);
  if (!segmented.targetName || !segmented.targetVariant) {
    return null;
  }

  return {
    targetName: segmented.targetName,
    targetVariant: segmented.targetVariant,
    typeName: aliasType ?? meta.type_name,
  };
}

/**
 * Normalizes alias definitions into canonical forwarding metadata for legacy URL and bookmark compatibility.
 * @param {Object<string, string>} aliases Alias map from origin pattern to destination pattern.
 * @param {Object} meta Item metadata containing variants, recolors, and type naming.
 * @return {Array<{typeName: string, originVariant: string, forward: {typeName: string, name: string, variant: string}}>} Applied alias mappings.
 */
export function writeAliases(aliases, meta) {
  const appliedAliases = [];

  for (const [original, alias] of Object.entries(aliases)) {
    const [aliasVariant, aliasType] = alias.split("=").reverse();
    const [originVariant, originType] = original.split("=").reverse();
    const typeName = originType ?? meta.type_name;

    let forward = resolveNameWildcardAlias(
      originVariant,
      aliasVariant,
      aliasType,
      meta.type_name,
    );
    if (!forward) {
      const target = resolveAliasTarget(meta, aliasVariant, aliasType);
      if (target) {
        forward = {
          typeName: target.typeName,
          name: target.targetName,
          variant: target.targetVariant,
        };
      }
    }

    if (!forward) {
      debugWarn("Alias target does not exist for", alias);
      continue;
    }

    aliasMetadata[typeName] ??= {};
    aliasMetadata[typeName][originVariant] = forward;
    appliedAliases.push({ typeName, originVariant, forward });
  }

  return appliedAliases;
}

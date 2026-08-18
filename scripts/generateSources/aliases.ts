import type { AliasEntry } from "../../sources/state/catalog.ts";
import debugUtils from "../utils/debug.ts";
import { aliasMetadata } from "./state.ts";

const { debugWarn } = debugUtils;

export type AliasItemMeta = {
  type_name: string;
  name: string;
  variants?: string[];
  recolors?: Array<{ variants?: string[] }>;
};

export type AppliedAlias = {
  typeName: string;
  originVariant: string;
  forward: AliasEntry;
};

function getAliasVariants(meta: AliasItemMeta): string[] {
  if (meta.variants && meta.variants.length) {
    return meta.variants;
  }
  return meta.recolors![0]!.variants!;
}

function resolveSegmentedTarget(
  variants: string[],
  aliasVariant: string,
): { targetName: string; targetVariant: string } {
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

function resolveNameWildcardAlias(
  originVariant: string,
  aliasVariant: string,
  aliasType: string | undefined,
  defaultTypeName: string,
): AliasEntry | null {
  if (!originVariant.endsWith("_*") || !aliasVariant.endsWith("_*")) {
    return null;
  }
  return {
    typeName: aliasType ?? defaultTypeName,
    name: aliasVariant.slice(0, -2),
    variant: "*",
  };
}

function resolveAliasTarget(
  meta: AliasItemMeta,
  aliasVariant: string,
  aliasType: string | undefined,
): { targetName: string; targetVariant: string; typeName: string } | null {
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
 */
export function writeAliases(
  aliases: Record<string, string>,
  meta: AliasItemMeta,
): AppliedAlias[] {
  const appliedAliases: AppliedAlias[] = [];

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

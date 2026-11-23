import m from "mithril";
import { selectDefaults } from "./state.ts";
import type { Selection, Selections, State } from "./state.ts";
import { BODY_TYPES } from "./constants.ts";
import { parseRecolorKey } from "./palettes.ts";
import { debugWarn } from "../utils/debug.ts";
import {
  type AliasMetadata,
  type CatalogReader,
  type SlimByTypeNameRow,
} from "./catalog.ts";
import { resolveHashParamFromHashMatch } from "./resolve-hash-param.ts";

/**
 * Outcome of resolving a `typeName`/`nameAndVariant` pair against the
 * catalog. `foundItemId` is null when no match was made.
 */
type HashResolution = {
  foundItemId: string | null;
  matchedVariant: string;
  matchedRecolor: string;
};

function resolveHashParam(
  catalog: CatalogReader,
  input: { typeName: string; nameAndVariant: string },
): HashResolution {
  let itemsByTypeName: Record<string, SlimByTypeNameRow[]>;
  if (catalog.isIndexReady()) {
    const indexes = catalog.getMetadataIndexes().unwrapOr(null);
    itemsByTypeName =
      indexes?.hashMatch?.itemsByTypeName ?? indexes?.byTypeName ?? {};
  } else if (catalog.isLiteReady()) {
    itemsByTypeName = catalog.buildItemsByTypeNameFromRegisteredLite();
  } else {
    itemsByTypeName = {};
  }
  return resolveHashParamFromHashMatch({
    ...input,
    itemsByTypeName,
  });
}

export function updateState(state: State, updates: Partial<State>): void {
  Object.assign(state, updates);
}

export function resetState(state: State): void {
  state.bodyType = "male";
  state.selections = {};
}

// `window.location.hash` is immutable in tests, this is so we can use a stub to manage it.
let _hash = "";
let _setHashCalledTimes = 0;

/**
 * `window.isTesting` is set by browser test setup to route hash reads/writes
 * through the in-memory `_hash` rather than `window.location.hash` (the real
 * value is immutable in tests).
 */
type WindowWithTesting = Window & { isTesting?: boolean };
export type HashWriteMode = "push" | "replace";

export function getHash(): string {
  const w = window as WindowWithTesting;
  if (w.isTesting) return "#" + _hash;
  return window.location.hash;
}

export function setHash(hash: string, mode: HashWriteMode = "push"): void {
  const w = window as WindowWithTesting;
  if (w.isTesting) {
    _hash = hash[0] === "#" ? hash.substring(1) : hash;
    _setHashCalledTimes++;
    return;
  }
  if (mode === "replace") {
    const fragment = hash.startsWith("#") ? hash : "#" + hash;
    if (window.location.hash !== fragment) {
      window.history.replaceState(window.history.state, "", fragment);
    }
  } else {
    window.location.hash = hash;
  }
}

export function resetHashCalledTimes(): void {
  _setHashCalledTimes = 0;
}

export function getSetHashCalledTimes(): number {
  return _setHashCalledTimes;
}

// URL hash parameter management
export function getHashParams(): Record<string, string> {
  let hash = getHash().substring(1); // Remove '#'

  // Handle case where hash starts with '?' (some old URLs might have this)
  if (hash.startsWith("?")) {
    hash = hash.substring(1);
  }

  if (!hash) return {};

  return getHashParamsFromString(hash);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    debugWarn(`Malformed percent-encoding in URL hash segment: "${value}"`);
    return value;
  }
}

export function getHashParamsFromString(
  hashString: string,
): Record<string, string> {
  const params: Record<string, string> = {};
  hashString.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      // Remove leading '?' from key if present
      const cleanKey = key.startsWith("?") ? key.substring(1) : key;
      params[safeDecodeURIComponent(cleanKey)] = safeDecodeURIComponent(value);
    }
  });
  return params;
}

export function createHashStringFromParams(
  params: Record<string, string>,
): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export function setHashParams(params: Record<string, string>): void {
  const hash = createHashStringFromParams(params);
  setHash(hash);
}

export function buildNewSelection(
  catalog: CatalogReader,
  foundItemId: string,
  matchedVariant: string | null,
  matchedRecolor: string,
  subId: number | null = null,
): Selection {
  // Get meta data for itemId. Existing JS assumes meta is non-null at this
  // point (resolveHashParam returned a hit); preserve that contract.
  const metaResult = catalog.getItemLite(foundItemId);
  if (metaResult.isErr()) {
    throw new Error(
      `Resolved hash item is missing from catalog: ${foundItemId}`,
    );
  }
  const meta = metaResult.value;
  const subMeta = meta.recolors?.[subId ?? 0];

  const newSelection: Selection = {
    itemId: foundItemId,
    subId,
    variant:
      matchedVariant || (matchedRecolor != "" ? "" : meta.variants?.[0] || ""),
    recolor:
      matchedRecolor ||
      ((meta.variants?.length ?? 0) === 0 ? subMeta?.variants?.[0] || "" : ""),
    name: subId ? (subMeta?.label ?? "") : meta.name,
  };

  if (newSelection.variant || newSelection.recolor) {
    let recolorLabel: string | null | undefined = newSelection.recolor;
    if (recolorLabel) {
      const [, ver, recolor] = parseRecolorKey(
        catalog,
        newSelection.recolor ?? null,
        subMeta,
      );
      recolorLabel = ver !== subMeta?.default ? `${ver} ${recolor}` : recolor;
    }
    newSelection.name +=
      " (" +
      (newSelection.variant ? `${newSelection.variant}` : "") +
      (newSelection.variant && newSelection.recolor ? " | " : "") +
      (newSelection.recolor ? `${recolorLabel}` : "") +
      ")";
  }
  return newSelection;
}

export function getHashParamsforSelections(
  catalog: CatalogReader,
  selections: Selections,
  bodyType: string,
): Record<string, string> {
  const params: Record<string, string> = {};

  // Add body type (using 'sex' for backwards compatibility with old URLs).
  params.sex = bodyType;

  // Add selections — old format: `type_name=Name_variant`.
  // e.g., "body=Body_color_light", "shoes=Sara_sara".
  const aliasMetadata = catalog
    .getAliasMetadata()
    .unwrapOr({} as AliasMetadata);
  for (const [typeName, selection] of Object.entries(selections)) {
    const meta = catalog.getItemLite(selection.itemId).unwrapOr(null);
    // Defensive: real production data has type_name, but a few test fixtures
    // (and possibly malformed URLs) might lack it. Treat as alias-fallback.
    if (!meta || !meta.type_name) {
      // Check if an alias is overriding this entry
      // (e.g., "sash=Waistband_rose" instead of "waistband=Waistband_rose").
      const name = selection.name.split(" (")[0]; // Get base name without variant
      const nameAndVariant =
        name.replaceAll(" ", "_") +
        (selection.variant ? `_${selection.variant}` : "");
      const aliasType = aliasMetadata[typeName];
      if (!aliasType) continue;

      // Check name and variant
      const aliasMeta = aliasType?.[nameAndVariant];
      if (aliasMeta && aliasMeta.typeName) {
        params[aliasMeta.typeName] = `${aliasMeta.name}_${aliasMeta.variant}`;
      } else {
        // No exact match — check for type-name wildcard alias entry (`*`)
        // that applies to any name+variant.
        const anyAliasMeta = aliasType?.[`*`];
        if (!anyAliasMeta || !anyAliasMeta.typeName) {
          continue;
        }
        params[anyAliasMeta.typeName] = nameAndVariant;
      }
    } else {
      // Get sub-color metadata if applicable.
      const subMeta =
        selection.subId !== null && selection.subId !== undefined
          ? meta.recolors?.[selection.subId]
          : undefined;

      // Use `type_name` as key (selection group).
      const key = subMeta?.type_name ?? meta.type_name;

      // Build name part for URL using full name with underscores —
      // "Body color" → "Body_color", "Sara Shoes" → "Sara_Shoes".
      const namePart = (subMeta?.label ?? meta.name).replaceAll(" ", "_");

      const variantPart = selection.variant ?? "";
      const recolorPart = selection.recolor ?? "";
      const uscorePart = variantPart || recolorPart ? "_" : "";
      const splitPart = variantPart && recolorPart ? "|" : "";
      const value =
        namePart + uscorePart + variantPart + splitPart + recolorPart;

      params[key] = value;
    }
  }

  return params;
}

export function syncSelectionsToHash(
  catalog: CatalogReader,
  state: State,
  mode: HashWriteMode = "push",
): void {
  const hash = selectionHash(catalog, state);
  if (getHash() !== hash) setHash(hash, mode);
}

function selectionHash(catalog: CatalogReader, state: State): string {
  return (
    "#" +
    createHashStringFromParams(
      getHashParamsforSelections(catalog, state.selections, state.bodyType),
    )
  );
}

function isValidBodyType(value: string): boolean {
  return (BODY_TYPES as readonly string[]).includes(value);
}

/** The app serializes an intentionally empty outfit as only a body type. */
export function isEmptyOutfitHash(hash: string): boolean {
  const fragment = hash.replace(/^#\??/, "");
  return BODY_TYPES.some((bodyType) => fragment === `sex=${bodyType}`);
}

/** Profiler hook is a global injected by the test harness; absent in production. */
type Profiler = {
  mark: (name: string) => void;
  measure: (name: string, start: string, end: string) => void;
};
type WindowWithProfiler = Window & { profiler?: Profiler };

export function loadSelectionsFromHash(
  catalog: CatalogReader,
  state: State,
  hashString: string | null = null,
  mode: HashWriteMode = "push",
): void {
  const profiler = (window as WindowWithProfiler).profiler;
  if (profiler) {
    profiler.mark("hash-loadSelectionsFromHash:start");
  }

  const params = hashString
    ? getHashParamsFromString(hashString)
    : getHashParams();

  // Build new selections object without mutating state yet.
  const newSelections: Selections = {};
  const skippedEntries: Record<string, string> = {};

  // Old format: `type_name=Name_variant`
  // (e.g., "body=Body_color_light", "sash=Waistband_rose").
  for (let [typeName, nameAndVariant] of Object.entries(params)) {
    // Handle special parameters
    if (typeName === "bodyType" || typeName === "sex") {
      if (isValidBodyType(nameAndVariant)) {
        state.bodyType = nameAndVariant;
      } else {
        debugWarn(`Ignoring invalid bodyType in URL hash: "${nameAndVariant}"`);
      }
      continue;
    }

    // Check name and variant
    const aliasMd = catalog.getAliasMetadata().unwrapOr({} as AliasMetadata);
    const aliasType = aliasMd[typeName];
    const aliasMeta = aliasType?.[nameAndVariant];
    if (aliasMeta) {
      typeName = aliasMeta.typeName;
      nameAndVariant = `${aliasMeta.name}_${aliasMeta.variant}`;
    } else {
      // No exact match — check for a type-name wildcard alias.
      const anyAliasMeta = aliasType?.[`*`];
      if (anyAliasMeta) {
        typeName = anyAliasMeta.typeName;
        // Keep the original `nameAndVariant` since the wildcard alias
        // can match any variant.
      } else if (aliasType) {
        // No type wildcard — scan for name-wildcard aliases (e.g., "Fur_Pants_*").
        // The stored key ends with "_*"; strip the "*" to get the prefix to match against.
        for (const [pattern, patternMeta] of Object.entries(aliasType)) {
          if (!pattern.endsWith("_*")) continue;
          const prefix = pattern.slice(0, -1); // "Fur_Pants_" (keep trailing "_")
          if (nameAndVariant.startsWith(prefix)) {
            typeName = patternMeta.typeName;
            nameAndVariant =
              patternMeta.name + "_" + nameAndVariant.slice(prefix.length);
            break;
          }
        }
      }
    }

    // Skip "none" selections
    if (nameAndVariant === "none") continue;

    // Parse the `Name_variant` format by trying different split positions
    // from left to right to find a valid name+variant combination:
    //   "Tiara_tiara_silver"  →  "Tiara" + "tiara_silver"  ✓
    //   "Human_female_light"  →  "Human_female" + "light"  ✓
    //   "Human_female_light|light"  →  "Human_female" + "light" + "light"  ✓
    const { foundItemId, matchedVariant, matchedRecolor } = resolveHashParam(
      catalog,
      { typeName, nameAndVariant },
    );

    if (!foundItemId) {
      skippedEntries[typeName] = nameAndVariant;
      continue;
    }

    // Use `type_name` as selection group.
    newSelections[typeName] = buildNewSelection(
      catalog,
      foundItemId,
      matchedVariant,
      matchedRecolor,
    );
  }

  // Check if skipped entries are sub-items.
  if (profiler) {
    profiler.mark("hash-loadSelectionsFromHash:subitems:start");
  }

  const subItemKeySeparator = " ";
  const subItemLookup = new Map<string, { itemId: string; subId: number }>();
  for (const selection of Object.values(newSelections)) {
    const recolors = catalog
      .getItemLite(selection.itemId)
      .unwrapOr(null)?.recolors;
    if (!Array.isArray(recolors)) continue;

    for (let recolorIndex = 0; recolorIndex < recolors.length; recolorIndex++) {
      const recolor = recolors[recolorIndex];
      if (!recolor?.type_name || !Array.isArray(recolor.variants)) continue;

      for (const recolorVariant of recolor.variants) {
        const lookupKey = `${recolor.type_name}${subItemKeySeparator}${recolorVariant}`;
        if (!subItemLookup.has(lookupKey)) {
          subItemLookup.set(lookupKey, {
            itemId: selection.itemId,
            subId: recolorIndex,
          });
        }
      }
    }
  }

  // Insert selections for skipped entries that might be sub-items.
  for (const [subType, nameAndVariant] of Object.entries(skippedEntries)) {
    let matchedSubItem = false;
    const parts = nameAndVariant.split("_");
    for (let i = 1; i <= parts.length; i++) {
      const variants = parts.slice(i).join("_");
      const recolorToMatch = variants.split("|")[1] ?? variants.split("|")[0];
      const lookupKey = `${subType}${subItemKeySeparator}${recolorToMatch}`;
      const subItem = subItemLookup.get(lookupKey);

      if (subItem) {
        newSelections[subType] = buildNewSelection(
          catalog,
          subItem.itemId,
          null,
          recolorToMatch,
          subItem.subId,
        );
        matchedSubItem = true;
        break;
      }
    }

    if (!matchedSubItem) {
      debugWarn(
        `No item found with type_name "${subType}" and nameAndVariant "${nameAndVariant}"`,
      );
    }
  }

  if (profiler) {
    profiler.mark("hash-loadSelectionsFromHash:subitems:end");
    profiler.measure(
      "hash-loadSelectionsFromHash:subitems",
      "hash-loadSelectionsFromHash:subitems:start",
      "hash-loadSelectionsFromHash:subitems:end",
    );
  }

  // Now update state once with complete new selections.
  state.selections = newSelections;

  // Load body type
  if (params.bodyType && isValidBodyType(params.bodyType)) {
    state.bodyType = params.bodyType;
  }
  if (!isValidBodyType(state.bodyType)) {
    state.bodyType = BODY_TYPES[0];
  }

  // Ensure hash is in sync with loaded selections (handles any normalization).
  syncSelectionsToHash(catalog, state, mode);

  if (profiler) {
    profiler.mark("hash-loadSelectionsFromHash:end");
    profiler.measure(
      "hash-loadSelectionsFromHash",
      "hash-loadSelectionsFromHash:start",
      "hash-loadSelectionsFromHash:end",
    );
  }
}

/** Wire up the browser hashchange event. */
export function initHashChangeListener(
  catalog: CatalogReader,
  state: State,
  listener?: () => void,
): void {
  if (listener) {
    window.addEventListener("hashchange", listener);
    return;
  }

  // Listen for browser back/forward navigation.
  window.addEventListener("hashchange", async function () {
    const currentHash = getHash();
    if (currentHash.length > 1 && !currentHash.includes("=")) return;
    if (currentHash === selectionHash(catalog, state)) return;

    if (state.isExportingZip) {
      state.pendingPostZipHash = currentHash;
      return;
    }

    // Normalize old URLs in the entry being restored.
    loadSelectionsFromHash(catalog, state, currentHash.slice(1), "replace");
    if (
      Object.keys(state.selections).length === 0 &&
      !isEmptyOutfitHash(currentHash)
    ) {
      await selectDefaults(state, "replace");
      return;
    }

    // Trigger redraw which calls `App.onupdate` (syncs hash and renders canvas).
    m.redraw();
  });
}

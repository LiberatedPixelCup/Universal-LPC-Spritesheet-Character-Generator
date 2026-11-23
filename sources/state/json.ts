import { ANIMATIONS, BODY_TYPES, LICENSE_CONFIG } from "./constants.ts";
import {
  buildNewSelection,
  createHashStringFromParams,
  getHashParamsforSelections,
  loadSelectionsFromHash,
} from "./hash.ts";
import { getAllCredits } from "../utils/credits.ts";
import type { Selection, Selections, State } from "./state.ts";
import type { DrawCall } from "../canvas/renderer.ts";
import type { CatalogReader } from "./catalog.ts";
import { normalizeVariantForHashMatch } from "./resolve-hash-param.ts";

/** Shape of a layer as it appears in the exported `character.json` manifest.
 *  The live `HTMLImageElement` carried by `DrawCall.source` for custom uploads
 *  is dropped, and the catalog `spritePath` is rewritten as a path relative to
 *  the asset root (no `spritesheets/` URL prefix). */
type SerializedLayerSource =
  { kind: "catalog"; spritePath: string } | { kind: "custom" };

export type SerializedLayer = {
  itemId: string;
  name?: string;
  variant: string | null;
  recolors?: DrawCall["recolors"];
  zPos: number;
  layerNum: number;
  yPos: number;
  needsRecolor?: boolean;
  source: SerializedLayerSource;
  supportedAnimations: string[];
};

/**
 * Build the per-layer JSON manifest from the renderer's flat draw-call list.
 * Deduplicates by `(itemId, layerNum)` — each unique layer appears once with
 * its `supportedAnimations` aggregated from the draw calls that referenced it.
 */
export function serializeLayersForJson(
  draws: readonly DrawCall[],
): SerializedLayer[] {
  const out: SerializedLayer[] = [];
  for (const draw of draws) {
    const existing = out.find(
      (l) => l.itemId === draw.itemId && l.layerNum === draw.layerNum,
    );
    if (existing) {
      existing.supportedAnimations.push(draw.animation);
      continue;
    }
    const source: SerializedLayerSource =
      draw.source.kind === "catalog"
        ? {
            kind: "catalog",
            spritePath: draw.source.spritePath.substring(
              "spritesheets/".length,
            ),
          }
        : { kind: "custom" };
    out.push({
      itemId: draw.itemId,
      name: draw.name,
      variant: draw.variant,
      recolors: draw.recolors,
      zPos: draw.zPos,
      layerNum: draw.layerNum,
      yPos: draw.yPos,
      needsRecolor: draw.needsRecolor,
      source,
      supportedAnimations: [draw.animation],
    });
  }
  return out;
}

type CreditsByFile = ReturnType<typeof getAllCredits>;

type JsonDeps = {
  createHashStringFromParams: (params: Record<string, string>) => string;
  getHashParamsforSelections: (
    catalog: CatalogReader,
    selections: Selections,
    bodyType: string,
  ) => Record<string, string>;
  loadSelectionsFromHash: (
    catalog: CatalogReader,
    state: State,
    hashString?: string | null,
  ) => void;
  getAllCredits: (
    catalog: CatalogReader,
    selections: Selections,
    bodyType: string,
  ) => CreditsByFile;
  getLocationOrigin: () => string;
  getLocationPathname: () => string;
};

// Dependency injection for testability (see setJsonDeps / resetJsonDeps)
function createDefaultJsonDeps(): JsonDeps {
  return {
    createHashStringFromParams,
    getHashParamsforSelections,
    loadSelectionsFromHash,
    getAllCredits,
    getLocationOrigin: () => window.location.origin,
    getLocationPathname: () => window.location.pathname,
  };
}

let jsonDeps: JsonDeps = createDefaultJsonDeps();

export function setJsonDeps(overrides: Partial<JsonDeps>): void {
  Object.assign(jsonDeps, overrides);
}

export function resetJsonDeps(): void {
  jsonDeps = createDefaultJsonDeps();
}

export function getJsonDeps(): JsonDeps {
  return jsonDeps;
}

/**
 * Export current state as JSON string.
 *
 * `layers` is opaque here — passed through verbatim into the exported document.
 * The production caller (`Download.ts` → `renderer.ts`'s `layers`) and the
 * tests pass differently-shaped objects, so the only contract this function
 * needs is "an array of JSON-serializable values."
 */
export function exportStateAsJSON(
  catalog: CatalogReader,
  state: State,
  layers: readonly unknown[],
): string {
  const hash = jsonDeps.createHashStringFromParams(
    jsonDeps.getHashParamsforSelections(
      catalog,
      state.selections,
      state.bodyType,
    ),
  );
  const url = `${jsonDeps.getLocationOrigin()}${jsonDeps.getLocationPathname()}#${hash}`;
  const exportedState = {
    version: 2,
    bodyType: state.bodyType,
    selections: state.selections,
    selectedAnimation: state.selectedAnimation,
    showTransparencyGrid: state.showTransparencyGrid,
    applyTransparencyMask: state.applyTransparencyMask,
    matchBodyColorEnabled: state.matchBodyColorEnabled,
    compactDisplay: state.compactDisplay,
    enabledLicenses: state.enabledLicenses,
    enabledAnimations: state.enabledAnimations,
    url,
    layers,
    credits: jsonDeps.getAllCredits(catalog, state.selections, state.bodyType),
  };
  return JSON.stringify(exportedState, null, 2);
}

type ImportedV2 = {
  version: 2;
  bodyType: string;
  selections: Selections;
  selectedAnimation?: string;
  showTransparencyGrid?: boolean;
  applyTransparencyMask?: boolean;
  matchBodyColorEnabled?: boolean;
  compactDisplay?: boolean;
  enabledLicenses?: Record<string, boolean>;
  enabledAnimations?: Record<string, boolean>;
};

type ImportedV1 = {
  version: 1;
  url: string;
};

type ImportedState = ImportedV2 | ImportedV1;

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const VALID_LICENSE_KEYS: ReadonlySet<string> = new Set(
  LICENSE_CONFIG.map((license) => license.key),
);
const VALID_ANIMATION_KEYS: ReadonlySet<string> = new Set(
  ANIMATIONS.map((animation) => animation.value),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function sanitizeSelections(value: unknown): Selections | null {
  if (!isPlainObject(value)) return null;
  const cleaned: Selections = {};
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (!isPlainObject(entry) || typeof entry.itemId !== "string") {
      return null;
    }
    if (
      !isValidOptionalString(entry.name) ||
      !isValidOptionalString(entry.variant) ||
      !isValidOptionalString(entry.recolor) ||
      (entry.subId !== undefined &&
        entry.subId !== null &&
        typeof entry.subId !== "number")
    ) {
      return null;
    }
    cleaned[key] = { ...entry } as Selection;
  }
  return cleaned;
}

/**
 * Older v2 exports stored palette colors in the sprite variant field.
 * Move only catalog-confirmed colors and preserve real sprite variants.
 */
function normalizeLegacyColors(
  catalog: CatalogReader,
  selections: Selections,
): void {
  for (const selection of Object.values(selections)) {
    if (selection.subId || !selection.variant || selection.recolor) continue;
    const item = catalog.getItemLite(selection.itemId).unwrapOr(null);
    const palette = item?.recolors?.[0];
    if (!item || !palette) continue;

    const legacyKey = normalizeVariantForHashMatch(selection.variant);
    const matches = (key: string) =>
      normalizeVariantForHashMatch(key) === legacyKey;
    if (item.variants?.some(matches)) continue;
    const color = palette.variants?.find(matches);
    if (!color) continue;

    const normalized = buildNewSelection(
      catalog,
      selection.itemId,
      null,
      color,
    );
    selection.variant = normalized.variant;
    selection.recolor = normalized.recolor;
    selection.name = normalized.name;
  }
}

function sanitizeBooleanRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, boolean> | null {
  if (!isPlainObject(value)) return null;
  const cleaned: Record<string, boolean> = {};
  for (const [key, flag] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof flag !== "boolean") return null;
    if (!allowedKeys.has(key)) continue;
    cleaned[key] = flag;
  }
  return cleaned;
}

function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("Invalid JSON format");
  return value;
}

/**
 * Import state from JSON string using the supplied catalog. Returns a partial
 * state for v2 documents; for v1 (legacy URL-only exports) it calls into
 * `loadSelectionsFromHash` and returns `undefined`. Throws on malformed JSON
 * or unsupported versions.
 */
export function importStateFromJSON(
  catalog: CatalogReader,
  state: State,
  jsonString: string,
): Partial<State> | undefined {
  try {
    const parsed: unknown = JSON.parse(jsonString);
    if (!isPlainObject(parsed) || typeof parsed.version !== "number") {
      throw new Error("Invalid JSON format");
    }
    const importedState = parsed as ImportedState;
    if (importedState.version === 2) {
      const validBodyType =
        typeof importedState.bodyType === "string" &&
        (BODY_TYPES as readonly string[]).includes(importedState.bodyType);
      const selections = sanitizeSelections(importedState.selections);
      if (!validBodyType || !selections) {
        throw new Error("Invalid JSON format");
      }
      if (
        importedState.selectedAnimation !== undefined &&
        typeof importedState.selectedAnimation !== "string"
      ) {
        throw new Error("Invalid JSON format");
      }
      const parsedLicenses =
        importedState.enabledLicenses === undefined
          ? state.enabledLicenses
          : sanitizeBooleanRecord(
              importedState.enabledLicenses,
              VALID_LICENSE_KEYS,
            );
      const enabledAnimations =
        importedState.enabledAnimations === undefined
          ? state.enabledAnimations
          : sanitizeBooleanRecord(
              importedState.enabledAnimations,
              VALID_ANIMATION_KEYS,
            );
      if (!parsedLicenses || !enabledAnimations) {
        throw new Error("Invalid JSON format");
      }
      const enabledLicenses =
        Object.keys(parsedLicenses).length > 0
          ? parsedLicenses
          : state.enabledLicenses;
      const newState: Partial<State> = {
        bodyType: importedState.bodyType,
        selections,
        selectedAnimation:
          importedState.selectedAnimation ?? state.selectedAnimation,
        showTransparencyGrid: readOptionalBoolean(
          importedState.showTransparencyGrid,
          state.showTransparencyGrid,
        ),
        applyTransparencyMask: readOptionalBoolean(
          importedState.applyTransparencyMask,
          state.applyTransparencyMask,
        ),
        matchBodyColorEnabled: readOptionalBoolean(
          importedState.matchBodyColorEnabled,
          state.matchBodyColorEnabled,
        ),
        compactDisplay: readOptionalBoolean(
          importedState.compactDisplay,
          state.compactDisplay,
        ),
        enabledLicenses,
        enabledAnimations,
      };
      normalizeLegacyColors(catalog, selections);
      return newState;
    } else if (importedState.version === 1) {
      if (typeof importedState.url !== "string" || !importedState.url) {
        throw new Error("Invalid JSON format");
      }
      const url = new URL(importedState.url);
      const hash = url.hash.toString().substring(1);
      jsonDeps.loadSelectionsFromHash(catalog, state, hash);
      return undefined;
    } else {
      throw new Error("Unsupported version");
    }
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    throw err;
  }
}

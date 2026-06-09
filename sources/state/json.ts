import {
  createHashStringFromParams,
  getHashParamsforSelections,
  loadSelectionsFromHash,
} from "./hash.ts";
import { getAllCredits } from "../utils/credits.ts";
import { state } from "./state.ts";
import type { Selections, State } from "./state.ts";
import type { DrawCall } from "../canvas/renderer.ts";
import type { CatalogReader } from "./catalog.ts";

/** Shape of a layer as it appears in the exported `character.json` manifest.
 *  The live `HTMLImageElement` carried by `DrawCall.source` for custom uploads
 *  is dropped, and the catalog `spritePath` is rewritten as a path relative to
 *  the asset root (no `spritesheets/` URL prefix). */
type SerializedLayerSource =
  | { kind: "catalog"; spritePath: string }
  | { kind: "custom" };

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
  ) => Record<string, string>;
  loadSelectionsFromHash: (hashString?: string | null) => void;
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
 * The production caller (`Download.js` → `renderer.js`'s `layers`) and the
 * tests pass differently-shaped objects, so the only contract this function
 * needs is "an array of JSON-serializable values."
 */
export function exportStateAsJSON(
  catalog: CatalogReader,
  state: State,
  layers: readonly unknown[],
): string {
  const hash = jsonDeps.createHashStringFromParams(
    jsonDeps.getHashParamsforSelections(catalog, state.selections),
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

/**
 * Import state from JSON string. Returns a partial state for v2 documents; for
 * v1 (legacy URL-only exports) it calls into `loadSelectionsFromHash` and
 * returns `undefined`. Throws on malformed JSON or unsupported versions.
 */
export function importStateFromJSON(
  jsonString: string,
): Partial<State> | undefined {
  try {
    const importedState = JSON.parse(jsonString) as ImportedState;
    if (
      !importedState.version ||
      (importedState.version === 1 && !importedState.url) ||
      (importedState.version === 2 &&
        (!importedState.bodyType || !importedState.selections))
    ) {
      throw new Error("Invalid JSON format");
    }
    if (importedState.version === 2) {
      const newState: Partial<State> = {
        bodyType: importedState.bodyType,
        selections: importedState.selections,
        selectedAnimation:
          importedState.selectedAnimation ?? state.selectedAnimation,
        showTransparencyGrid:
          importedState.showTransparencyGrid ?? state.showTransparencyGrid,
        applyTransparencyMask:
          importedState.applyTransparencyMask ?? state.applyTransparencyMask,
        matchBodyColorEnabled:
          importedState.matchBodyColorEnabled ?? state.matchBodyColorEnabled,
        compactDisplay: importedState.compactDisplay ?? state.compactDisplay,
        enabledLicenses: importedState.enabledLicenses ?? state.enabledLicenses,
        enabledAnimations:
          importedState.enabledAnimations ?? state.enabledAnimations,
      };
      return newState;
    } else if (importedState.version === 1) {
      const url = new URL(importedState.url);
      const hash = url.hash.toString().substring(1);
      jsonDeps.loadSelectionsFromHash(hash);
      return undefined;
    } else {
      throw new Error("Unsupported version");
    }
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    throw err;
  }
}

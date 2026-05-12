import {
  createHashStringFromParams,
  getHashParamsforSelections,
  loadSelectionsFromHash,
} from "./hash.ts";
import { getAllCredits } from "../utils/credits.ts";
import { state } from "./state.ts";
import type { Selections, State } from "./state.ts";

type CreditsByFile = ReturnType<typeof getAllCredits>;

type JsonDeps = {
  createHashStringFromParams: (params: Record<string, string>) => string;
  getHashParamsforSelections: (
    selections: Selections,
  ) => Record<string, string>;
  loadSelectionsFromHash: (hashString?: string | null) => void;
  getAllCredits: (selections: Selections, bodyType: string) => CreditsByFile;
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
  state: State,
  layers: readonly unknown[],
): string {
  const hash = jsonDeps.createHashStringFromParams(
    jsonDeps.getHashParamsforSelections(state.selections),
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
    credits: jsonDeps.getAllCredits(state.selections, state.bodyType),
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

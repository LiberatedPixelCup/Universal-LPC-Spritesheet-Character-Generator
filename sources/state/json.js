import {
  createHashStringFromParams,
  getHashParamsforSelections,
  loadSelectionsFromHash,
} from "./hash.ts";
import { getAllCredits } from "../utils/credits.ts";
import { state } from "./state.ts";

// Dependency injection for testability (see setJsonDeps / resetJsonDeps)
function createDefaultJsonDeps() {
  return {
    createHashStringFromParams,
    getHashParamsforSelections,
    loadSelectionsFromHash,
    getAllCredits,
    getLocationOrigin: () => window.location.origin,
    getLocationPathname: () => window.location.pathname,
  };
}

let jsonDeps = createDefaultJsonDeps();

export function setJsonDeps(overrides) {
  Object.assign(jsonDeps, overrides);
}

export function resetJsonDeps() {
  jsonDeps = createDefaultJsonDeps();
}

export function getJsonDeps() {
  return jsonDeps;
}

/**
 * Export current state as JSON string
 */
export function exportStateAsJSON(state, layers) {
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

/**
 * Import state from JSON string
 */
export function importStateFromJSON(jsonString) {
  try {
    const importedState = JSON.parse(jsonString);
    if (
      !importedState.version ||
      (importedState.version === 1 && !importedState.url) ||
      (importedState.version === 2 &&
        (!importedState.bodyType || !importedState.selections))
    ) {
      throw new Error("Invalid JSON format");
    }
    if (importedState.version === 2) {
      const newState = {
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
    } else {
      throw new Error("Unsupported version");
    }
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    throw err;
  }
}

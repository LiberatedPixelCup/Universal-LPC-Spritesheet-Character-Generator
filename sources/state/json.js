import { createHashStringFromParams, getHashParamsforSelections, loadSelectionsFromHash } from "./hash.js";
import { getAllCredits } from "../utils/credits.js";
import { state } from "../state/state.js";

/**
 * Export current state as JSON string
 */
export function exportStateAsJSON(state, layers) {
	const hash = createHashStringFromParams(getHashParamsforSelections(state.selections));
	const url = `${window.location.origin}${window.location.pathname}#${hash}`;
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
		credits: getAllCredits(state.selections, state.bodyType),
	};
	return JSON.stringify(exportedState, null, 2);
}

/**
 * Import state from JSON string
 */
export function importStateFromJSON(jsonString) {
	try {
		const importedState = JSON.parse(jsonString);
		if (!importedState.version || 
			(importedState.version === 1 && !importedState.url) ||
			(importedState.version === 2 && (!importedState.bodyType || !importedState.selections))) {
			throw new Error("Invalid JSON format");
		}
		if (importedState.version === 2) {
			const newState = {
				bodyType: importedState.bodyType,
				selections: importedState.selections,
				selectedAnimation: importedState.selectedAnimation ?? state.selectedAnimation,
				showTransparencyGrid: importedState.showTransparencyGrid ?? state.showTransparencyGrid,
				applyTransparencyMask: importedState.applyTransparencyMask ?? state.applyTransparencyMask,
				matchBodyColorEnabled: importedState.matchBodyColorEnabled ?? state.matchBodyColorEnabled,
				compactDisplay: importedState.compactDisplay ?? state.compactDisplay,
				enabledLicenses: importedState.enabledLicenses ?? state.enabledLicenses,
				enabledAnimations: importedState.enabledAnimations ?? state.enabledAnimations,
			};
			return newState;
		} else if (importedState.version === 1) {
			const url = new URL(importedState.url);
			const hash = url.hash.toString().substring(1);
			loadSelectionsFromHash(hash);
		} else {
			throw new Error("Unsupported version");
		}
	} catch (err) {
		console.error("Failed to parse JSON:", err);
		throw err;
	}
}

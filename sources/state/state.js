// Global state and state operations
import { LICENSE_CONFIG, ANIMATIONS } from "./constants.js";
import { syncSelectionsToHash, loadSelectionsFromHash } from "./hash.js";
import { renderCharacter } from "../canvas/renderer.js";

// Global state
export const state = {
	// state that is saved in url hash
	selections: {}, // key: selectionGroup, value: { itemId, variant, name }
	bodyType: "male", // male, female, teen, child, muscular, pregnant

	// State that is currently not saved but could be in future
	selectedAnimation: "walk",
	expandedNodes: {}, // key: path string, value: boolean (true if expanded)
	searchQuery: "", // current search query
	showTransparencyGrid: true, // show checkered transparency background
	applyTransparencyMask: false, // apply transparency mask to previews
	matchBodyColorEnabled: true, // auto-match body color to other items (default: enabled)
	compactDisplay: false, // compact item variant display (smaller thumbnails)
	customUploadedImage: null, // custom uploaded image (Image object)
	customImageZPos: 0, // z-position for custom uploaded image
	previewCanvasZoomLevel: 1, // zoom level for animation preview canvas
	fullSpritesheetCanvasZoomLevel: 1, // zoom level for full spritesheet preview canvas
	// License filters - all enabled by default (derived from LICENSE_CONFIG)
	enabledLicenses: Object.fromEntries(
		LICENSE_CONFIG.map((lic) => [lic.key, true]),
	),
	// Animation filters - all disabled by default (filter only active when at least one is checked)
	enabledAnimations: Object.fromEntries(
		ANIMATIONS.map((anim) => [anim.value, false]),
	),

	// Following transient state should never be saved
	zipByAnimation: {
		isRunning: false,
	},
	zipByItem: {
		isRunning: false,
	},
	zipByAnimimationAndItem: {
		isRunning: false,
	},
	zipIndividualFrames: {
		isRunning: false,
	}
};

// Helper function to get selection group from itemId
// Selection group = type_name (e.g., "body", "heads", "ears")
// This ensures only one item per type can be selected (mimics old radio button behavior)
export function getSelectionGroup(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.type_name) return itemId;
	return meta.type_name;
}

// Select default items (body color light + human male light head)
export async function selectDefaults() {
	// Set default body color (light)
	// itemId is now based on filename (e.g., "body")
	const bodyItemId = "body";
	const bodySelectionGroup = getSelectionGroup(bodyItemId);
	state.selections[bodySelectionGroup] = {
		itemId: bodyItemId,
		variant: "light",
		name: "Body color (light)",
	};

	// Set default head (human male light)
	// itemId is now based on filename (e.g., "heads_human_male")
	const headItemId = "heads_human_male";
	const headSelectionGroup = getSelectionGroup(headItemId);
	state.selections[headSelectionGroup] = {
		itemId: headItemId,
		variant: "light",
		name: "Human male (light)",
	};

	// Set default expression (neutral light)
	const expressionItemId = "face_neutral";
	const expressionSelectionGroup = getSelectionGroup(expressionItemId);
	state.selections[expressionSelectionGroup] = {
		itemId: expressionItemId,
		variant: "light",
		name: "Neutral (light)",
	};

	// Update URL hash
	syncSelectionsToHash();

	await renderCharacter(state.selections, state.bodyType);

	// Trigger redraw to update preview canvas after offscreen render completes
	m.redraw();
}

// Reset all selections and restore defaults
export async function resetAll() {
	state.selections = {};
	state.customUploadedImage = null;
	state.customImageZPos = 0;
	await selectDefaults();
	m.redraw();
}

// Apply match body color - when any body-colored part changes, update all items with matchBodyColor: true
export function applyMatchBodyColor(variantToMatch) {
	// Only apply if feature is enabled
	if (!state.matchBodyColorEnabled) return;

	// If no variant specified, nothing to match
	if (!variantToMatch) return;

	// Update all selected items that have matchBodyColor: true
	for (const [selectionGroup, selection] of Object.entries(
		state.selections,
	)) {
		const itemId = selection.itemId;
		const meta = window.itemMetadata?.[itemId];

		// Skip if no metadata or matchBodyColor is not enabled for this item
		if (!meta || !meta.matchBodyColor) continue;

		// Check if this item has the variant available
		if (meta.variants && meta.variants.includes(variantToMatch)) {
			// Update the variant to match
			selection.variant = variantToMatch;
			selection.name = meta.name + ` (${variantToMatch})`;
		}
	}
}

// Initialize state with defaults or from URL
export async function initState() {
	// First, try to load from URL hash
	loadSelectionsFromHash();

	// If nothing in hash, set defaults
	if (Object.keys(state.selections).length === 0) {
		await selectDefaults();
	} else {
		// Render with loaded selections
		if (window.canvasRenderer) {
			await renderCharacter(state.selections, state.bodyType);

			// Trigger redraw to update preview canvas after offscreen render completes
			m.redraw();
		}
	}
}

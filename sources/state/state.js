// Global state and state operations
import { LICENSE_CONFIG, ANIMATIONS } from "./constants.js";
import { syncSelectionsToHash, loadSelectionsFromHash } from "./hash.js";
import { renderCharacter } from "../canvas/renderer.js";

// Global state
export const state = {
	selections: {}, // key: selectionGroup, value: { itemId, variant, name }
	bodyType: "male", // male, female, teen, child, muscular, pregnant
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

// Helper function to get all allowed license strings (expanded from categories)
function getAllowedLicenses() {
	const allowed = [];
	for (const license of LICENSE_CONFIG) {
		if (state.enabledLicenses[license.key]) {
			allowed.push(...license.versions);
		}
	}
	return allowed;
}

// Helper function to check if an item is compatible with selected licenses
export function isItemLicenseCompatible(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.credits || meta.credits.length === 0) return true; // No license info = assume compatible

	const allowedLicenses = getAllowedLicenses();
	if (allowedLicenses.length === 0) return false; // No licenses selected = nothing compatible

	// Create normalized Set for fast lookup
	const allowedSet = new Set(allowedLicenses.map((l) => l.trim()));

	// Check if item has at least one credit with a compatible license
	for (const credit of meta.credits) {
		if (credit.licenses && credit.licenses.length > 0) {
			const hasCompatibleLicense = credit.licenses.some((license) =>
				allowedSet.has(license.trim()),
			);
			if (hasCompatibleLicense) return true;
		}
	}

	return false;
}

// Helper function to check if an item is compatible with selected animations
export function isItemAnimationCompatible(itemId) {
	// Get list of enabled animations
	const enabledAnims = ANIMATIONS.filter(
		(anim) => state.enabledAnimations[anim.value],
	).map((anim) => anim.value);

	// If no animations are selected, filter is disabled - show all items
	if (enabledAnims.length === 0) return true;

	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.animations || meta.animations.length === 0) return true; // No animation info = assume compatible

	// Check if item supports at least one enabled animation
	for (const itemAnim of meta.animations) {
		if (enabledAnims.includes(itemAnim)) return true;
	}

	return false;
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

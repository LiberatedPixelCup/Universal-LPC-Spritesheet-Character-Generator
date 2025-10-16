// Global state and state operations
import { LICENSE_CONFIG, ANIMATIONS } from './constants.js';

// Global state
export const state = {
	selections: {}, // key: selectionGroup, value: { itemId, variant, name }
	bodyType: "male", // male, female, teen, child, muscular, pregnant
	expandedNodes: {}, // key: path string, value: boolean (true if expanded)
	searchQuery: "", // current search query
	showTransparencyGrid: true, // show checkered transparency background
	matchBodyColorEnabled: false, // auto-match body color to other items (default: disabled)
	compactDisplay: false, // compact item variant display (smaller thumbnails)
	customUploadedImage: null, // custom uploaded image (Image object)
	customImageZPos: 0, // z-position for custom uploaded image
	previewCanvasZoomLevel: 1, // zoom level for animation preview canvas
	fullSpritesheetCanvasZoomLevel: 1, // zoom level for full spritesheet preview canvas
	// License filters - all enabled by default (derived from LICENSE_CONFIG)
	enabledLicenses: Object.fromEntries(
		LICENSE_CONFIG.map(lic => [lic.key, true])
	),
	// Animation filters - all disabled by default (filter only active when at least one is checked)
	enabledAnimations: Object.fromEntries(
		ANIMATIONS.map(anim => [anim.value, false])
	)
};

// Helper function to get selection group from itemId
// Selection group = type_name (e.g., "body", "heads", "ears")
// This ensures only one item per type can be selected (mimics old radio button behavior)
export function getSelectionGroup(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.type_name) return itemId;
	return meta.type_name;
}

// URL hash parameter management
export function getHashParams() {
	let hash = window.location.hash.substring(1); // Remove '#'

	// Handle case where hash starts with '?' (some old URLs might have this)
	if (hash.startsWith('?')) {
		hash = hash.substring(1);
	}

	if (!hash) return {};

	const params = {};
	hash.split('&').forEach(pair => {
		const [key, value] = pair.split('=');
		if (key && value) {
			// Remove leading '?' from key if present
			const cleanKey = key.startsWith('?') ? key.substring(1) : key;
			params[decodeURIComponent(cleanKey)] = decodeURIComponent(value);
		}
	});
	return params;
}

export function setHashParams(params) {
	const hash = Object.entries(params)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
	window.location.hash = hash;
}

export function getHashParamsforSelections(selections) {
	const params = {};

	// Add body type (using 'sex' for backwards compatibility with old URLs)
	params.sex = state.bodyType;

	// Add selections - use old format: type_name=Name_variant
	// Format: "body=Body_color_light", "shoes=Sara_sara"
	for (const [selectionGroup, selection] of Object.entries(selections)) {
		const meta = window.itemMetadata?.[selection.itemId];
		if (!meta || !meta.type_name) continue;

		// Use type_name as key (selection group)
		const key = meta.type_name;

		// Build name part for URL: use full name with underscores
		// "Body color" -> "Body_color", "Sara Shoes" -> "Sara_Shoes", "Waistband" -> "Waistband"
		const namePart = meta.name.replaceAll(' ', '_');

		const variantPart = selection.variant ? `_${selection.variant}` : '';
		const value = namePart + variantPart;

		params[key] = value;
	}

	return params;
}

export function syncSelectionsToHash() {
	const params = getHashParamsforSelections(state.selections);
	setHashParams(params);
}

export function loadSelectionsFromHash() {
	const params = getHashParams();

	// Build new selections object without mutating state yet
	const newSelections = {};

	// Load selections
	// Old format: type_name=Name_variant (e.g., "body=Body_color_light", "sash=Waistband_rose")
	for (const [typeName, nameAndVariant] of Object.entries(params)) {
		// Handle special parameters
		if (typeName === 'bodyType' || typeName === 'sex') {
			state.bodyType = nameAndVariant;
			continue;
		}

		// Skip "none" selections
		if (nameAndVariant === 'none') continue;

		// Parse the Name_variant format by trying different split positions
		// Try from left to right to find a valid name+variant combination
		// e.g., "Tiara_tiara_silver" -> try "Tiara" + "tiara_silver" ✓
		// e.g., "Human_female_light" -> try "Human_female" + "light" ✓

		let foundItemId = null;
		let matchedVariant = '';

		// Split on underscores and try different combinations
		const parts = nameAndVariant.split('_');

		// Try each possible split point (from left to right)
		for (let i = 1; i <= parts.length; i++) {
			const nameToMatch = parts.slice(0, i).join('_');
			const variantToMatch = parts.slice(i).join('_');

			// Search for item with this name and variant
			for (const [itemId, meta] of Object.entries(window.itemMetadata || {})) {
				if (meta.type_name !== typeName) continue;

				const metaNameNormalized = meta.name.replaceAll(' ', '_');

				// Check if name matches and variant exists (or no variant required)
				if (metaNameNormalized === nameToMatch &&
				    (variantToMatch === '' || meta.variants?.includes(variantToMatch))) {
					foundItemId = itemId;
					matchedVariant = variantToMatch;
					break;
				}
			}

			if (foundItemId) break;
		}

		if (!foundItemId) {
			if (window.DEBUG) {
				console.warn(`No item found with type_name "${typeName}" and nameAndVariant "${nameAndVariant}"`);
			}
			continue;
		}

		const meta = window.itemMetadata[foundItemId];

		// Use type_name as selection group
		const selectionGroup = typeName;
		newSelections[selectionGroup] = {
			itemId: foundItemId,
			variant: matchedVariant || meta.variants?.[0] || '',
			name: meta.name + (matchedVariant ? ` (${matchedVariant})` : '')
		};
	}

	// Now update state once with complete new selections
	state.selections = newSelections;

	// Load body type
	if (params.bodyType) {
		state.bodyType = params.bodyType;
	}
}

// Select default items (body color light + human male light head)
export function selectDefaults() {
	// Set default body color (light)
	// itemId is now based on filename (e.g., "body")
	const bodyItemId = "body";
	const bodySelectionGroup = getSelectionGroup(bodyItemId);
	state.selections[bodySelectionGroup] = {
		itemId: bodyItemId,
		variant: "light",
		name: "Body color (light)"
	};

	// Set default head (human male light)
	// itemId is now based on filename (e.g., "heads_human_male")
	const headItemId = "heads_human_male";
	const headSelectionGroup = getSelectionGroup(headItemId);
	state.selections[headSelectionGroup] = {
		itemId: headItemId,
		variant: "light",
		name: "Human male (light)"
	};

	// Update URL hash
	syncSelectionsToHash();

	// Render the character with defaults
	if (window.canvasRenderer) {
		window.canvasRenderer.renderCharacter(state.selections, state.bodyType).then(() => {
			// Trigger redraw to update preview canvas after offscreen render completes
			m.redraw();
		});
	}
}

// Reset all selections and restore defaults
export function resetAll() {
	state.selections = {};
	state.customUploadedImage = null;
	state.customImageZPos = 0;
	selectDefaults();
	m.redraw();
}

// Apply match body color - when any body-colored part changes, update all items with matchBodyColor: true
export function applyMatchBodyColor(variantToMatch) {
	// Only apply if feature is enabled
	if (!state.matchBodyColorEnabled) return;

	// If no variant specified, nothing to match
	if (!variantToMatch) return;

	// Update all selected items that have matchBodyColor: true
	for (const [selectionGroup, selection] of Object.entries(state.selections)) {
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
	const allowedSet = new Set(allowedLicenses.map(l => l.trim()));

	// Check if item has at least one credit with a compatible license
	for (const credit of meta.credits) {
		if (credit.licenses && credit.licenses.length > 0) {
			const hasCompatibleLicense = credit.licenses.some(license =>
				allowedSet.has(license.trim())
			);
			if (hasCompatibleLicense) return true;
		}
	}

	return false;
}

// Helper function to check if an item is compatible with selected animations
export function isItemAnimationCompatible(itemId) {
	// Get list of enabled animations
	const enabledAnims = ANIMATIONS
		.filter(anim => state.enabledAnimations[anim.value])
		.map(anim => anim.value);

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

// Initialize hash change listener
export function initHashChangeListener() {
	// Store the current hash to detect external changes
	let lastKnownHash = window.location.hash;

	// Listen for browser back/forward navigation
	window.addEventListener('hashchange', function() {
		const currentHash = window.location.hash;

		// Check if this is an external change (browser navigation) vs our own update
		// Our afterStateChange() will update the hash, but we don't want to reload from it
		// We can detect external changes by checking if the hash is different from what we expect
		const params = getHashParams();
		const expectedHash = '#' + Object.entries({
			bodyType: state.bodyType,
			...Object.fromEntries(
				Object.values(state.selections).map(s => [s.itemId, s.variant || ''])
			)
		}).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

		// If the hash matches what we expect from current state, ignore (it's our own update)
		if (currentHash === expectedHash) {
			lastKnownHash = currentHash;
			return;
		}

		// Load from hash (updates state once)
		loadSelectionsFromHash();

		// If nothing loaded from hash, use defaults
		if (Object.keys(state.selections).length === 0) {
			selectDefaults();
		}

		// Trigger redraw which calls App.onupdate (syncs hash and renders canvas)
		m.redraw();

		lastKnownHash = currentHash;
	});
}

// Initialize state with defaults or from URL
export function initState() {
	// First, try to load from URL hash
	loadSelectionsFromHash();

	// If nothing in hash, set defaults
	if (Object.keys(state.selections).length === 0) {
		selectDefaults();
	} else {
		// Render with loaded selections
		if (window.canvasRenderer) {
			window.canvasRenderer.renderCharacter(state.selections, state.bodyType).then(() => {
				// Trigger redraw to update preview canvas after offscreen render completes
				m.redraw();
			});
		}
	}
}

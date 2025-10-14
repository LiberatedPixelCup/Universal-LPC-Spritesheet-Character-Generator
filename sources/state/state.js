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
// Selection group = first 2 levels of path (e.g., ["head", "heads"] → "head-heads")
// This ensures only one item per category can be selected (mimics old radio button behavior)
export function getSelectionGroup(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.path || meta.path.length < 2) return itemId;
	return meta.path.slice(0, 2).join('-');
}

// URL hash parameter management
function getHashParams() {
	const hash = window.location.hash.substring(1); // Remove '#'
	if (!hash) return {};

	const params = {};
	hash.split('&').forEach(pair => {
		const [key, value] = pair.split('=');
		if (key && value) {
			params[decodeURIComponent(key)] = decodeURIComponent(value);
		}
	});
	return params;
}

function setHashParams(params) {
	const hash = Object.entries(params)
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join('&');
	window.location.hash = hash;
}

export function syncSelectionsToHash() {
	const params = {};

	// Add body type
	params.bodyType = state.bodyType;

	// Add selections - use itemId as key (for URL readability)
	// state.selections is now keyed by selectionGroup, but we store itemId in the URL
	// itemId "body-body" with variant "light" -> "body-body=light"
	// itemId "body-shadow" with variant "shadow" -> "body-shadow=shadow"
	// itemId "head-heads-heads_human_male" with variant "light" -> "head-heads-heads_human_male=light"
	for (const [selectionGroup, selection] of Object.entries(state.selections)) {
		// Use the itemId directly as the key
		const key = selection.itemId;

		// Use variant as value (or empty string if no variant)
		const value = selection.variant || '';

		params[key] = value;
	}

	setHashParams(params);
}

export function loadSelectionsFromHash() {
	const params = getHashParams();

	// Build new selections object without mutating state yet
	const newSelections = {};

	// Load selections
	// Format: "body-body=light", "body-shadow=shadow", "head-heads-heads_human_male=light"
	for (const [itemId, variant] of Object.entries(params)) {
		if (itemId === 'bodyType') continue;

		// Look up the item in metadata
		const meta = window.itemMetadata?.[itemId];
		if (!meta || !meta.path || meta.path.length < 2) {
			if (window.DEBUG) {
				console.warn(`Unknown itemId in URL hash: ${itemId}`);
			}
			continue;
		}

		// Use the variant from URL, or first variant, or empty string
		const actualVariant = variant || meta.variants?.[0] || '';

		// Calculate selection group and store selection keyed by it
		const selectionGroup = getSelectionGroup(itemId);
		newSelections[selectionGroup] = {
			itemId: itemId,
			variant: actualVariant,
			name: meta.name + (actualVariant ? ` (${actualVariant})` : '')
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
	// selectionGroup for "body-body" is "body-body" (first 2 path levels)
	const bodyItemId = "body-body";
	const bodySelectionGroup = getSelectionGroup(bodyItemId);
	state.selections[bodySelectionGroup] = {
		itemId: bodyItemId,
		variant: "light",
		name: "Body color (light)"
	};

	// Set default head (human male light)
	// selectionGroup for "head-heads-heads_human_male" is "head-heads"
	const headItemId = "head-heads-heads_human_male";
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

// Apply match body color - when body color changes, update all items with matchBodyColor: true
export function applyMatchBodyColor() {
	// Only apply if feature is enabled
	if (!state.matchBodyColorEnabled) return;

	// Get the current body selection
	const bodySelectionGroup = getSelectionGroup('body-body');
	const bodySelection = state.selections[bodySelectionGroup];

	// If no body selected, nothing to match
	if (!bodySelection) return;

	const bodyVariant = bodySelection.variant;
	if (!bodyVariant) return;

	// Update all selected items that have matchBodyColor: true
	for (const [selectionGroup, selection] of Object.entries(state.selections)) {
		// Skip the body itself
		if (selectionGroup === bodySelectionGroup) continue;

		const itemId = selection.itemId;
		const meta = window.itemMetadata?.[itemId];

		// Skip if no metadata or matchBodyColor is not enabled for this item
		if (!meta || !meta.matchBodyColor) continue;

		// Check if this item has the body variant available
		if (meta.variants && meta.variants.includes(bodyVariant)) {
			// Update the variant to match the body
			selection.variant = bodyVariant;
			selection.name = meta.name + ` (${bodyVariant})`;
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

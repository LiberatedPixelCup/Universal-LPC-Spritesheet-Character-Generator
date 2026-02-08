import { state, selectDefaults } from './state.js';

// Dependency injection for testability
export function getState() {
  return state;
}

export function updateState(updates) {
  Object.assign(state, updates);
}

export function resetState() {
  state.bodyType = "male";
  state.selections = {};
}

// window.location.hash is immutable in tests, this is so we can use a stub to manage it
let _hash = "";
let _setHashCalledTimes = 0;

export function getHash() {
  if (window.isTesting)
    return _hash;
  return window.location.hash;
}

export function setHash(hash) {
  if (window.isTesting) {
    _hash = hash;
    _setHashCalledTimes++;
    return;
  } 
  window.location.hash = hash;
}

export function resetHashCalledTimes() {
  _setHashCalledTimes = 0;
}

export function getSetHashCalledTimes() {
  return _setHashCalledTimes;
}

// URL hash parameter management
export function getHashParams() {
	let hash = getHash().substring(1); // Remove '#'

	// Handle case where hash starts with '?' (some old URLs might have this)
	if (hash.startsWith("?")) {
		hash = hash.substring(1);
	}

	if (!hash) return {};
	
	return getHashParamsFromString(hash);
}

export function getHashParamsFromString(hashString) {
	const params = {};
	hashString.split("&").forEach((pair) => {
		const [key, value] = pair.split("=");
		if (key && value) {
			// Remove leading '?' from key if present
			const cleanKey = key.startsWith("?") ? key.substring(1) : key;
			params[decodeURIComponent(cleanKey)] = decodeURIComponent(value);
		}
	});
	return params;
}

export function createHashStringFromParams(params) {
	return Object.entries(params)
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
		)
		.join("&");
}

export function setHashParams(params) {
	const hash = createHashStringFromParams(params);
	setHash(hash);
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
		const namePart = meta.name.replaceAll(" ", "_");

		const variantPart = selection.variant ? `_${selection.variant}` : "";
		const value = namePart + variantPart;

		params[key] = value;
	}

	return params;
}

export function syncSelectionsToHash() {
	const params = getHashParamsforSelections(state.selections);
	setHashParams(params);
}

export function loadSelectionsFromHash(hashString = null) {
	const params = hashString ? getHashParamsFromString(hashString) : getHashParams();

	// Build new selections object without mutating state yet
	const newSelections = {};

	// Load selections
	// Old format: type_name=Name_variant (e.g., "body=Body_color_light", "sash=Waistband_rose")
	for (const [typeName, nameAndVariant] of Object.entries(params)) {
		// Handle special parameters
		if (typeName === "bodyType" || typeName === "sex") {
			state.bodyType = nameAndVariant;
			continue;
		}

		// Skip "none" selections
		if (nameAndVariant === "none") continue;

		// Parse the Name_variant format by trying different split positions
		// Try from left to right to find a valid name+variant combination
		// e.g., "Tiara_tiara_silver" -> try "Tiara" + "tiara_silver" ✓
		// e.g., "Human_female_light" -> try "Human_female" + "light" ✓

		let foundItemId = null;
		let matchedVariant = "";

		// Split on underscores and try different combinations
		const parts = nameAndVariant.split("_");

		// Try each possible split point (from left to right)
		for (let i = 1; i <= parts.length; i++) {
			const nameToMatch = parts.slice(0, i).join("_");
			const variantToMatch = parts.slice(i).join("_");

			// Search for item with this name and variant
			for (const [itemId, meta] of Object.entries(
				window.itemMetadata || {},
			)) {
				if (meta.type_name !== typeName) continue;

				const metaNameNormalized = meta.name.replaceAll(" ", "_");

				// Check if name matches and variant exists (or no variant required)
				if (metaNameNormalized.toLowerCase() === nameToMatch.toLowerCase()) {
          if (meta.variants?.length > 0) {
            for (const variant of meta.variants) {
              if (variant.toLowerCase() === variantToMatch.toLowerCase()) {
                foundItemId = itemId;
                matchedVariant = variant;
                break;
              }
            }
          } else {
            // No variants for this item, so we can match just on name
            foundItemId = itemId;
            break;
          }
        }

        if (foundItemId) break;
			}

			if (foundItemId) break;
		}

		if (!foundItemId) {
			if (window.DEBUG) {
				console.warn(
					`No item found with type_name "${typeName}" and nameAndVariant "${nameAndVariant}"`,
				);
			}
			continue;
		}

		const meta = window.itemMetadata[foundItemId];

		// Use type_name as selection group
		const selectionGroup = typeName;
		newSelections[selectionGroup] = {
			itemId: foundItemId,
			variant: matchedVariant || meta.variants?.[0] || "",
			name: meta.name + (matchedVariant ? ` (${matchedVariant})` : ""),
		};
	}

	// Now update state once with complete new selections
	state.selections = newSelections;

	// Load body type
	if (params.bodyType) {
		state.bodyType = params.bodyType;
	}

  syncSelectionsToHash(); // Ensure hash is in sync with loaded selections (handles any normalization)
}


// Initialize hash change listener
export function initHashChangeListener(listener) {
	// Store the current hash to detect external changes
	let lastKnownHash = getHash();

  if (listener) {
    window.addEventListener("hashchange", listener);
    return;
  }

	// Listen for browser back/forward navigation
	window.addEventListener("hashchange", async function () {
		const currentHash = getHash();

		// Check if this is an external change (browser navigation) vs our own update
		// Our afterStateChange() will update the hash, but we don't want to reload from it
		// We can detect external changes by checking if the hash is different from what we expect
		const params = getHashParams();
		const expectedHash =
			"#" +
			Object.entries({
				bodyType: state.bodyType,
				...Object.fromEntries(
					Object.values(state.selections).map((s) => [
						s.itemId,
						s.variant || "",
					]),
				),
			})
				.map(
					([k, v]) =>
						`${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
				)
				.join("&");

		// If the hash matches what we expect from current state, ignore (it's our own update)
		if (currentHash === expectedHash) {
			lastKnownHash = currentHash;
			return;
		}

		// Load from hash (updates state once)
		loadSelectionsFromHash();

		// If nothing loaded from hash, use defaults
		if (Object.keys(state.selections).length === 0) {
			await selectDefaults();
		}

		// Trigger redraw which calls App.onupdate (syncs hash and renders canvas)
		m.redraw();

		lastKnownHash = currentHash;
	});
}

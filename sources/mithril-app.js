// Mithril-based character generator
// Clean rewrite without jQuery dependencies

import { initPaletteRecoloring, recolorImage } from './palette-recolor.js';

/**
 * Convert variant name to filename format (spaces to underscores)
 * @param {string} variant - Variant name (e.g., "light brown")
 * @returns {string} - Filename format (e.g., "light_brown")
 */
function variantToFilename(variant) {
	return variant.replaceAll(' ', '_');
}

// Helper function to get selection group from itemId
// Selection group = first 2 levels of path (e.g., ["head", "heads"] → "head-heads")
// This ensures only one item per category can be selected (mimics old radio button behavior)
function getSelectionGroup(itemId) {
	const meta = window.itemMetadata?.[itemId];
	if (!meta || !meta.path || meta.path.length < 2) return itemId;
	return meta.path.slice(0, 2).join('-');
}

// License configuration - single source of truth
const LICENSE_CONFIG = [
	{
		key: "CC0",
		label: "CC0",
		versions: ["CC0"],
		url: "https://creativecommons.org/public-domain/cc0/"
	},
	{
		key: "CC-BY-SA",
		label: "CC-BY-SA",
		versions: ["CC-BY-SA 3.0", "CC-BY-SA 4.0"],
		url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
		urlLabel: "4.0"
	},
	{
		key: "CC-BY",
		label: "CC-BY",
		versions: ["CC-BY 3.0+", "CC-BY 3.0", "CC-BY 4.0", "CC-BY"],
		url: "https://creativecommons.org/licenses/by/4.0/",
		urlLabel: "4.0"
	},
	{
		key: "OGA-BY",
		label: "OGA-BY",
		versions: ["OGA-BY 3.0", "OGA-BY 3.0+", "OGA-BY 4.0"],
		url: "https://static.opengameart.org/OGA-BY-3.0.txt",
		urlLabel: "3.0"
	},
	{
		key: "GPL",
		label: "GPL",
		versions: ["GPL 2.0", "GPL 3.0"],
		url: "https://www.gnu.org/licenses/gpl-3.0.en.html#license-text",
		urlLabel: "3.0"
	}
];

// Animation list - used for filters and preview
const ANIMATIONS = [
	{ value: 'spellcast', label: 'Spellcast' },
	{ value: 'thrust', label: 'Thrust' },
	{ value: 'walk', label: 'Walk' },
	{ value: 'slash', label: 'Slash' },
	{ value: 'shoot', label: 'Shoot' },
	{ value: 'hurt', label: 'Hurt' },
	{ value: 'climb', label: 'Climb' },
	{ value: 'idle', label: 'Idle' },
	{ value: 'jump', label: 'Jump' },
	{ value: 'sit', label: 'Sit' },
	{ value: 'emote', label: 'Emote' },
	{ value: 'run', label: 'Run' },
	{ value: 'watering', label: 'Watering' },
	{ value: 'combat', label: 'Combat Idle' },
	{ value: '1h_slash', label: '1-Handed Slash' },
	{ value: '1h_backslash', label: '1-Handed Backslash' },
	{ value: '1h_halfslash', label: '1-Handed Halfslash' }
];

// Global state
const state = {
	selections: {}, // key: selectionGroup, value: { itemId, variant, name }
	bodyType: "male", // male, female, teen, child, muscular, pregnant
	expandedNodes: {}, // key: path string, value: boolean (true if expanded)
	searchQuery: "", // current search query
	showTransparencyGrid: true, // show checkered transparency background
	// License filters - all enabled by default (derived from LICENSE_CONFIG)
	enabledLicenses: Object.fromEntries(
		LICENSE_CONFIG.map(lic => [lic.key, true])
	),
	// Animation filters - all disabled by default (filter only active when at least one is checked)
	enabledAnimations: Object.fromEntries(
		ANIMATIONS.map(anim => [anim.value, false])
	),
	// Palette recoloring data
	paletteRecoloring: {
		enabled: false,
		palettes: null // Loaded palette definitions (source + target palettes)
	}
};

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

function syncSelectionsToHash() {
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

function loadSelectionsFromHash() {
	const params = getHashParams();
	console.log('Loading from hash, params:', params);

	// Build new selections object without mutating state yet
	const newSelections = {};

	// Load selections
	// Format: "body-body=light", "body-shadow=shadow", "head-heads-heads_human_male=light"
	for (const [itemId, variant] of Object.entries(params)) {
		if (itemId === 'bodyType') continue;

		// Look up the item in metadata
		const meta = window.itemMetadata?.[itemId];
		if (!meta || !meta.path || meta.path.length < 2) {
			console.warn(`Unknown itemId in URL hash: ${itemId}`);
			continue;
		}

		// Use the variant from URL, or first variant, or empty string
		const actualVariant = variant || meta.variants?.[0] || '';

		console.log(`Loading: itemId=${itemId}, variant=${actualVariant}`);

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

	console.log('Final selections after load:', state.selections);
}

// Select default items (body color light + human male light head)
function selectDefaults() {
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
		window.canvasRenderer.renderCharacter(state.selections, state.bodyType);
	}
}

// Reset all selections and restore defaults
function resetAll() {
	state.selections = {};
	selectDefaults();
	m.redraw();
}

// Initialize palette recoloring system - just load the palettes, don't pre-generate variants
async function initializePaletteRecoloring() {
	try {
		console.log('Initializing palette recoloring system...');

		// Load palette definitions
		const response = await fetch('tools/palettes/ulpc-body-palettes.json');
		if (!response.ok) {
			throw new Error(`Failed to load palette: ${response.statusText}`);
		}
		const palettes = await response.json();

		state.paletteRecoloring.enabled = true;
		state.paletteRecoloring.palettes = palettes;

		console.log(`✓ Palette recoloring initialized with ${Object.keys(palettes).length} palette definitions`);
		console.log('Palette keys:', Object.keys(palettes));
	} catch (error) {
		console.error('Failed to initialize palette recoloring:', error);
		state.paletteRecoloring.enabled = false;
	}
}

// Helper function to capitalize strings for display
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
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
function isItemLicenseCompatible(itemId) {
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
function isItemAnimationCompatible(itemId) {
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

// Helper function to collect credits from all selected items
// Only includes credits for files actually being used based on current bodyType
function getAllCredits(selections) {
	const allCredits = [];
	const seenFiles = new Set();

	for (const [categoryPath, selection] of Object.entries(selections)) {
		const { itemId } = selection;
		const meta = window.itemMetadata[itemId];

		if (!meta || !meta.credits) continue;

		// Build set of actual file paths being used for this item
		const usedPaths = new Set();

		// Check each layer to get the base path for current bodyType
		for (let layerNum = 1; layerNum < 10; layerNum++) {
			const layerKey = `layer_${layerNum}`;
			const layer = meta.layers?.[layerKey];
			if (!layer) break;

			// Get the base path for current body type
			let basePath = layer[state.bodyType];
			if (!basePath) continue;

			// Replace template variables like ${head} if present
			if (basePath.includes('${head}')) {
				// Find the selected head to determine replacement value
				const headSelection = Object.values(selections).find(sel =>
					sel.itemId?.startsWith('head-heads-')
				);

				const headSelectionName = headSelection?.name || 'Human_male';
				let replacementValue = 'male'; // default

				if (meta.replace_in_path?.head) {
					replacementValue = meta.replace_in_path.head[headSelectionName] || 'male';
				}

				basePath = basePath.replace('${head}', replacementValue);
			}

			// Remove trailing slash if present
			const normalizedPath = basePath.replace(/\/$/, '');
			usedPaths.add(normalizedPath);
		}

		// Only include credits whose file path matches one of the used paths
		for (const credit of meta.credits) {
			if (seenFiles.has(credit.file)) continue;

			// Check if this credit's file matches any of the used paths
			const creditFile = credit.file;
			let isUsed = false;

			for (const usedPath of usedPaths) {
				// Match if credit file equals or starts with the used path
				// e.g., credit.file="body/bodies/male" matches usedPath="body/bodies/male"
				if (creditFile === usedPath || creditFile.startsWith(usedPath + '/')) {
					isUsed = true;
					break;
				}
			}

			if (isUsed) {
				seenFiles.add(credit.file);
				allCredits.push(credit);
			}
		}
	}

	return allCredits;
}

// Helper function to convert credits to CSV format
function creditsToCsv(allCredits) {
	const header = "filename,notes,authors,licenses,urls";
	let csvBody = header + "\n";
	allCredits.forEach(credit => {
		const authors = credit.authors.join(", ");
		const licenses = credit.licenses.join(", ");
		const urls = credit.urls.join(", ");
		const notes = credit.notes || "";
		csvBody += `"${credit.file}","${notes}","${authors}","${licenses}","${urls}"\n`;
	});
	return csvBody;
}

// Helper function to convert credits to TXT format
function creditsToTxt(allCredits) {
	let txt = "";
	allCredits.forEach(credit => {
		txt += `${credit.file}\n`;
		if (credit.notes) {
			txt += `\t- Note: ${credit.notes}\n`;
		}
		txt += `\t- Licenses:\n\t\t- ${credit.licenses.join("\n\t\t- ")}\n`;
		txt += `\t- Authors:\n\t\t- ${credit.authors.join("\n\t\t- ")}\n`;
		txt += `\t- Links:\n\t\t- ${credit.urls.join("\n\t\t- ")}\n\n`;
	});
	return txt;
}

// Helper function to get item filename with zPos prefix (matches original)
function getItemFileName(itemId, variant, name) {
	const meta = window.itemMetadata[itemId];
	if (!meta) return name;

	// Get zPos from first layer
	const layer1 = meta.layers?.layer_1;
	const zPos = layer1?.zPos || 100;

	// Format: "050 body_male_light" (zPos padded to 3 digits + space + name)
	const safeName = (name || itemId).replace(/[^a-z0-9]/gi, '_').toLowerCase();
	return `${String(zPos).padStart(3, '0')} ${safeName}`;
}

// Item with variants component
const ItemWithVariants = {
	view: function(vnode) {
		const { itemId, meta, isSearchMatch } = vnode.attrs;
		const isExpanded = state.expandedNodes[itemId] || false;
		const displayName = meta.name;

		return m("div", {
			class: isSearchMatch ? "search-result" : ""
		}, [
			m("div.tree-label", {
				onclick: () => {
					state.expandedNodes[itemId] = !isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
				m("span", displayName)
			]),
			isExpanded ? m("div.tree-node",
				meta.variants.map(variant => {
					const selectionGroup = getSelectionGroup(itemId);
					const isSelected = state.selections[selectionGroup]?.itemId === itemId &&
					                    state.selections[selectionGroup]?.variant === variant;
					const variantDisplayName = variant.replaceAll("_", " ");

					// Get preview metadata from item metadata
					const previewRow = meta.preview_row ?? 2;
					const previewCol = meta.preview_column ?? 0;
					const previewXOffset = meta.preview_x_offset ?? 0;
					const previewYOffset = meta.preview_y_offset ?? 0;

					// Get sprite path for preview image from first layer
					const layer1 = meta.layers?.layer_1;
					const basePath = layer1?.[state.bodyType];

					// Check if this item uses a custom animation
					const hasCustomAnimation = layer1?.custom_animation;

					let previewSrc = null;
					if (basePath) {
						if (hasCustomAnimation) {
							// Custom animations don't have animation subfolders
							previewSrc = `spritesheets/${basePath}${variantToFilename(variant)}.png`;
						} else {
							// Standard animations have animation subfolders (walk, slash, etc.)
							const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
							previewSrc = `spritesheets/${basePath}${defaultAnim}/${variantToFilename(variant)}.png`;
						}
					}

					// Calculate object position for cropping
					// Negative position shifts the image left/up to show that part in the viewport
					// Positive offset values shift the viewport right/down (to see more left/top of sprite)
					// Negative offset values shift the viewport left/up (to see more right/bottom of sprite)
					const objectPosX = -(previewCol * 64 - previewXOffset);
					const objectPosY = -(previewRow * 64 - previewYOffset);

					return m("div", {
						key: variant,
						class: "variant-item is-flex is-align-items-center p-3 ml-5 is-clickable" + (isSelected ? " has-background-link-light has-text-weight-bold has-text-link" : ""),
						style: "gap: 0.75rem; border-radius: 4px; transition: background-color 0.15s;",
						onmouseover: (e) => {
							const div = e.currentTarget;
							if (!isSelected) div.classList.add('has-background-white-ter');
						},
						onmouseout: (e) => {
							const div = e.currentTarget;
							if (!isSelected) div.classList.remove('has-background-white-ter');
						},
						onclick: () => {
							const selectionGroup = getSelectionGroup(itemId);
							state.selections[selectionGroup] = {
								itemId: itemId,
								variant: variant,
								name: `${displayName} (${variantDisplayName})`
							};
						}
					}, [
						m("canvas", {
							width: 64,
							height: 64,
							class: "box p-0",
							style: "width: 64px; height: 64px; image-rendering: pixelated; flex-shrink: 0; border: 2px solid" + (isSelected ? " hsl(217, 71%, 53%)" : " hsl(0, 0%, 86%)"),
							oncreate: (canvasVnode) => {
								const canvas = canvasVnode.dom;
								const ctx = canvas.getContext('2d');

								// Check if this is a body item that can use palette recoloring
								const isBodyItem = itemId === 'body-body';
								const canUsePalette = isBodyItem &&
								                       state.paletteRecoloring.enabled &&
								                       state.paletteRecoloring.palettes &&
								                       variant !== 'light'; // Don't recolor light variant (it's the base)

								if (canUsePalette) {
									// Use palette recoloring for body items
									const sourcePalette = state.paletteRecoloring.palettes.source || state.paletteRecoloring.palettes.light;
									const targetPalette = state.paletteRecoloring.palettes[variant];

									if (targetPalette) {
										console.log(`✓ Using palette recoloring for body-body variant: ${variant}`);

										// Load the base light variant image
										const layer1 = meta.layers?.layer_1;
										const basePath = layer1?.[state.bodyType];
										const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
										const baseImagePath = `spritesheets/${basePath}${defaultAnim}/light.png`;

										const baseImg = new Image();
										baseImg.onload = () => {
											// Recolor the image using palette
											const recoloredCanvas = recolorImage(baseImg, sourcePalette, targetPalette);

											// Draw the recolored frame to preview canvas
											ctx.drawImage(
												recoloredCanvas,
												previewCol * 64 - previewXOffset, previewRow * 64 - previewYOffset, 64, 64,
												0, 0, 64, 64
											);
										};
										baseImg.onerror = () => {
											console.error('Failed to load base image for palette recoloring:', baseImagePath);
										};
										baseImg.src = baseImagePath;
										return; // Skip normal image loading
									} else {
										console.warn(`Palette not found for variant: ${variant}, falling back to normal image loading`);
									}
								}

								// Normal image loading for non-body items or when palette is not available
								// Collect all layers for this item
								const layersToLoad = [];
								for (let layerNum = 1; layerNum < 10; layerNum++) {
									const layer = meta.layers?.[`layer_${layerNum}`];
									if (!layer) break;

									let layerPath = layer[state.bodyType];
									if (!layerPath) continue;

									// Replace template variables like ${head}
									if (layerPath.includes('${head}')) {
										// Determine head type from current selections
										const headSelection = Object.values(state.selections).find(sel =>
											sel.itemId?.startsWith('head-heads-')
										);

										// Get the head name (e.g., "Human_male")
										const headSelectionName = headSelection?.name || 'Human_male';

										// Use replace_in_path mapping if available
										let replacementValue = 'male'; // default
										if (meta.replace_in_path?.head) {
											replacementValue = meta.replace_in_path.head[headSelectionName] || 'male';
										}

										layerPath = layerPath.replace('${head}', replacementValue);
									}

									const hasCustomAnim = layer.custom_animation;
									let imagePath;
									if (hasCustomAnim) {
										imagePath = `spritesheets/${layerPath}${variantToFilename(variant)}.png`;
									} else {
										const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
										imagePath = `spritesheets/${layerPath}${defaultAnim}/${variantToFilename(variant)}.png`;
									}

									layersToLoad.push({
										zPos: layer.zPos || 100,
										path: imagePath
									});
								}

								// Sort by zPos
								layersToLoad.sort((a, b) => a.zPos - b.zPos);

								// Load and draw all layers
								Promise.all(layersToLoad.map(layer => {
									return new Promise((resolve) => {
										const img = new Image();
										img.onload = () => resolve({ img, layer });
										img.onerror = () => resolve({ img: null, layer });
										img.src = layer.path;
									});
								})).then(loadedLayers => {
									// Draw each layer in zPos order
									for (const { img, layer } of loadedLayers) {
										if (img) {
											ctx.drawImage(
												img,
												previewCol * 64 - previewXOffset, previewRow * 64 - previewYOffset, 64, 64,
												0, 0, 64, 64
											);
										}
									}
								});
							}
						}),
						m("span", { style: "flex: 1;" }, capitalize(variantDisplayName))
					]);
				})
			) : null
		]);
	}
};

// Body type selector component
const BodyTypeSelector = {
	view: function() {
		const bodyTypes = ["male", "female", "teen", "child", "muscular", "pregnant"];

		return m("div", [
			m("h3.title.is-5", "Body Type"),
			m("div.buttons",
				bodyTypes.map(type =>
					m("button.button", {
						class: state.bodyType === type ? "is-primary" : "",
						onclick: () => {
							state.bodyType = type;
							
						}
					}, capitalize(type))
				)
			)
		]);
	}
};

// License Filters component
const LicenseFilters = {
	oninit: function(vnode) {
		vnode.state.isExpanded = false; // Start collapsed by default
	},
	view: function(vnode) {

		// Function to remove incompatible items from selections
		const removeIncompatibleItems = () => {
			const toRemove = [];
			for (const [selectionGroup, selection] of Object.entries(state.selections)) {
				if (!isItemLicenseCompatible(selection.itemId)) {
					toRemove.push(selectionGroup);
				}
			}

			if (toRemove.length > 0) {
				toRemove.forEach(key => delete state.selections[key]);
				alert(`Removed ${toRemove.length} incompatible item(s)`);
			} else {
				alert('No incompatible items found');
			}
		};

		// Check if there are any incompatible selected items
		const incompatibleSelections = Object.values(state.selections).filter(
			selection => !isItemLicenseCompatible(selection.itemId)
		);
		const hasIncompatibleItems = incompatibleSelections.length > 0;

		// Count how many licenses are enabled
		const enabledCount = Object.values(state.enabledLicenses).filter(Boolean).length;
		const totalCount = LICENSE_CONFIG.length;

		return m("div.box.mb-4.has-background-light", [
			m("div.tree-label", {
				style: "cursor: pointer; user-select: none;",
				onclick: () => {
					vnode.state.isExpanded = !vnode.state.isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: vnode.state.isExpanded ? 'expanded' : 'collapsed' }),
				m("span.title.is-6", { style: "display: inline;" }, "License Filters"),
				m("span.is-size-7.has-text-grey.ml-2", `(${enabledCount}/${totalCount} enabled)`)
			]),
			vnode.state.isExpanded ? m("div.content.mt-3", [
				m("ul", { style: "list-style: none; margin-left: 0;" },
					LICENSE_CONFIG.map(license =>
						m("li", { key: license.key, class: "mb-2" }, [
							m("label.checkbox", [
								m("input[type=checkbox]", {
									checked: state.enabledLicenses[license.key],
									onchange: (e) => {
										state.enabledLicenses[license.key] = e.target.checked;
									}
								}),
								` ${license.label} `,
								m("a.is-size-7", {
									href: license.url,
									target: "_blank",
									rel: "noopener noreferrer"
								}, `(Show license${license.urlLabel ? ' ' + license.urlLabel : ''})`)
							])
						])
					)
				),
				hasIncompatibleItems ? [
					m("div.notification.is-warning.is-light.p-3.mt-2", [
						m("p.is-size-7", [
							m("strong", `${incompatibleSelections.length} selected item${incompatibleSelections.length > 1 ? 's are' : ' is'} incompatible`),
							" with your current license selection. ",
							m("span.has-text-grey", "(marked with ⚠️ above)")
						])
					]),
					m("button.button.is-small.is-warning.mt-2", {
						onclick: removeIncompatibleItems,
						title: `Remove ${incompatibleSelections.length} incompatible item${incompatibleSelections.length > 1 ? 's' : ''}`
					}, `Remove ${incompatibleSelections.length} Incompatible Asset${incompatibleSelections.length > 1 ? 's' : ''}`)
				] : null
			]) : null
		]);
	}
};

// Animation Filters component
const AnimationFilters = {
	oninit: function(vnode) {
		vnode.state.isExpanded = false; // Start collapsed by default
	},
	view: function(vnode) {
		// Function to remove incompatible items from selections
		const removeIncompatibleItems = () => {
			const toRemove = [];
			for (const [selectionGroup, selection] of Object.entries(state.selections)) {
				if (!isItemAnimationCompatible(selection.itemId)) {
					toRemove.push(selectionGroup);
				}
			}

			if (toRemove.length > 0) {
				toRemove.forEach(key => delete state.selections[key]);
				alert(`Removed ${toRemove.length} incompatible item(s)`);
			} else {
				alert('No incompatible items found');
			}
		};

		// Check if there are any incompatible selected items
		const incompatibleSelections = Object.values(state.selections).filter(
			selection => !isItemAnimationCompatible(selection.itemId)
		);
		const hasIncompatibleItems = incompatibleSelections.length > 0;

		// Count how many animations are enabled
		const enabledCount = Object.values(state.enabledAnimations).filter(Boolean).length;
		const totalCount = ANIMATIONS.length;
		const isFilterActive = enabledCount > 0;

		return m("div.box.mb-4.has-background-light", [
			m("div.tree-label", {
				style: "cursor: pointer; user-select: none;",
				onclick: () => {
					vnode.state.isExpanded = !vnode.state.isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: vnode.state.isExpanded ? 'expanded' : 'collapsed' }),
				m("span.title.is-6", { style: "display: inline;" }, "Animation Filters"),
				m("span.is-size-7.has-text-grey.ml-2",
					isFilterActive
						? `(${enabledCount}/${totalCount} selected)`
						: "(filter disabled - check animations to enable)"
				)
			]),
			vnode.state.isExpanded ? m("div.content.mt-3", [
				m("ul", { style: "list-style: none; margin-left: 0;" },
					ANIMATIONS.map(anim =>
						m("li", { key: anim.value, class: "mb-2" }, [
							m("label.checkbox", [
								m("input[type=checkbox]", {
									checked: state.enabledAnimations[anim.value],
									onchange: (e) => {
										state.enabledAnimations[anim.value] = e.target.checked;
									}
								}),
								` ${anim.label}`
							])
						])
					)
				),
				hasIncompatibleItems ? [
					m("div.notification.is-warning.is-light.p-3.mt-2", [
						m("p.is-size-7", [
							m("strong", `${incompatibleSelections.length} selected item${incompatibleSelections.length > 1 ? 's are' : ' is'} incompatible`),
							" with your current animation selection. ",
							m("span.has-text-grey", "(marked with ⚠️ above)")
						])
					]),
					m("button.button.is-small.is-warning.mt-2", {
						onclick: removeIncompatibleItems,
						title: `Remove ${incompatibleSelections.length} incompatible item${incompatibleSelections.length > 1 ? 's' : ''}`
					}, `Remove ${incompatibleSelections.length} Incompatible Asset${incompatibleSelections.length > 1 ? 's' : ''}`)
				] : null
			]) : null
		]);
	}
};

// Controls component (Search only)
const Controls = {
	view: function() {
		return m("div.field", [
			m("label.label", "Search:"),
			m("input.input[type=search][placeholder=Search]", {
				value: state.searchQuery,
				oninput: (e) => {
					state.searchQuery = e.target.value;
				}
			})
		]);
	}
};

// Helper function to check if item matches search query
function matchesSearch(text, query) {
	if (!query || query.length < 2) return true;
	return text.toLowerCase().includes(query.toLowerCase());
}

// Helper function to check if a node or its children contain search matches
function nodeHasMatches(node, query) {
	if (!query || query.length < 2) return true;

	// Check if any items in this node match
	if (node.items && node.items.some(itemId => {
		const meta = window.itemMetadata[itemId];
		return meta && matchesSearch(meta.name, query);
	})) {
		return true;
	}

	// Check if any child nodes have matches
	if (node.children) {
		return Object.values(node.children).some(childNode => nodeHasMatches(childNode, query));
	}

	return false;
}

// Recursive tree node component
const TreeNode = {
	view: function(vnode) {
		const { name, node, pathPrefix = "" } = vnode.attrs;
		const nodePath = pathPrefix ? `${pathPrefix}-${name}` : name;
		const searchQuery = state.searchQuery;
		const hasSearchMatches = nodeHasMatches(node, searchQuery);

		// Hide this node if search is active and there are no matches
		if (searchQuery && searchQuery.length >= 2 && !hasSearchMatches) {
			return null;
		}

		// Auto-expand if search is active and has matches
		const isExpanded = (searchQuery && searchQuery.length >= 2 && hasSearchMatches) || state.expandedNodes[nodePath] || false;
		const displayName = capitalize(name);

		return m("div",
			m("div.tree-label", {
				onclick: () => {
					state.expandedNodes[nodePath] = !isExpanded;
				}
			}, [
				m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
				m("span", displayName)
			]),
			isExpanded ? m("div.tree-node", [
				// Render child categories
				Object.entries(node.children || {}).map(([childName, childNode]) =>
					m(TreeNode, { key: childName, name: childName, node: childNode, pathPrefix: nodePath })
				),
				// Render items in this category
				(node.items || [])
					.filter(itemId => {
						const meta = window.itemMetadata[itemId];
						// Filter: Only show items compatible with current body type
						if (!meta || !meta.required.includes(state.bodyType)) return false;

						// Filter: Only show items matching search query
						if (searchQuery && searchQuery.length >= 2 && !matchesSearch(meta.name, searchQuery)) {
							return false;
						}

						// Filter: Only show items compatible with selected licenses
						if (!isItemLicenseCompatible(itemId)) return false;

						// Filter: Only show items compatible with selected animations
						if (!isItemAnimationCompatible(itemId)) return false;

						return true;
					})
					.map(itemId => {
						const meta = window.itemMetadata[itemId];
						const displayName = meta.name;
						const hasVariants = meta.variants && meta.variants.length > 0;
						const isSearchMatch = searchQuery && searchQuery.length >= 2 && matchesSearch(meta.name, searchQuery);

						if (!hasVariants) {
							// Simple item with no variants
							const selectionGroup = getSelectionGroup(itemId);
							const isSelected = state.selections[selectionGroup]?.itemId === itemId;
							return m("div", {
								key: itemId,
								class: isSearchMatch ? "search-result" : "",
								style: "padding: 0.25rem 0 0.25rem 1.5rem; cursor: pointer;" + (isSelected ? " font-weight: bold; color: #3273dc;" : ""),
								onclick: () => {
									state.selections[selectionGroup] = { itemId, name: displayName };
								}
							}, displayName);
						}

						// Item with variants - create a sub-component
						return m(ItemWithVariants, { key: itemId, itemId, meta, isSearchMatch });
					})
			]) : null
		);
	}
};

// Current selections component
const CurrentSelections = {
	view: function() {
		const selectionCount = Object.keys(state.selections).length;

		if (selectionCount === 0) {
			return m("div", [
				m("h3.title.is-5", "Current Selections"),
				m("p.has-text-grey", "No items selected yet")
			]);
		}

		return m("div", [
			m("h3.title.is-5", "Current Selections"),
			m("div.tags",
				Object.entries(state.selections).map(([selectionKey, selection]) => {
					const isLicenseCompatible = isItemLicenseCompatible(selection.itemId);
					const isAnimCompatible = isItemAnimationCompatible(selection.itemId);
					const isCompatible = isLicenseCompatible && isAnimCompatible;
					const meta = window.itemMetadata?.[selection.itemId];

					// Get all licenses for this item
					const allLicenses = new Set();
					if (meta?.credits) {
						meta.credits.forEach(credit => {
							if (credit.licenses) {
								credit.licenses.forEach(lic => allLicenses.add(lic.trim()));
							}
						});
					}
					const licensesText = allLicenses.size > 0 ?
						`Licenses: ${Array.from(allLicenses).join(', ')}` :
						'No license info';

					// Get supported animations for this item
					const supportedAnims = meta?.animations || [];
					const animsText = supportedAnims.length > 0 ?
						`Animations: ${supportedAnims.join(', ')}` :
						'No animation info';

					// Build tooltip text
					let tooltipText = '';
					if (!isCompatible) {
						const issues = [];
						if (!isLicenseCompatible) issues.push('licenses');
						if (!isAnimCompatible) issues.push('animations');
						tooltipText = `⚠️ Incompatible with selected ${issues.join(' and ')}\n`;
					}
					tooltipText += `${licensesText}\n${animsText}`;

					return m("span.tag.is-medium", {
						key: selectionKey,
						class: isCompatible ? "is-info" : "is-warning",
						title: tooltipText
					}, [
						m("span", selection.name),
						!isCompatible ? m("span.ml-1", "⚠️") : null,
						m("button.delete.is-small", {
							onclick: () => {
								delete state.selections[selectionKey];

							}
						})
					]);
				})
			)
		]);
	}
};

// Main tree component
const CategoryTree = {
	view: function() {
		if (!window.categoryTree) {
			return m("div", "Loading...");
		}

		return m("div.box.has-background-light", [
			m("div.mb-3", { style: "display: flex; justify-content: space-between; align-items: center;" }, [
				m("h3.title.is-5.mb-0", "Available Items"),
				m("div.buttons.mb-0", [
					m("button.button.is-danger.is-small", {
						onclick: resetAll
					}, "Reset all"),
					m("button.button.is-small", {
						onclick: () => { state.expandedNodes = {}; }
					}, "Collapse All"),
					m("button.button.is-small", {
						onclick: () => {
							for (const [categoryPath, selection] of Object.entries(state.selections)) {
								const { itemId } = selection;
								const meta = window.itemMetadata[itemId];
								if (meta && meta.path) {
									let pathSoFar = "";
									// Expand all path segments (categories)
									for (const segment of meta.path) {
										pathSoFar = pathSoFar ? `${pathSoFar}-${segment}` : segment;
										state.expandedNodes[pathSoFar] = true;
									}
									// Also expand the item itself (to show variants)
									state.expandedNodes[itemId] = true;
								}
							}
						}
					}, "Expand Selected")
				])
			]),
			m("div",
				Object.entries(window.categoryTree.children || {}).map(([categoryName, categoryNode]) =>
				m(TreeNode, { key: categoryName, name: categoryName, node: categoryNode })
			)
		)
		]);
	}
};

// Filters Panel - combines Controls, BodyTypeSelector, LicenseFilters, AnimationFilters, CurrentSelections, and CategoryTree
const FiltersPanel = {
	view: function() {
		return m("div.box", [
			m("div.mb-4", m(Controls)),
			m("div.mb-4", m(BodyTypeSelector)),
			m(LicenseFilters),
			m(AnimationFilters),
			m("div.mb-4", m(CurrentSelections)),
			m(CategoryTree)
		]);
	}
};

// Animation Preview component
const AnimationPreview = {
	oninit: function(vnode) {
		vnode.state.selectedAnimation = 'walk';
		vnode.state.frameCycle = '';
	},
	oncreate: function(vnode) {
		// Wait for canvasRenderer to be available (module loads after this script)
		const initPreview = () => {
			if (window.canvasRenderer) {
				const previewCanvas = document.getElementById("previewAnimations");
				if (previewCanvas) {
					window.canvasRenderer.initPreviewCanvas(previewCanvas);
					// Set initial animation to 'walk' and get frame cycle
					const frames = window.canvasRenderer.setPreviewAnimation('walk');
					vnode.state.frameCycle = frames.join('-');
					window.canvasRenderer.startPreviewAnimation();

					m.redraw(); // Update view with frame cycle
				}
			} else {
				// Retry after a short delay
				setTimeout(initPreview, 50);
			}
		};
		initPreview();
	},
	onremove: function() {
		// Stop animation when component is removed
		if (window.canvasRenderer) {
			window.canvasRenderer.stopPreviewAnimation();
		}
	},
	view: function(vnode) {
		return [
			m("div.box", [
				m("h3.title.is-5", "Animation Preview"),
				m("div.field.is-horizontal", [
					m("div.field-label.is-normal", [
						m("label.label", "Animation")
					]),
					m("div.field-body", [
						m("div.field", [
							m("div.control", [
								m("div.select", [
									m("select", {
										value: vnode.state.selectedAnimation,
										onchange: (e) => {
											vnode.state.selectedAnimation = e.target.value;
											if (window.canvasRenderer) {
												const frames = window.canvasRenderer.setPreviewAnimation(e.target.value);
												vnode.state.frameCycle = frames.join('-');
											}
										}
									}, ANIMATIONS.map(anim =>
										m("option", { value: anim.value }, anim.label)
									))
								])
							])
						]),
						m("div.field", [
							m("div.control", [
								m("code.tag.is-light.is-medium", vnode.state.frameCycle)
							])
						])
					])
				]),
				m("div.mt-3", [
					m("canvas#previewAnimations", { width: 256, height: 64 })
				])
			]),
			m("div.box.mt-4", [
				m("div.is-flex.is-justify-content-space-between.is-align-items-center.mb-3", [
					m("div", [
						m("h3.title.is-5.mb-2", "Full Spritesheet Preview"),
						m("p", "Click to zoom in (2x), double-click to zoom out")
					]),
					m("label.checkbox", [
						m("input[type=checkbox]", {
							checked: state.showTransparencyGrid,
							onchange: (e) => {
								state.showTransparencyGrid = e.target.checked;
								renderCharacter();
							}
						}),
						" Show transparency grid"
					])
				])
			])
		];
	}
};

// Download component
const Download = {
	view: function() {
		// Helper to download file
		const downloadFile = (content, filename, type = "text/plain") => {
			const blob = new Blob([content], { type });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		};

		// Export to clipboard
		const exportToClipboard = async () => {
			if (!window.canvasRenderer) return;
			const json = window.canvasRenderer.exportStateAsJSON(state.selections, state.bodyType);
			try {
				await navigator.clipboard.writeText(json);
				alert('Exported to clipboard!');
			} catch (err) {
				console.error('Failed to copy to clipboard:', err);
				alert('Failed to copy to clipboard. Please check browser permissions.');
			}
		};

		// Import from clipboard
		const importFromClipboard = async () => {
			if (!window.canvasRenderer) return;
			try {
				const json = await navigator.clipboard.readText();
				const imported = window.canvasRenderer.importStateFromJSON(json);
				state.bodyType = imported.bodyType;
				state.selections = imported.selections;
				
				m.redraw(); // Force Mithril to update the UI
				alert('Imported successfully!');
			} catch (err) {
				console.error('Failed to import from clipboard:', err);
				alert('Failed to import. Please check clipboard content and browser permissions.');
			}
		};

		// Save as PNG
		const saveAsPNG = async () => {
			if (!window.canvasRenderer) return;

			// Use offscreen canvas for export (without transparency background)
			await window.canvasRenderer.downloadAsPNG('character-spritesheet.png', state.selections, state.bodyType);
		};

		// Export ZIP - Split by animation
		const exportSplitAnimations = async () => {
			if (!window.canvasRenderer || !window.JSZip) {
				alert('JSZip library not loaded');
				return;
			}

			try {
				const zip = new window.JSZip();
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
				const bodyType = state.bodyType;

				// Create folder structure to match original
				const standardFolder = zip.folder("standard");
				const customFolder = zip.folder("custom");
				const creditsFolder = zip.folder("credits");

				// Get available animations from canvas renderer
				const animationList = window.canvasRenderer.getAnimationList();
				const exportedStandard = [];
				const failedStandard = [];

				// Create animation PNGs in standard folder (no custom animations support yet)
				for (const anim of animationList) {
					try {
						const animCanvas = window.canvasRenderer.extractAnimationFromCanvas(anim.value);
						if (animCanvas) {
							const blob = await new Promise(resolve => animCanvas.toBlob(resolve, 'image/png'));
							standardFolder.file(`${anim.value}.png`, blob);
							exportedStandard.push(anim.value);
						}
					} catch (err) {
						console.error(`Failed to export animation ${anim.value}:`, err);
						failedStandard.push(anim.value);
					}
				}

				// Add character.json at root
				zip.file('character.json', window.canvasRenderer.exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections);
				creditsFolder.file('credits.txt', creditsToTxt(allCredits));
				creditsFolder.file('credits.csv', creditsToCsv(allCredits));

				// Add metadata.json in credits folder
				const metadata = {
					exportTimestamp: timestamp,
					bodyType: bodyType,
					standardAnimations: {
						exported: exportedStandard,
						failed: failedStandard
					},
					customAnimations: {
						exported: [],
						failed: []
					},
					frameSize: 64,
					frameCounts: {} // Would need to map animation frame counts
				};
				creditsFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

				// Generate and download ZIP
				const zipBlob = await zip.generateAsync({ type: 'blob' });
				const url = URL.createObjectURL(zipBlob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `lpc_${bodyType}_animations_${timestamp}.zip`;
				a.click();
				URL.revokeObjectURL(url);

				if (failedStandard.length > 0) {
					alert(`Export completed with some issues:\nFailed to export animations: ${failedStandard.join(', ')}`);
				} else {
					alert('Export complete!');
				}
			} catch (err) {
				console.error('Export failed:', err);
				alert(`Export failed: ${err.message}`);
			}
		};

		// Export ZIP - Split by item
		const exportSplitItemSheets = async () => {
			if (!window.canvasRenderer || !window.JSZip) {
				alert('JSZip library not loaded');
				return;
			}

			try {
				const zip = new window.JSZip();
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
				const bodyType = state.bodyType;

				// Create folder structure
				const itemsFolder = zip.folder("items");
				const creditsFolder = zip.folder("credits");

				const exportedItems = [];
				const failedItems = [];

				// Render each item individually
				for (const [categoryPath, selection] of Object.entries(state.selections)) {
					const { itemId, variant, name } = selection;
					const fileName = getItemFileName(itemId, variant, name);

					try {
						// Render just this one item
						const itemCanvas = await window.canvasRenderer.renderSingleItem(
							itemId,
							variant,
							bodyType,
							state.selections
						);

						if (itemCanvas) {
							const blob = await new Promise(resolve => itemCanvas.toBlob(resolve, 'image/png'));
							itemsFolder.file(`${fileName}.png`, blob);
							exportedItems.push(fileName);
						}
					} catch (err) {
						console.error(`Failed to export item ${fileName}:`, err);
						failedItems.push(fileName);
					}
				}

				// Add character.json at root
				zip.file('character.json', window.canvasRenderer.exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections);
				creditsFolder.file('credits.txt', creditsToTxt(allCredits));
				creditsFolder.file('credits.csv', creditsToCsv(allCredits));

				// Generate and download ZIP
				const zipBlob = await zip.generateAsync({ type: 'blob' });
				const url = URL.createObjectURL(zipBlob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `lpc_${bodyType}_item_spritesheets_${timestamp}.zip`;
				a.click();
				URL.revokeObjectURL(url);

				if (failedItems.length > 0) {
					alert(`Export completed with some issues:\nFailed items: ${failedItems.join(', ')}`);
				} else {
					alert('Export complete!');
				}
			} catch (err) {
				console.error('Export failed:', err);
				alert(`Export failed: ${err.message}`);
			}
		};

		// Export ZIP - Split by animation and item
		const exportSplitItemAnimations = async () => {
			if (!window.canvasRenderer || !window.JSZip) {
				alert('JSZip library not loaded');
				return;
			}

			try {
				const zip = new window.JSZip();
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
				const bodyType = state.bodyType;

				// Create folder structure
				const standardFolder = zip.folder("standard");
				const customFolder = zip.folder("custom");
				const creditsFolder = zip.folder("credits");

				// Get available animations
				const animationList = window.canvasRenderer.getAnimationList();
				const exportedStandard = {};
				const failedStandard = {};

				// For each animation, create a folder and export each item
				for (const anim of animationList) {
					const animFolder = standardFolder.folder(anim.value);
					if (!animFolder) continue;

					exportedStandard[anim.value] = [];
					failedStandard[anim.value] = [];

					// Export each item for this animation
					for (const [categoryPath, selection] of Object.entries(state.selections)) {
						const { itemId, variant, name } = selection;
						const fileName = getItemFileName(itemId, variant, name);

						try {
							// Render just this item for this animation
							const animCanvas = await window.canvasRenderer.renderSingleItemAnimation(
								itemId,
								variant,
								bodyType,
								anim.value,
								state.selections
							);

							if (animCanvas) {
								const blob = await new Promise(resolve => animCanvas.toBlob(resolve, 'image/png'));
								animFolder.file(`${fileName}.png`, blob);
								exportedStandard[anim.value].push(fileName);
							}
						} catch (err) {
							console.error(`Failed to export ${fileName} for ${anim.value}:`, err);
							failedStandard[anim.value].push(fileName);
						}
					}
				}

				// Add character.json at root
				zip.file('character.json', window.canvasRenderer.exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections);
				creditsFolder.file('credits.txt', creditsToTxt(allCredits));
				creditsFolder.file('credits.csv', creditsToCsv(allCredits));

				// Add metadata.json in credits folder
				const metadata = {
					exportTimestamp: timestamp,
					bodyType: bodyType,
					standardAnimations: {
						exported: exportedStandard,
						failed: failedStandard
					},
					customAnimations: {
						exported: {},
						failed: {}
					},
					frameSize: 64,
					frameCounts: {}
				};
				creditsFolder.file('metadata.json', JSON.stringify(metadata, null, 2));

				// Generate and download ZIP
				const zipBlob = await zip.generateAsync({ type: 'blob' });
				const url = URL.createObjectURL(zipBlob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `lpc_${bodyType}_item_animations_${timestamp}.zip`;
				a.click();
				URL.revokeObjectURL(url);

				// Report failures if any
				const failedCount = Object.values(failedStandard).reduce((sum, arr) => sum + arr.length, 0);
				if (failedCount > 0) {
					let msg = 'Export completed with some issues:\n';
					for (const [anim, items] of Object.entries(failedStandard)) {
						if (items.length > 0) {
							msg += `${anim}: ${items.join(', ')}\n`;
						}
					}
					alert(msg);
				} else {
					alert('Export complete!');
				}
			} catch (err) {
				console.error('Export failed:', err);
				alert(`Export failed: ${err.message}`);
			}
		};

		return m("div.box", [
			m("h3.title.is-5", "Download"),
			m("div.field", [
				m("label.label", "Download:"),
				m("div.buttons", [
					m("button.button.is-small", { onclick: saveAsPNG }, "Spritesheet (PNG)"),
					m("button.button.is-small", { onclick: () => {
						const allCredits = getAllCredits(state.selections);
						const csvContent = creditsToCsv(allCredits);
						downloadFile(csvContent, "credits.csv", "text/csv");
					}}, "Credits (CSV)")
				])
			]),
			m("div.field", [
				m("label.label", "Download image pack with credits and JSON (ZIP):"),
				m("div.buttons", [
					m("button.button.is-small", { onclick: exportSplitAnimations }, "Split by animation"),
					m("button.button.is-small", { onclick: exportSplitItemSheets }, "Split by item"),
					m("button.button.is-small", { onclick: exportSplitItemAnimations }, "Split by animation and item")
				])
			]),
			m("div.field", [
				m("label.label", "Import/Export:"),
				m("div.buttons", [
					m("button.button.is-small", { onclick: exportToClipboard }, "Export to Clipboard (JSON)"),
					m("button.button.is-small", { onclick: importFromClipboard }, "Import from Clipboard (JSON)")
				])
			])
		]);
	}
};

// Credits/Attribution component
const Credits = {
	view: function() {
		// Collect credits from all selected items
		const allCredits = getAllCredits(state.selections);

		const downloadFile = (content, filename) => {
			const blob = new Blob([content], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		};

		return m("div.box", [
			m("h3.title.is-5", "Credits & Attribution"),
			m("p.subtitle.is-6", "You must credit the authors of this artwork"),

			allCredits.length > 0 ? [
				m("div.content", { style: "max-height: 300px; overflow-y: auto;" },
					allCredits.map(credit =>
						m("div.mb-3", { key: credit.file }, [
							m("strong", credit.file),
							credit.notes ? m("p.is-size-7", credit.notes) : null,
							m("p.is-size-7", [
								m("strong", "Licenses: "),
								credit.licenses.join(", ")
							]),
							m("p.is-size-7", [
								m("strong", "Authors: "),
								credit.authors.join(", ")
							])
						])
					)
				),
				m("div.buttons.mt-3", [
					m("button.button.is-small", {
						onclick: () => downloadFile(creditsToTxt(allCredits), "credits.txt")
					}, "Download TXT"),
					m("button.button.is-small", {
						onclick: () => downloadFile(creditsToCsv(allCredits), "credits.csv")
					}, "Download CSV")
				])
			] : m("p.has-text-grey", "No items selected")
		]);
	}
};

// Render the character canvas based on current state
function renderCharacter() {
	if (window.canvasRenderer) {
		window.canvasRenderer.renderCharacter(state.selections, state.bodyType, state.showTransparencyGrid);
	}
}

// Main app component
const App = {
	oninit: function(vnode) {
		// Track previous state to detect changes
		vnode.state.prevSelections = JSON.stringify(state.selections);
		vnode.state.prevBodyType = state.bodyType;
	},
	onupdate: function(vnode) {
		// Only sync hash and render canvas if selections or bodyType changed
		const currentSelections = JSON.stringify(state.selections);
		const currentBodyType = state.bodyType;

		if (currentSelections !== vnode.state.prevSelections || currentBodyType !== vnode.state.prevBodyType) {
			syncSelectionsToHash();
			renderCharacter();

			// Update tracked state
			vnode.state.prevSelections = currentSelections;
			vnode.state.prevBodyType = currentBodyType;
		}
	},
	view: function() {
		return m("div", [
			m(FiltersPanel),
			m(Download),
			m(Credits)
		]);
	}
};

// Initialize palette recoloring system BEFORE mounting components
window.paletteSystemInitStarted = true;
(async function() {
	await initializePaletteRecoloring();

	// Mount the components after palette system is ready
	m.mount(document.getElementById("mithril-filters"), App);
	m.mount(document.getElementById("mithril-preview"), AnimationPreview);
})();

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
		console.log('Hash changed by us, ignoring');
		lastKnownHash = currentHash;
		return;
	}

	console.log('Hash changed externally (back/forward button), reloading selections from URL');

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

// Expose initialization to be called after canvas init
window.setDefaultSelections = async function() {
	// Wait for palette system to be ready before rendering
	// This prevents trying to load body variants before palettes are initialized
	while (!state.paletteRecoloring.enabled && state.paletteRecoloring.palettes === null) {
		// Check if palette system failed to load (both enabled=false and palettes=null means it hasn't tried yet)
		// If it failed, enabled will be false but we'll have tried, so break after a timeout
		await new Promise(resolve => setTimeout(resolve, 50));

		// Timeout after 5 seconds to prevent infinite loop
		if (!window.paletteSystemInitStarted) break;
	}

	// First, try to load from URL hash
	loadSelectionsFromHash();

	// If nothing in hash, set defaults
	if (Object.keys(state.selections).length === 0) {
		selectDefaults();
	} else {
		// Render with loaded selections
		if (window.canvasRenderer) {
			window.canvasRenderer.renderCharacter(state.selections, state.bodyType);
		}
	}

	// Note: m.redraw() not needed - called from oninit which auto-redraws after lifecycle hooks
};

// Expose palette system for canvas renderer
window.getPaletteSystem = function() {
	return state.paletteRecoloring;
};

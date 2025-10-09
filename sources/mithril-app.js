// Mithril-based character generator
// Clean rewrite without jQuery dependencies

// Global state
const state = {
	selections: {}, // key: category path, value: { itemId, name }
	bodyType: "male", // male, female, teen, child, muscular, pregnant
	expandedNodes: {}, // key: path string, value: boolean (true if expanded)
	searchQuery: "" // current search query
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
	if (state.bodyType !== "male") {
		params.bodyType = state.bodyType;
	}

	// Add selections - use itemId as key (without variant suffix if present)
	// itemId "body-body" with variant "light" -> "body-body=light"
	// itemId "body-shadow" with variant "shadow" -> "body-shadow=shadow"
	// itemId "head-heads-heads_human_male" with variant "light" -> "head-heads-heads_human_male=light"
	for (const [categoryPath, selection] of Object.entries(state.selections)) {
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

	// Load body type
	if (params.bodyType) {
		state.bodyType = params.bodyType;
	}

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

		// Build category path from metadata
		// For 2-element paths like ["body", "body"], use full path "body/body"
		// For 3+ element paths like ["head", "heads", "heads_human_male"], use all but last "head/heads"
		const categoryPath = meta.path.length === 2
			? meta.path.join('/')
			: meta.path.slice(0, -1).join('/');

		// Use the variant from URL, or first variant, or empty string
		const actualVariant = variant || meta.variants?.[0] || '';

		console.log(`Loading: itemId=${itemId}, categoryPath=${categoryPath}, variant=${actualVariant}`);

		// Store selection
		state.selections[categoryPath] = {
			itemId: itemId,
			variant: actualVariant,
			name: meta.name + (actualVariant ? ` (${actualVariant})` : '')
		};
	}

	console.log('Final selections after load:', state.selections);
}

// Select default items (body color light + human male light head)
function selectDefaults() {
	// Set default body color (light)
	state.selections["body/body"] = {
		itemId: "body-body",
		variant: "light",
		name: "Body color (light)"
	};

	// Set default head (human male light)
	state.selections["head/heads"] = {
		itemId: "head-heads-heads_human_male",
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

// Helper function to capitalize strings for display
function capitalize(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper function to collect credits from all selected items
function getAllCredits(selections) {
	const allCredits = [];
	const seenFiles = new Set();

	for (const [categoryPath, selection] of Object.entries(selections)) {
		const { itemId } = selection;
		const meta = window.itemMetadata[itemId];

		if (meta && meta.credits) {
			for (const credit of meta.credits) {
				// Avoid duplicates based on file name
				if (!seenFiles.has(credit.file)) {
					seenFiles.add(credit.file);
					allCredits.push(credit);
				}
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
		const { itemId, meta, categoryPath, isSearchMatch } = vnode.attrs;
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
					const isSelected = state.selections[categoryPath]?.variant === variant;
					const variantDisplayName = variant.replaceAll("_", " ");

					return m("div", {
						key: variant,
						style: "padding: 0.25rem 0 0.25rem 1.5rem; cursor: pointer;" + (isSelected ? " font-weight: bold; color: #3273dc;" : ""),
						onclick: () => {
							state.selections[categoryPath] = {
								itemId: itemId,
								variant: variant,
								name: `${displayName} (${variantDisplayName})`
							};
							triggerRender();
						}
					}, capitalize(variantDisplayName));
				})
			) : null
		]);
	}
};

// Body type selector component
const BodyTypeSelector = {
	view: function() {
		const bodyTypes = ["male", "female", "teen", "child", "muscular", "pregnant"];

		return m("div.box", [
			m("h3.title.is-5", "Body Type"),
			m("div.buttons",
				bodyTypes.map(type =>
					m("button.button", {
						class: state.bodyType === type ? "is-primary" : "",
						onclick: () => {
							state.bodyType = type;
							triggerRender();
						}
					}, capitalize(type))
				)
			)
		]);
	}
};

// Controls component (Reset All + Search)
const Controls = {
	view: function() {
		return m("div.box", [
			m("h3.title.is-5", "Controls"),
			m("div.field", [
				m("button.button.is-danger.is-small", {
					onclick: resetAll
				}, "Reset all")
			]),
			m("div.field", [
				m("label.label", "Search:"),
				m("input.input[type=search][placeholder=Search]", {
					value: state.searchQuery,
					oninput: (e) => {
						state.searchQuery = e.target.value;
					}
				})
			])
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

						return true;
					})
					.map(itemId => {
						const meta = window.itemMetadata[itemId];
						const displayName = meta.name;
						const categoryPath = meta.path.slice(0, -1).join("-");
						const hasVariants = meta.variants && meta.variants.length > 0;
						const isSearchMatch = searchQuery && searchQuery.length >= 2 && matchesSearch(meta.name, searchQuery);

						if (!hasVariants) {
							// Simple item with no variants
							const isSelected = state.selections[categoryPath]?.itemId === itemId;
							return m("div", {
								key: itemId,
								class: isSearchMatch ? "search-result" : "",
								style: "padding: 0.25rem 0 0.25rem 1.5rem; cursor: pointer;" + (isSelected ? " font-weight: bold; color: #3273dc;" : ""),
								onclick: () => {
									state.selections[categoryPath] = { itemId, name: displayName };
									triggerRender();
								}
							}, displayName);
						}

						// Item with variants - create a sub-component
						return m(ItemWithVariants, { key: itemId, itemId, meta, categoryPath, isSearchMatch });
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
			return m("div.box", [
				m("h3.title.is-5", "Current Selections"),
				m("p.has-text-grey", "No items selected yet")
			]);
		}

		return m("div.box", [
			m("h3.title.is-5", "Current Selections"),
			m("div.tags",
				Object.entries(state.selections).map(([categoryPath, selection]) => {
					return m("span.tag.is-info.is-medium", { key: categoryPath }, [
						m("span", selection.name),
						m("button.delete.is-small", {
							onclick: () => {
								delete state.selections[categoryPath];
								triggerRender();
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

		return m("div.box", [
			m("div", { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;" }, [
				m("h3.title.is-5", { style: "margin-bottom: 0;" }, "Available Items"),
				m("div.buttons", { style: "margin-bottom: 0;" }, [
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

// Animation list - matches canvas-renderer.js ANIMATION_CONFIGS
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
		return m("div.box", [
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
		]);
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
				triggerRender();
				m.redraw(); // Force Mithril to update the UI
				alert('Imported successfully!');
			} catch (err) {
				console.error('Failed to import from clipboard:', err);
				alert('Failed to import. Please check clipboard content and browser permissions.');
			}
		};

		// Save as PNG
		const saveAsPNG = () => {
			if (!window.canvasRenderer) return;
			window.canvasRenderer.downloadAsPNG('character-spritesheet.png');
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

// Trigger canvas re-render when state changes
function triggerRender() {
	// Sync to URL hash
	syncSelectionsToHash();

	// Render character
	if (window.canvasRenderer) {
		window.canvasRenderer.renderCharacter(state.selections, state.bodyType);
	}
}

// Main app component
const App = {
	view: function() {
		return m("div", [
			m(BodyTypeSelector),
			m(Controls),
			m(CurrentSelections),
			m(Download),
			m(CategoryTree),
			m(Credits)
		]);
	}
};

// Mount the components
m.mount(document.getElementById("mithril-filters"), App);
m.mount(document.getElementById("mithril-preview"), AnimationPreview);

// Expose initialization to be called after canvas init
window.setDefaultSelections = function() {
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

	// Redraw Mithril UI to show loaded selections
	m.redraw();
};

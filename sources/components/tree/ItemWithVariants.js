// Item with variants component
import { state, getSelectionGroup, applyMatchBodyColor } from '../../state/state.js';
import { getImageToDraw, getPaletteForItem } from '../../canvas/palette-recolor.js';
import { replaceInPath } from '../../state/path.js';
import { variantToFilename, capitalize } from '../../utils/helpers.js';

export const ItemWithVariants = {
	view: function(vnode) {
		const { itemId, meta, isSearchMatch } = vnode.attrs;
		const compactDisplay = state.compactDisplay;
		const displayName = meta.name;
		const rootViewNode = vnode;
		let nodePath = itemId;
		if (displayName === 'Body color') {
			nodePath = 'body-body';
		}
		const isExpanded = state.expandedNodes[nodePath] || false;

		return m("div", {
			class: isSearchMatch ? "search-result" : ""
		}, [
			m("div.tree-label", {
				onclick: () => {
					state.expandedNodes[nodePath] = !isExpanded;
				},
				oninit: () => {
					rootViewNode.state.isLoading = meta.variants.length > 0;
					rootViewNode.state.imagesToLoad = meta.variants.length;
					rootViewNode.state.imagesLoaded = 0;
				},
				onupdate: () => {
					if (isExpanded && rootViewNode.state.isLoading) {
						if (rootViewNode.state.imagesLoaded >= rootViewNode.state.imagesToLoad) {
							rootViewNode.state.isLoading = false;
						}
					}
				}
			}, [
				m("span.tree-arrow", { class: isExpanded ? 'expanded' : 'collapsed' }),
				m("span", displayName)
			]),
			isExpanded ? m("div", [
				m("div", { class: rootViewNode.state.isLoading ? "loading" : "" }),
				m("div.variants-container.ml-5.is-flex.is-flex-wrap-wrap",
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
					const layer1CustomAnimation = hasCustomAnimation ? layer1.custom_animation : null;

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

					return m("div.variant-item.is-flex.is-flex-direction-column.is-align-items-center.is-clickable", {
						key: variant,
						class: isSelected ? "has-background-link-light has-text-weight-bold has-text-link" : "",
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

							if (isSelected) {
								delete state.selections[selectionGroup];
							} else {
								state.selections[selectionGroup] = {
									itemId: itemId,
									variant: variant,
									name: `${displayName} (${variantDisplayName})`
								};

								// If this item has matchBodyColor enabled, apply to all other body-colored items
								if (meta.matchBodyColor) {
									applyMatchBodyColor(variant);
								}
							}
						}
					}, [
						m("span.variant-display-name.has-text-centered.is-size-7",
							capitalize(variantDisplayName)),
						m("canvas.variant-canvas.box.p-0", {
							width: 64,
							height: 64,
							class: (compactDisplay ? " compact-display" : ""),
							style: (isSelected ? " hsl(217, 71%, 53%)" : " hsl(0, 0%, 86%)"),
							oncreate: (canvasVnode) => {
								const canvas = canvasVnode.dom;
								const ctx = canvas.getContext('2d', { willReadFrequently: true });

								// Collect all layers for this item
								// Only include layers that match layer_1's custom animation (if any)
								const layersToLoad = [];

								// Check if item uses a palette - if so, load the source variant
								const paletteConfig = getPaletteForItem(itemId, meta);
								const loadVariant = paletteConfig ? paletteConfig.sourceVariant : variant;

								for (let layerNum = 1; layerNum < 10; layerNum++) {
									const layer = meta.layers?.[`layer_${layerNum}`];
									if (!layer) break;

									let layerPath = layer[state.bodyType];
									if (!layerPath) continue;

									// Filter: only include layers with matching custom animation
									if (layer1CustomAnimation) {
										if (layer.custom_animation !== layer1CustomAnimation) {
											continue; // Skip layers with different custom animations
										}
									}

									// Replace template variables like ${head}
									if (layerPath.includes('${')) {
										layerPath = replaceInPath(layerPath, state.selections, meta);
									}

									const hasCustomAnim = layer.custom_animation;
									let imagePath;
									if (hasCustomAnim) {
										imagePath = `spritesheets/${layerPath}${variantToFilename(loadVariant)}.png`;
									} else {
										const defaultAnim = meta.animations.includes('walk') ? 'walk' : meta.animations[0];
										imagePath = `spritesheets/${layerPath}${defaultAnim}/${variantToFilename(loadVariant)}.png`;
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
								})).then(async loadedLayers => {
									canvas.loadedLayers = loadedLayers;
									// Draw each layer in zPos order
									// Use universalFrameSize (64) for all calculations, matching master branch
									const universalFrameSize = 64;
									for (const { img, layer } of loadedLayers) {
										if (img) {
											const imageToDraw = await getImageToDraw(img, itemId, variant);
											const size = compactDisplay ? 32 : 64;
											// Master branch uses: previewColumn * universalFrameSize + previewXOffset
											const srcX = previewCol * universalFrameSize + previewXOffset;
											const srcY = previewRow * universalFrameSize + previewYOffset;
											ctx.drawImage(
												imageToDraw,
												srcX, srcY, universalFrameSize, universalFrameSize,
												0, 0, size, size
											);
										}
									}
									rootViewNode.state.imagesLoaded++;
									m.redraw();
								});
							},
							onupdate: (canvasVnode) => {
								const canvas = canvasVnode.dom;
								const ctx = canvas.getContext('2d', { willReadFrequently: true });
								if (canvas.loadedLayers) {
									// Draw each layer in zPos order
									// Use universalFrameSize (64) for all calculations, matching master branch
									const universalFrameSize = 64;
									for (const { img, layer } of canvas.loadedLayers) {
										if (img) {
											const size = compactDisplay ? 32 : 64;
											// Master branch uses: previewColumn * universalFrameSize + previewXOffset
											const srcX = previewCol * universalFrameSize + previewXOffset;
											const srcY = previewRow * universalFrameSize + previewYOffset;
											ctx.drawImage(
												img,
												srcX, srcY, universalFrameSize, universalFrameSize,
												0, 0, size, size
											);
										}
									}
								}
							}
						})
					]);
				}))
			]) : null
		]);
	}
};

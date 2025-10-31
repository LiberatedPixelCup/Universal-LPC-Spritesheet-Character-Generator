// Download component
import { state } from '../../state/state.js';
import { extractAnimationFromCanvas, renderSingleItem, renderSingleItemAnimation, layers } from '../../canvas/renderer.js';
import { getAllCredits, creditsToCsv, creditsToTxt, getItemFileName } from '../../utils/credits.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import { downloadFile, downloadAsPNG } from '../../canvas/download.js';
import { importStateFromJSON, exportStateAsJSON } from '../../state/json.js';
import { ANIMATIONS } from '../../state/constants.js';

export const Download = {
	view: function() {
		// Export to clipboard
		const exportToClipboard = async () => {
			if (!window.canvasRenderer) return;
			try {
				const json = exportStateAsJSON(state, layers);
				if (window.DEBUG) console.log(json);
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
				if (window.DEBUG) console.log(json);
				const imported = importStateFromJSON(json);
				Object.assign(state, imported);

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

			// Export offscreen canvas directly
			downloadAsPNG('character-spritesheet.png');
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
				const animationList = ANIMATIONS;;
				const exportedStandard = [];
				const failedStandard = [];

				// Create animation PNGs in standard folder (no custom animations support yet)
				for (const anim of animationList) {
					try {
						const animCanvas = extractAnimationFromCanvas(anim.value);
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
				zip.file('character.json', exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections, state.bodyType);
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
						const itemCanvas = await renderSingleItem(
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
				zip.file('character.json', exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections, state.bodyType);
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
				const animationList = ANIMATIONS;
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
							const animCanvas = await renderSingleItemAnimation(
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
				zip.file('character.json', exportStateAsJSON(state.selections, state.bodyType));

				// Add credits in credits folder
				const allCredits = getAllCredits(state.selections, state.bodyType);
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

		return m(CollapsibleSection, {
			title: "Download",
			storageKey: "download",
			defaultOpen: true
		}, [
			m("div.buttons.is-flex.is-flex-wrap-wrap", { id: "download-buttons" }, [
				m("button.button.is-small.is-primary", { onclick: saveAsPNG }, "Spritesheet (PNG)"),
				m("button.button.is-small", { onclick: () => {
					const allCredits = getAllCredits(state.selections, state.bodyType);
					const txtContent = creditsToTxt(allCredits);
					downloadFile(txtContent, "credits.txt", "text/plain");
				}}, "Credits (TXT)"),
				m("button.button.is-small", { onclick: () => {
					const allCredits = getAllCredits(state.selections, state.bodyType);
					const csvContent = creditsToCsv(allCredits);
					downloadFile(csvContent, "credits.csv", "text/csv");
				}}, "Credits (CSV)"),
				m("button.button.is-small.is-info", { onclick: exportSplitAnimations }, "ZIP: Split by animation"),
				m("button.button.is-small.is-info", { onclick: exportSplitItemSheets }, "ZIP: Split by item"),
				m("button.button.is-small.is-info", { onclick: exportSplitItemAnimations }, "ZIP: Split by animation and item"),
				m("button.button.is-small.is-link", { onclick: exportToClipboard }, "Export to Clipboard (JSON)"),
				m("button.button.is-small.is-link", { onclick: importFromClipboard }, "Import from Clipboard (JSON)")
			])
		]);
	}
};

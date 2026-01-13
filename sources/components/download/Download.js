// Download component
import { state } from '../../state/state.js';
import { layers } from '../../canvas/renderer.js';
import { getAllCredits, creditsToCsv, creditsToTxt } from '../../utils/credits.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import { downloadFile, downloadAsPNG } from '../../canvas/download.js';
import { importStateFromJSON, exportStateAsJSON } from '../../state/json.js';
import { exportSplitAnimations, exportSplitItemSheets, exportSplitItemAnimations } from '../../state/zip.js';

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
				state.zipByAnimation.isRunning ? m("span.loading") : null,
				m("button.button.is-small.is-info", { onclick: exportSplitItemSheets }, "ZIP: Split by item"),
				state.zipByItem.isRunning ? m("span.loading") : null,
				m("button.button.is-small.is-info", { onclick: exportSplitItemAnimations }, "ZIP: Split by animation and item"),
				state.zipByAnimimationAndItem.isRunning ? m("span.loading") : null,
				m("button.button.is-small.is-link", { onclick: exportToClipboard }, "Export to Clipboard (JSON)"),
				m("button.button.is-small.is-link", { onclick: importFromClipboard }, "Import from Clipboard (JSON)")
			])
		]);
	}
};

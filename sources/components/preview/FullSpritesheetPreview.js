// Full Spritesheet Preview component
import { state } from '../../state/state.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import PinchToZoom from './PinchToZoom.js';
import { copyToPreviewCanvas } from '../../canvas/preview-canvas.js';
import { applyTransparencyMaskToCanvas } from '../../canvas/mask.js';
import { ScrollableContainer } from './ScrollableContainer.js';

// Canvas wrapper component with its own lifecycle
const SpritesheetCanvas = {
	oncreate: function(vnode) {
		const canvas = vnode.dom;
		const showTransparencyGrid = vnode.attrs.showTransparencyGrid;
		const zoomLevel = vnode.attrs.zoomLevel;

		if (!window.canvasRenderer) {
			console.warn('Canvas renderer not available yet');
			return;
		}

		// Copy from offscreen canvas to preview canvas
		copyToPreviewCanvas(canvas, showTransparencyGrid, zoomLevel);

		vnode.state.zoomLevel = zoomLevel;
		new PinchToZoom(canvas, (scale) => {
			// Update zoom level on pinch
			vnode.state.zoomLevel = scale;
			// Trigger re-render to update preview canvas zoom
			m.redraw();
			// Apply zoom to canvas
			copyToPreviewCanvas(canvas, showTransparencyGrid, vnode.state.zoomLevel);

			state.fullSpritesheetCanvasZoomLevel = vnode.state.zoomLevel;
		}, vnode.state.zoomLevel);
	},
	onupdate: function(vnode) {
		const canvas = vnode.dom;
		const showTransparencyGrid = vnode.attrs.showTransparencyGrid;
		const zoomLevel = vnode.attrs.zoomLevel;

		if (!window.canvasRenderer) {
			return;
		}

		m.redraw();

		// Copy from offscreen canvas to preview canvas
		copyToPreviewCanvas(canvas, showTransparencyGrid, zoomLevel);
	},
	view: function() {
		return m("canvas#spritesheet-preview");
	}
};

export const FullSpritesheetPreview = {
	oninit: function(vnode) {
		// Initialize zoom level to 1 (100%)
		vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
	},
	onupdate: function(vnode) {
		// When state changes (selections, bodyType, etc.), preview canvas needs to update
		// The SpritesheetCanvas component will handle the actual copy in its onupdate
		vnode.state.zoomLevel = state.fullSpritesheetCanvasZoomLevel || 1;
	},
	view: function(vnode) {
		return m(CollapsibleSection, {
			title: "Full Spritesheet Preview",
			storageKey: "spritesheet-preview",
			defaultOpen: true,
			boxClass: "box mt-4"
		}, [
			m("div.columns.is-mobile.is-variable.is-1.is-multiline", [
				// Transparency grid column
				m("div.column.is-narrow.is-flex.is-align-items-center", [
					m("label.checkbox", [
						m("input[type=checkbox]", {
							checked: state.showTransparencyGrid,
							onchange: (e) => {
								state.showTransparencyGrid = e.target.checked;
								// Trigger re-render to update preview canvas
								m.redraw();
							}
						}),
						" Show transparency grid"
					])
				]),
				// Replace Mask (Pink) column
				m("div.column.is-narrow.is-flex.is-align-items-center", [
					m("button.button.is-small.is-info.mx-4", {
						onclick: () => {
							// Replace pink mask color with current body color in offscreen canvas
							if (window.canvasRenderer) {
								applyTransparencyMaskToCanvas();
								// Trigger re-render to update preview canvas after replacement
								m.redraw();
							}
						}
					}, "Replace Mask (Pink)")
				]),
				// Zoom column
				m("div.column", [
					m("div.field.is-horizontal.is-align-items-center", [
						m("div.field-label.is-normal", [
							m("label.label.mb-0", `Zoom: ${Math.round(vnode.state.zoomLevel * 100)}%`)
						]),
						m("div.field-body", [
							m("div.field.mb-0", [
								m("div.control.is-expanded", [
									m("input.is-fullwidth[type=range]", {
										min: 0.5,
										max: 2,
										step: 0.1,
										value: vnode.state.zoomLevel,
										oninput: (e) => {
											vnode.state.zoomLevel = parseFloat(e.target.value);
											state.fullSpritesheetCanvasZoomLevel = vnode.state.zoomLevel;
											// Trigger re-render to update preview canvas zoom
											m.redraw();
										}
									})
								])
							])
						])
					])
				])
			]),
			// Render preview canvas with drag-to-scroll
			m(ScrollableContainer, [
				m(SpritesheetCanvas, {
					showTransparencyGrid: state.showTransparencyGrid,
					zoomLevel: vnode.state.zoomLevel
				})
			])
		]);
	}
};

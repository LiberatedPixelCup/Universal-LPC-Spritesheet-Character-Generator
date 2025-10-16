// Full Spritesheet Preview component
import { state } from '../../state/state.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import PinchToZoom from './PinchToZoom.js';

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
		window.canvasRenderer.copyToPreviewCanvas(canvas, showTransparencyGrid, zoomLevel);

		vnode.state.zoomLevel = zoomLevel;
		new PinchToZoom(canvas, (scale) => {
			// Update zoom level on pinch
			vnode.state.zoomLevel = scale;
			// Trigger re-render to update preview canvas zoom
			m.redraw();
			// Apply zoom to canvas
			window.canvasRenderer.copyToPreviewCanvas(canvas, showTransparencyGrid, vnode.state.zoomLevel);

			state.fullSpritesheetCanvasZoomLevel = vnode.state.zoomLevel;
		}, vnode.state.zoomLevel);
	},
	onupdate: function(vnode) {
		const canvas = vnode.dom;
		const showTransparencyGrid = vnode.attrs.showTransparencyGrid;
		const zoomLevel = vnode.state.zoomLevel;

		if (!window.canvasRenderer) {
			return;
		}

		// Copy from offscreen canvas to preview canvas
		window.canvasRenderer.copyToPreviewCanvas(canvas, showTransparencyGrid, zoomLevel);
	},
	view: function() {
		return m("canvas#spritesheet-preview");
	}
};

// Scrollable container with drag-to-scroll support
const ScrollableContainer = {
	oninit: function(vnode) {
		vnode.state.isDragging = false;
		vnode.state.startX = 0;
		vnode.state.startY = 0;
		vnode.state.scrollLeft = 0;
		vnode.state.scrollTop = 0;
	},
	oncreate: function(vnode) {
		const container = vnode.dom;

		// Mouse down - start dragging
		container.addEventListener('mousedown', (e) => {
			vnode.state.isDragging = true;
			vnode.state.startX = e.pageX - container.offsetLeft;
			vnode.state.startY = e.pageY - container.offsetTop;
			vnode.state.scrollLeft = container.scrollLeft;
			vnode.state.scrollTop = container.scrollTop;
			container.style.cursor = 'grabbing';
		});

		// Mouse leave/up - stop dragging
		const stopDragging = () => {
			vnode.state.isDragging = false;
			container.style.cursor = 'grab';
		};

		container.addEventListener('mouseleave', stopDragging);
		container.addEventListener('mouseup', stopDragging);

		// Mouse move - drag scroll
		container.addEventListener('mousemove', (e) => {
			if (!vnode.state.isDragging) return;
			e.preventDefault();
			const x = e.pageX - container.offsetLeft;
			const y = e.pageY - container.offsetTop;
			const walkX = (x - vnode.state.startX) * 1.5; // Scroll speed multiplier
			const walkY = (y - vnode.state.startY) * 1.5;
			container.scrollLeft = vnode.state.scrollLeft - walkX;
			container.scrollTop = vnode.state.scrollTop - walkY;
		});
	},
	view: function(vnode) {
		return m("div.scrollable-container.mt-3", vnode.children);
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
			m("div.columns.is-mobile.is-variable.is-1", [
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
			m("div", { class: state.isRenderingCharacter ? "loading" : "" }),
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

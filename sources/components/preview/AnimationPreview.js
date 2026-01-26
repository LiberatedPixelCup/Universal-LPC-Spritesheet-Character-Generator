// Animation Preview component
import { state } from '../../state/state.js';
import { ANIMATIONS } from '../../state/constants.js';
import { CollapsibleSection } from '../CollapsibleSection.js';
import { setPreviewAnimation, startPreviewAnimation, stopPreviewAnimation } from '../../canvas/preview-animation.js';
import { initPreviewCanvas, setPreviewCanvasZoom } from '../../canvas/preview-canvas.js';
import PinchToZoom from './PinchToZoom.js';
import { getCustomAnimations } from '../../canvas/preview-animation.js';
import { ScrollableContainer } from './ScrollableContainer.js';

// Canvas wrapper component with its own lifecycle
const PreviewCanvas = {
	oncreate: function(vnode) {
		const canvas = vnode.dom;
		const selectedAnimation = vnode.attrs.selectedAnimation;
		const onFrameCycleUpdate = vnode.attrs.onFrameCycleUpdate;
		const zoomLevel = vnode.attrs.zoomLevel || 1;

		if (!window.canvasRenderer) {
			console.warn('Canvas renderer not available yet');
			return;
		}

		initPreviewCanvas(canvas);
		const frames = setPreviewAnimation(selectedAnimation);
		startPreviewAnimation();

		if (onFrameCycleUpdate && frames) {
			onFrameCycleUpdate(frames.join('-'));
		}

		vnode.state.zoomLevel = zoomLevel;
		vnode.state.lastAnimation = selectedAnimation;
		new PinchToZoom(canvas, (scale) => {
			// Update zoom level on pinch
			vnode.state.zoomLevel = scale;

			if (window.canvasRenderer) {
				m.redraw();
				setPreviewCanvasZoom(vnode.state.zoomLevel);
			}

			state.previewCanvasZoomLevel = vnode.state.zoomLevel;
		}, vnode.state.zoomLevel);
	},
	onupdate: function(vnode) {
		const selectedAnimation = vnode.attrs.selectedAnimation;

		// If animation changed, reinitialize canvas with new frameSize
		if (vnode.state.lastAnimation !== selectedAnimation) {
			if (window.canvasRenderer) {
				stopPreviewAnimation();
				setPreviewAnimation(selectedAnimation);
				initPreviewCanvas(vnode.dom);
				startPreviewAnimation();
			}
			vnode.state.lastAnimation = selectedAnimation;
		}

		vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
	},
	onremove: function() {
		// Stop animation when canvas is removed from DOM
		if (window.canvasRenderer) {
			stopPreviewAnimation();
		}
	},
	view: function(vnode) {
		return m("canvas#previewAnimations");
	}
};

export const AnimationPreview = {
	oninit: function(vnode) {
		vnode.state.selectedAnimation = 'walk';
		vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
		// Initialize frame cycle for default animation
		if (window.canvasRenderer) {
			const frames = setPreviewAnimation('walk');
			vnode.state.frameCycle = frames ? frames.join('-') : '';
		} else {
			vnode.state.frameCycle = '';
		}
	},
	onupdate: function(vnode) {
		vnode.state.zoomLevel = state.previewCanvasZoomLevel || 1;
	},
	view: function(vnode) {
		// Combine standard animations with custom animations from current render
		const customAnims = Object.keys(getCustomAnimations());
		const allAnimations = [
			...ANIMATIONS,
			...customAnims.map(anim => ({
				value: anim,
				label: anim.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
			}))
		];

		if (!allAnimations.find(anim => anim.value === vnode.state.selectedAnimation)) {
			// Selected animation is no longer available, reset to default
			vnode.state.selectedAnimation = 'walk';
			state.selectedAnimation = 'walk';
			if (window.canvasRenderer) {
				const frames = setPreviewAnimation('walk');
				vnode.state.frameCycle = frames ? frames.join('-') : '';
			}
		}

		return m(CollapsibleSection, {
			title: "Animation Preview",
			storageKey: "animation-preview",
			defaultOpen: true,
			boxClass: "box"
		}, [
			m("div.columns.is-multiline", [
				// Animation column
				m("div.column", [
					m("div.field.is-horizontal.is-align-items-center", [
						m("div.field-label.is-normal", [
							m("label.label.mb-0", "Animation")
						]),
						m("div.field-body", [
							m("div.field.has-addons.mb-0", [
								m("div.control", [
									m("div.select", [
										m("select", {
											value: vnode.state.selectedAnimation,
											onchange: (e) => {
												vnode.state.selectedAnimation = e.target.value;
												state.selectedAnimation = vnode.state.selectedAnimation;
												if (window.canvasRenderer) {
													const frames = setPreviewAnimation(e.target.value);
													vnode.state.frameCycle = frames ? frames.join('-') : '';
												}
											}
										}, allAnimations.map(anim =>
											m("option", { value: anim.value }, anim.label)
										))
									])
								]),
								m("div.control", [
									m("span.button.is-static.is-light", vnode.state.frameCycle)
								])
							])
						])
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
											state.previewCanvasZoomLevel = vnode.state.zoomLevel;
											if (window.canvasRenderer) {
												setPreviewCanvasZoom(vnode.state.zoomLevel);
											}
										}
									})
								])
							])
						])
					])
				])
			]),
			m("div.mt-3", [
				m("div", { class: state.isRenderingCharacter ? "loading" : "" }),
				// Render preview canvas with drag-to-scroll
				m(ScrollableContainer, [
					m(PreviewCanvas, {
						selectedAnimation: vnode.state.selectedAnimation,
						zoomLevel: vnode.state.zoomLevel,
						onFrameCycleUpdate: (frameCycle) => {
							vnode.state.frameCycle = frameCycle;
						}
					})
				])
			])
		]);
	}
};

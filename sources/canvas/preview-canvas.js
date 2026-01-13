import { canvas } from "./renderer.js";
import { drawTransparencyBackground, get2DContext } from "./canvas-utils.js";
import { FRAME_SIZE } from "../state/constants.js";
import { applyTransparencyMaskToCanvas } from "./mask.js";
import { activeCustomAnimation, getCustomAnimations } from "./preview-animation.js";

let previewCanvas = null;
let previewCtx = null;

export { previewCanvas, previewCtx };

/**
 * Copy offscreen canvas to a preview canvas with optional transparency grid
 * @param {HTMLCanvasElement} previewCanvasElement - The preview canvas to copy to
 * @param {boolean} showTransparencyGrid - Whether to draw transparency grid background
 * @param {boolean} applyTransparencyMask - Whether to apply transparency mask
 * @param {number} zoomLevel - Zoom level to apply (optional, will use CSS zoom)
 */
export function copyToPreviewCanvas(
	previewCanvasElement,
	showTransparencyGrid = false,
	applyTransparencyMask = false,
	zoomLevel = 1
) {
	if (!canvas || !previewCanvasElement) {
		console.error("Canvas not initialized");
		return;
	}

	const previewCtx = get2DContext(previewCanvasElement);

	// Match preview canvas size to offscreen canvas
	previewCanvasElement.width = canvas.width;
	previewCanvasElement.height = canvas.height;

	// Clear preview canvas
	previewCtx.clearRect(
		0,
		0,
		previewCanvasElement.width,
		previewCanvasElement.height
	);

	// Optionally draw transparency grid
	if (showTransparencyGrid) {
		drawTransparencyBackground(
			previewCtx,
			previewCanvasElement.width,
			previewCanvasElement.height
		);
	}

	// Copy from offscreen canvas to preview canvas
	if (applyTransparencyMask) {
		// using a tmpCanvas here to avoid modifying the original offscreen canvas
		// which causes a bug if the user toggles the checkbox multiple times
		const tmpCanvas = document.createElement("canvas");
		tmpCanvas.width = canvas.width;
		tmpCanvas.height = canvas.height;
		const tmpCtx = get2DContext(tmpCanvas);
		tmpCtx.drawImage(canvas, 0, 0);
		applyTransparencyMaskToCanvas(tmpCanvas, tmpCtx);
		previewCtx.drawImage(tmpCanvas, 0, 0);
	} else {
		// Direct copy
		previewCtx.drawImage(canvas, 0, 0);
	}

	// Apply zoom via CSS
	if (zoomLevel !== 1) {
		previewCanvasElement.style.zoom = zoomLevel.toString();
	}
}

/**
 * Initialize the preview canvas
 */
export function initPreviewCanvas(previewCanvasElement) {
	previewCanvas = previewCanvasElement;
	previewCtx = get2DContext(previewCanvas);
	const customAnimations = getCustomAnimations();

	// Size based on active animation
	let frameSize = FRAME_SIZE;
	if (activeCustomAnimation && customAnimations) {
		const customAnimDef = customAnimations[activeCustomAnimation];
		if (customAnimDef) {
			frameSize = customAnimDef.frameSize;
		}
	}

	previewCanvas.width = 4 * frameSize; // 4 directions
	previewCanvas.height = frameSize; // 1 frame tall
}

/**
 * Set preview canvas zoom level
 * @param {number} zoomLevel - Zoom level (0.5 to 2)
 */
export function setPreviewCanvasZoom(zoomLevel) {
	if (previewCanvas) {
		previewCanvas.style.zoom = zoomLevel.toString();
	}
}

import { previewCanvas, previewCtx } from "./preview-canvas.js";
import { state } from "../state/state.js";
import { FRAME_SIZE, ANIMATION_CONFIGS } from "../state/constants.js";
import { get2DContext, drawTransparencyBackground } from "./canvas-utils.js";
import { applyTransparencyMaskToCanvas } from "./mask.js";
import { canvas } from "./renderer.js";
import { customAnimations } from "../custom-animations.js";

// Animation preview state
let animationFrames = [1, 2, 3, 4, 5, 6, 7, 8]; // default for walk
let animRowStart = 8; // default for walk (row number)
let animRowNum = 4; // default for walk (number of rows to stack)
let currentFrameIndex = 0;
let lastFrameTime = Date.now();
let animationFrameId = null;

// Track custom animations present in current render
let currentCustomAnimations = {};
let customAnimYPositions = {}; // Y positions of custom animations in canvas
let activeCustomAnimation = null; // Currently selected custom animation for preview

export { activeCustomAnimation };

/**
 * Set which animation to preview
 */
export function setPreviewAnimation(animationName) {
	// Check if this is a custom animation
	if (customAnimations && customAnimations[animationName]) {
		const customAnimDef = customAnimations[animationName];
		activeCustomAnimation = animationName;

		// Extract frame cycle from custom animation definition
		// Custom animations have 4 rows (n, w, s, e), we'll show all columns from first row
		const frameCount = customAnimDef.frames[0].length;

		// Check if we should skip the first frame (frame 0)
		const skipFirstFrame = customAnimDef.skipFirstFrameInPreview || false;
		animationFrames = skipFirstFrame
			? Array.from({ length: frameCount - 1 }, (_, i) => i + 1) // [1, 2, 3, ..., 8]
			: Array.from({ length: frameCount }, (_, i) => i); // [0, 1, 2, ..., 8]

		animRowStart = 0; // Not used for custom animations
		animRowNum = 4; // Show all 4 directions
		currentFrameIndex = 0;

		return animationFrames;
	}

	// Standard animation
	activeCustomAnimation = null;
	const config = ANIMATION_CONFIGS[animationName];
	if (!config) {
		console.error("Unknown animation:", animationName);
		return [];
	}

	animationFrames = config.cycle;
	animRowStart = config.row;
	animRowNum = config.num;
	currentFrameIndex = 0;

	return animationFrames; // Return for display
}

/**
 * Start the preview animation loop
 */
export function startPreviewAnimation() {
	if (animationFrameId !== null) {
		return; // Already running
	}

	function nextFrame() {
		const fpsInterval = 1000 / 8; // 8 FPS
		const now = Date.now();
		const elapsed = now - lastFrameTime;

		if (elapsed > fpsInterval) {
			lastFrameTime = now - (elapsed % fpsInterval);

			if (previewCtx && canvas) {
				previewCtx.clearRect(
					0,
					0,
					previewCanvas.width,
					previewCanvas.height
				);

				// Draw transparency grid if enabled
				if (state.showTransparencyGrid) {
					drawTransparencyBackground(
						previewCtx,
						previewCanvas.width,
						previewCanvas.height
					);
				}

				currentFrameIndex =
					(currentFrameIndex + 1) % animationFrames.length;
				const currentFrame = animationFrames[currentFrameIndex];

				// Determine frameSize and Y offset based on animation type
				let frameSize = FRAME_SIZE;
				let yOffset = 0;

				if (activeCustomAnimation && customAnimations) {
					const customAnimDef = customAnimations[activeCustomAnimation];
					if (customAnimDef) {
						frameSize = customAnimDef.frameSize;
						yOffset =
							customAnimYPositions[activeCustomAnimation] || 0;
					}
				}

				let tmpCanvas;
				if (state.applyTransparencyMask) {
					// using a tmpCanvas here to avoid modifying the original offscreen canvas
					// which causes a bug if the user toggles the checkbox multiple times
					tmpCanvas = document.createElement("canvas");
					tmpCanvas.width = canvas.width;
					tmpCanvas.height = canvas.height;
					const tmpCtx = get2DContext(tmpCanvas);
					tmpCtx.drawImage(canvas, 0, 0);
					applyTransparencyMaskToCanvas(tmpCanvas, tmpCtx);
				} else {
					tmpCanvas = canvas;
				}

				// Draw stacked rows from main canvas to preview
				for (let i = 0; i < animRowNum; i++) {
					const srcY = activeCustomAnimation
						? yOffset + i * frameSize // Custom animation: use Y offset + row * frameSize
						: (animRowStart + i) * FRAME_SIZE; // Standard animation: use row * 64
					previewCtx.drawImage(
						tmpCanvas,
						currentFrame * frameSize, // source x
						srcY, // source y
						frameSize, // source width
						frameSize, // source height
						i * frameSize, // dest x (spread horizontally)
						0, // dest y
						frameSize, // dest width
						frameSize // dest height
					);
				}
			}
		}

		animationFrameId = requestAnimationFrame(nextFrame);
	}

	nextFrame();
}

/**
 * Stop the preview animation loop
 */
export function stopPreviewAnimation() {
	if (animationFrameId !== null) {
		cancelAnimationFrame(animationFrameId);
		animationFrameId = null;
	}
}

/**
 * Get list of custom animations present in current render
 * @returns {string[]} Array of custom animation names
 */
export function getCustomAnimations() {
	return currentCustomAnimations;
}

/**
 * Set the list of custom animations present in current render
 * @param {Record<string, Object>} customAnimations Record of
 * custom animation names mapped to their definitions
 */
export function setCurrentCustomAnimations(customAnimations) {
	currentCustomAnimations = customAnimations;
}

/**
 * Set the Y positions for custom animations
 * @param {Record<string, number>} yPositions Record of
 * custom animation names mapped to their Y positions
 */
export function setCustomAnimYPositions(yPositions) {
	customAnimYPositions = yPositions;
}

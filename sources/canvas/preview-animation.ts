import { previewCanvas, previewCtx } from "./preview-canvas.ts";
import { state } from "../state/state.ts";
import { FRAME_SIZE, ANIMATION_CONFIGS } from "../state/constants.ts";
import { get2DContext, drawTransparencyBackground } from "./canvas-utils.ts";
import { applyTransparencyMaskToCanvas } from "./mask.ts";
import { canvas } from "./renderer.ts";
import { customAnimations } from "../custom-animations.ts";
import type { CustomAnimationDefinition } from "../custom-animations.ts";

declare global {
  interface Window {
    /** Set by Playwright visual tests (tests/visual/home.spec.js) to suppress rAF cycling. */
    __DISABLE_PREVIEW_ANIMATION__?: boolean;
  }
}

// Animation preview state
let animationFrames: number[] = [1, 2, 3, 4, 5, 6, 7, 8]; // default for walk
let animRowStart = 8; // default for walk (row number)
let animRowNum = 4; // default for walk (number of rows to stack)
let currentFrameIndex = 0;
let lastFrameTime = Date.now();
let animationFrameId: number | null = null;

// Track custom animations present in current render
let currentCustomAnimations: Record<string, CustomAnimationDefinition> = {};
let customAnimYPositions: Record<string, number> = {}; // Y positions of custom animations in canvas
export let activeCustomAnimation: string | null = null; // Currently selected custom animation for preview

/**
 * Set which animation to preview
 */
export function setPreviewAnimation(animationName: string): number[] {
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

    // For display: extract source column numbers from the first row's frame specs
    // e.g. ["slash-n,5","slash-n,5","slash-n,4",...] → [5,5,4,...]
    const displayFrames = customAnimDef.frames[0]
      .slice(skipFirstFrame ? 1 : 0)
      .map((spec) => parseInt(spec.split(",")[1]));

    return displayFrames;
  }

  // Standard animation
  activeCustomAnimation = null;
  const configs = ANIMATION_CONFIGS as Record<
    string,
    { row: number; num: number; cycle: number[] } | undefined
  >;
  const config = configs[animationName];
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
 * Draw one preview frame for a given index into `animationFrames` (the cycle).
 * Used by the animation loop and by visual tests (static frame, no rAF).
 */
function paintPreviewFrameForCycleIndex(cycleIndex: number): void {
  if (!previewCtx || !canvas || !previewCanvas) {
    return;
  }

  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  // Draw transparency grid if enabled
  if (state.showTransparencyGrid) {
    drawTransparencyBackground(
      previewCtx,
      previewCanvas.width,
      previewCanvas.height,
    );
  }

  const currentFrame = animationFrames[cycleIndex];

  // Determine frameSize and Y offset based on animation type
  let frameSize = FRAME_SIZE;
  let yOffset = 0;

  if (activeCustomAnimation && customAnimations) {
    const customAnimDef = customAnimations[activeCustomAnimation];
    if (customAnimDef) {
      frameSize = customAnimDef.frameSize;
      yOffset = customAnimYPositions[activeCustomAnimation] || 0;
    }
  }

  let tmpCanvas: HTMLCanvasElement;
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
      frameSize, // dest height
    );
  }
}

/**
 * When Playwright sets `__DISABLE_PREVIEW_ANIMATION__`, we paint once instead of using rAF.
 * The first paint can run before `renderCharacter` finishes; call this after any redraw that
 * may follow a completed render so the preview copies fresh offscreen pixels (Argos / visual tests).
 */
export function repaintStaticPreviewFrameForTests(): void {
  if (
    typeof window !== "undefined" &&
    window.__DISABLE_PREVIEW_ANIMATION__ === true
  ) {
    paintPreviewFrameForCycleIndex(currentFrameIndex);
  }
}

export function startPreviewAnimation(): void {
  if (animationFrameId !== null) {
    return; // Already running
  }

  // Set by Playwright visual tests (see tests/visual/home.spec.js) so Argos
  // screenshots are not flaky due to cycling frames during load.
  if (
    typeof window !== "undefined" &&
    window.__DISABLE_PREVIEW_ANIMATION__ === true
  ) {
    currentFrameIndex = 0;
    paintPreviewFrameForCycleIndex(0);
    return;
  }

  function nextFrame(): void {
    const fpsInterval = 1000 / 8; // 8 FPS
    const now = Date.now();
    const elapsed = now - lastFrameTime;

    if (elapsed > fpsInterval) {
      lastFrameTime = now - (elapsed % fpsInterval);

      if (previewCtx && canvas) {
        currentFrameIndex = (currentFrameIndex + 1) % animationFrames.length;
        paintPreviewFrameForCycleIndex(currentFrameIndex);
      }
    }

    animationFrameId = requestAnimationFrame(nextFrame);
  }

  nextFrame();
}

/**
 * Stop the preview animation loop.
 * @returns true if a running loop was stopped
 */
export function stopPreviewAnimation(): boolean {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    return true;
  }
  return false;
}

/** Get list of custom animations present in current render. */
export function getCustomAnimations(): Record<
  string,
  CustomAnimationDefinition
> {
  return currentCustomAnimations;
}

export function setCurrentCustomAnimations(
  customAnimations: Record<string, CustomAnimationDefinition>,
): void {
  currentCustomAnimations = customAnimations;
}

export function setCustomAnimYPositions(
  yPositions: Record<string, number>,
): void {
  customAnimYPositions = yPositions;
}

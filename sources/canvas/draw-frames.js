import { FRAME_SIZE } from "../state/constants.js";
import { animationRowsLayout } from "../custom-animations.js";

/**
 * Draw a single frame from source to destination
 * If source is smaller than destination, center it without scaling
 * @param {CanvasRenderingContext2D} destCtx - Destination context
 * @param {{x: number, y: number}} destPos - Destination position
 * @param {number} destFrameSize - Destination frame size
 * @param {CanvasImageSource} src - Source image
 * @param {{x: number, y: number}} srcPos - Source position
 * @param {number} srcFrameSize - Source frame size
 */
export function drawFrameToFrame(
  destCtx,
  destPos,
  destFrameSize,
  src,
  srcPos,
  srcFrameSize
) {
  if (srcFrameSize === destFrameSize) {
    // Same size - direct copy
    destCtx.drawImage(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize,
      destPos.x,
      destPos.y,
      destFrameSize,
      destFrameSize
    );
  } else {
    // Different sizes - center the source frame in the destination without scaling
    // For example: 64x64 source centered in 128x128 dest = offset by 32px
    const offset = (destFrameSize - srcFrameSize) / 2;
    destCtx.drawImage(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize, // source rect (64x64)
      destPos.x + offset,
      destPos.y + offset,
      srcFrameSize,
      srcFrameSize // dest rect (centered, not scaled)
    );
  }
}

/**
 * Extract frames from a standard sprite sheet and redraw them into a custom animation layout
 * @param {CanvasRenderingContext2D} customAnimationContext - Destination context
 * @param {object} customAnimationDefinition - Custom animation definition from custom-animations.js
 * @param {number} offsetY - Y offset to draw at
 * @param {CanvasImageSource} src - Source sprite sheet image
 */
export function drawFramesToCustomAnimation(
  customAnimationContext,
  customAnimationDefinition,
  offsetY,
  src
) {
  const frameSize = customAnimationDefinition.frameSize;

  // Check if this is a single-animation sprite (e.g., sit.png) or full universal sheet
  // Single animation sprites are typically 192px or 832px wide and 256px tall
  const isSingleAnimation = src.height <= 256;

  for (let i = 0; i < customAnimationDefinition.frames.length; ++i) {
    const frames = customAnimationDefinition.frames[i];
    for (let j = 0; j < frames.length; ++j) {
      const frameSpec = frames[j]; // e.g., "sit-n,2"
      const [srcRowName, srcColumnStr] = frameSpec.split(",");
      const srcColumn = parseInt(srcColumnStr);

      let srcRow;
      if (isSingleAnimation) {
        // For single animation sprites, rows are 0-3 (n, w, s, e)
        // Extract direction from srcRowName (e.g., "sit-n" -> "n")
        const direction = srcRowName.split("-")[1];
        const directionMap = { n: 0, w: 1, s: 2, e: 3 };
        srcRow = directionMap[direction] || 0;
      } else {
        // For universal sheet, use animationRowsLayout
        srcRow = animationRowsLayout ? animationRowsLayout[srcRowName] : i;
      }

      const srcX = FRAME_SIZE * srcColumn;
      const srcY = FRAME_SIZE * srcRow;
      const destX = frameSize * j;
      const destY = frameSize * i + offsetY;

      drawFrameToFrame(
        customAnimationContext,
        { x: destX, y: destY }, // dest position
        frameSize, // dest frame size
        src,
        { x: srcX, y: srcY }, // source position
        FRAME_SIZE // source frame size (64px)
      );
    }
  }
}

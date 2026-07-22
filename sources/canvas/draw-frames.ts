import { FRAME_SIZE } from "../state/constants.ts";
import {
  animationRowsLayout,
  type CustomAnimationDefinition,
} from "../custom-animations.ts";

// Both HTMLImageElement and HTMLCanvasElement expose a numeric .height
// and are accepted by CanvasRenderingContext2D.drawImage — the full API
// surface this function uses, so it can treat them interchangeably.
type SpriteSource = HTMLImageElement | HTMLCanvasElement;

export function drawFrameToFrame(
  destCtx: CanvasRenderingContext2D,
  destPos: { x: number; y: number },
  destFrameSize: number,
  src: SpriteSource,
  srcPos: { x: number; y: number },
  srcFrameSize: number,
): void {
  if (srcFrameSize === destFrameSize) {
    destCtx.drawImage(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize,
      destPos.x,
      destPos.y,
      destFrameSize,
      destFrameSize,
    );
  } else {
    // e.g. 64×64 source centered in 128×128 dest = offset by 32px.
    const offset = (destFrameSize - srcFrameSize) / 2;
    destCtx.drawImage(
      src,
      srcPos.x,
      srcPos.y,
      srcFrameSize,
      srcFrameSize,
      destPos.x + offset,
      destPos.y + offset,
      srcFrameSize,
      srcFrameSize,
    );
  }
}

export function drawFramesToCustomAnimation(
  customAnimationContext: CanvasRenderingContext2D,
  customAnimationDefinition: CustomAnimationDefinition,
  offsetY: number,
  src: SpriteSource,
): void {
  const frameSize = customAnimationDefinition.frameSize;

  // Single-animation sprites (e.g. sit.png) are ≤256px tall; full universal
  // sheet is taller.
  const isSingleAnimation = src.height <= 256;

  for (let i = 0; i < customAnimationDefinition.frames.length; ++i) {
    const frames = customAnimationDefinition.frames[i];
    for (let j = 0; j < frames.length; ++j) {
      const frameSpec = frames[j]; // e.g. "sit-n,2"
      const [srcRowName, srcColumnStr] = frameSpec.split(",");
      const srcColumn = parseInt(srcColumnStr);

      let srcRow: number;
      if (isSingleAnimation) {
        // Rows 0-3 = n, w, s, e. Extract direction from e.g. "sit-n".
        const direction = srcRowName.split("-")[1];
        const directionMap: Record<string, number> = { n: 0, w: 1, s: 2, e: 3 };
        srcRow = directionMap[direction] || 0;
      } else {
        srcRow = animationRowsLayout ? animationRowsLayout[srcRowName] : i;
      }

      const srcX = FRAME_SIZE * srcColumn;
      const srcY = FRAME_SIZE * srcRow;
      const destX = frameSize * j;
      const destY = frameSize * i + offsetY;

      drawFrameToFrame(
        customAnimationContext,
        { x: destX, y: destY },
        frameSize,
        src,
        { x: srcX, y: srcY },
        FRAME_SIZE,
      );
    }
  }
}

/**
 * Draw a single-animation source sprite (4 rows: n/w/s/e) into a custom animation area,
 * remapping frames according to the custom animation definition.
 * Used when the tool sprite is in its native slash/thrust layout rather than
 * a pre-built custom animation sheet.
 */
export function drawSingleAnimSpriteToCustomAnimation(
  ctx: CanvasRenderingContext2D,
  customAnimDef: CustomAnimationDefinition,
  offsetY: number,
  src: SpriteSource,
): void {
  const frameSize = customAnimDef.frameSize;
  const srcFrameSize = Math.round(src.height / 4); // 4 rows: n=0, w=1, s=2, e=3
  const directionMap: Record<string, number> = { n: 0, w: 1, s: 2, e: 3 };

  for (let i = 0; i < customAnimDef.frames.length; i++) {
    const frames = customAnimDef.frames[i];
    for (let j = 0; j < frames.length; j++) {
      const frameSpec = frames[j]; // e.g. "slash-n,5"
      const [srcRowName, srcColumnStr] = frameSpec.split(",");
      const srcColumn = parseInt(srcColumnStr);
      const direction = srcRowName.split("-")[1];
      const srcRow = directionMap[direction] ?? 0;

      const srcX = srcFrameSize * srcColumn;
      const srcY = srcFrameSize * srcRow;
      const destX = frameSize * j;
      const destY = frameSize * i + offsetY;

      drawFrameToFrame(
        ctx,
        { x: destX, y: destY },
        frameSize,
        src,
        { x: srcX, y: srcY },
        srcFrameSize,
      );
    }
  }
}

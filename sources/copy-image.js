/**
 * @typedef {{x: number, y: number}} Point 
 * @typedef {Point & {width: number, height: number}} Rectangle 
 */

/**
 * 
 * @param {CanvasRenderingContext2D} destCtx 
 * @param {Point} destFramePos 
 * @param {number} destFrameSize 
 * @param {CanvasImageSource} src 
 * @param {Point} srcFramePos 
 * @param {number} srcFrameSize 
 */
function drawFrameToFrame(destCtx, destFramePos, destFrameSize, src, srcFramePos, srcFrameSize) {
    const offSet = (destFrameSize - srcFrameSize) / 2;
    const destPoint = {
        x: destFramePos.x + offSet,
        y: destFramePos.y + offSet
    };
    const srcRect = {
        x: srcFramePos.x,
        y: srcFramePos.y,
        width: srcFrameSize,
        height: srcFrameSize
    };

    destCtx.drawImage(src, srcRect.x, srcRect.y, srcRect.width, srcRect.height,
        destPoint.x, destPoint.y, srcRect.width, srcRect.height);
}
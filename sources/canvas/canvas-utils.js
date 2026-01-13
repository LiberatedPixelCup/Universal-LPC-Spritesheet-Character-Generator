// Canvas utility functions

/**
 * Get 2D context with image smoothing disabled for crisp pixel rendering
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {boolean} willReadFrequently - Whether the context will be used for frequent getImageData calls
 * @returns {CanvasRenderingContext2D} Context with smoothing disabled
 */
export function get2DContext(canvas, willReadFrequently = false) {
	const ctx = canvas.getContext('2d', { willReadFrequently });
	ctx.imageSmoothingEnabled = false;
	return ctx;
}

/**
 * Get zPos for a layer
 */
export function getZPos(itemId, layerNum = 1) {
  const meta = window.itemMetadata[itemId];
  if (!meta) return 100;

  const layerKey = `layer_${layerNum}`;
  const layer = meta.layers?.[layerKey];

  return layer?.zPos ?? 100;
}

/**
 * Draw a checkered transparency background (like image editors)
 * @param {CanvasRenderingContext2D} context - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} squareSize - Size of each checker square (default 8px)
 */
export function drawTransparencyBackground(
  context,
  width,
  height,
  squareSize = 8
) {
  const lightGray = "#CCCCCC";
  const darkGray = "#999999";

  for (let y = 0; y < height; y += squareSize) {
    for (let x = 0; x < width; x += squareSize) {
      // Alternate colors in a checkerboard pattern
      const isEvenRow = Math.floor(y / squareSize) % 2 === 0;
      const isEvenCol = Math.floor(x / squareSize) % 2 === 0;
      const isLight = isEvenRow === isEvenCol;

      context.fillStyle = isLight ? lightGray : darkGray;
      context.fillRect(x, y, squareSize, squareSize);
    }
  }
}

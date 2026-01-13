export function applyTransparencyMaskToCanvas(canvas, ctx) {
  if (!canvas) {
    console.error("Canvas not initialized");
    return;
  }
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height),
    pix = imgData.data,
    n = pix.length;

  for (let i = 0; i < n; i += 4) {
    const a = pix[i + 3];
    if (a > 0) {
      const r = pix[i];
      const g = pix[i + 1];
      const b = pix[i + 2];
      if (r === 255 && g === 44 && b === 230) {
        pix[i + 3] = 0;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

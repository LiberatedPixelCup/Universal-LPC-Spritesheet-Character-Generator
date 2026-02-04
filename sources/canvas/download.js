import { getCanvas } from "./renderer.js";

/**
 * Get canvas as blob for ZIP export
 */
export function getCanvasBlob() {
  const canvas = getCanvas();
  if (!canvas) {
    console.error("Canvas not initialized");
    return Promise.reject(new Error("Canvas not initialized"));
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * Download canvas as PNG (exports the offscreen canvas directly)
 */
export async function downloadAsPNG(filename = "character-spritesheet.png") {
  try {
    const blob = await getCanvasBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading PNG:", error);
  }
}

export function downloadFile(content, filename, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

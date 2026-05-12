import { canvasToBlob } from "./canvas-utils.ts";
import { getCanvas } from "./renderer.js";

/**
 * Get the main renderer canvas as a PNG blob (for download / export).
 */
export function getCanvasBlob() {
  const canvas = getCanvas();
  if (!canvas) {
    console.error("Canvas not initialized");
    return Promise.reject(new Error("Canvas not initialized"));
  }

  return canvasToBlob(canvas);
}

/**
 * Download canvas as PNG (exports the offscreen canvas directly)
 */
// allow injection of getCanvasBlob for testing
export async function downloadAsPNG(
  filename = "character-spritesheet.png",
  getCanvasBlobFunc,
) {
  try {
    const blob = await (getCanvasBlobFunc ?? getCanvasBlob)();
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

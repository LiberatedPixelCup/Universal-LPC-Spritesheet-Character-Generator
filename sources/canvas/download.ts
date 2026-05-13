import type { ResultAsync } from "neverthrow";
import { canvasToBlob } from "./canvas-utils.ts";
import { getCanvas, type CanvasNotInitialized } from "./renderer.ts";

type GetCanvasBlobFn = () => ResultAsync<Blob, CanvasNotInitialized>;

/**
 * Download canvas as PNG (exports the offscreen canvas directly).
 * `getCanvasBlobFunc` defaults to the real renderer canvas; tests inject a stub.
 */
export async function downloadAsPNG(
  filename: string = "character-spritesheet.png",
  getCanvasBlobFunc: GetCanvasBlobFn = () => getCanvas().asyncMap(canvasToBlob),
): Promise<void> {
  const blobResult = await getCanvasBlobFunc();
  if (blobResult.isErr()) {
    console.error("Error downloading PNG:", blobResult.error);
    return;
  }
  const url = URL.createObjectURL(blobResult.value);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadFile(
  content: string,
  filename: string,
  type: string = "text/plain",
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { ResultAsync } from "neverthrow";
import { canvasToBlob } from "./canvas-utils.ts";
import { getCanvas, type CanvasNotInitialized } from "./renderer.ts";

export type CanvasDownloadError =
  CanvasNotInitialized | { kind: "blob-failed"; cause: unknown };

type GetCanvasBlobFn = () => ResultAsync<Blob, CanvasDownloadError>;

/**
 * Download canvas as PNG (exports the offscreen canvas directly).
 * `getCanvasBlobFunc` defaults to the real renderer canvas; tests inject a stub.
 * Resolves to `true` on success, `false` on error (never rejects).
 */
export async function downloadAsPNG(
  filename: string = "character-spritesheet.png",
  getCanvasBlobFunc: GetCanvasBlobFn = () =>
    getCanvas().asyncAndThen((canvas) =>
      ResultAsync.fromPromise(canvasToBlob(canvas), (cause) => ({
        kind: "blob-failed" as const,
        cause,
      })),
    ),
): Promise<boolean> {
  try {
    const blobResult = await getCanvasBlobFunc();
    if (blobResult.isErr()) {
      console.error("Error downloading PNG:", blobResult.error);
      return false;
    }
    const url = URL.createObjectURL(blobResult.value);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Error downloading PNG:", error);
    return false;
  }
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

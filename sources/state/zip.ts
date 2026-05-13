import {
  ANIMATIONS,
  ANIMATION_CONFIGS,
  FRAME_SIZE,
  DIRECTIONS,
} from "./constants.ts";
import { getItemMerged } from "./catalog.ts";
import {
  extractAnimationFromCanvas,
  renderSingleItem,
  renderSingleItemAnimation,
  SHEET_HEIGHT,
  canvas,
  layers,
  customAreaItems,
  addedCustomAnimations,
} from "../canvas/renderer.ts";
import { getMultiRecolors } from "./palettes.ts";
import { getItemFileName } from "../utils/fileName.ts";
import { loadImage } from "../canvas/load-image.ts";
import { getImageToDraw } from "../canvas/palette-recolor.ts";
import { customAnimations, customAnimationSize } from "../custom-animations.ts";
import { getSortedLayersWithCustomFallback } from "./meta.ts";
import { canvasToBlob } from "../canvas/canvas-utils.ts";
import {
  addAnimationSliceToZip,
  addCanvasToZip,
  addStandardAnimationToZipCustomFolder,
  addCharacterJsonAndCredits,
  downloadZipBlob,
  extractFramesFromAnimation,
  extractFramesFromCustomAnimation,
  guardZipExportEnvironment,
  newAnimationFromSheet,
  zipExportTimestamp,
  zipGenerateBlobWithProfiler,
} from "../utils/zip-helpers.ts";
import type { ZipFolder } from "../utils/zip-helpers.ts";
import m from "mithril";
import { debugLog, debugWarn } from "../utils/debug.ts";
import { createZipExportProfiler } from "../performance-profiler.ts";
import {
  beginZipExportUiSuspend,
  endZipExportUiSuspend,
} from "../utils/zip-export-ui-suspend.ts";
import type { State } from "./state.ts";

declare global {
  interface Window {
    /** JSZip constructor attached at runtime by `vendor-globals.js`. */
    JSZip?: new () => ZipFolder;
  }
}

/**
 * ZIP download pack exports. Each flow uses `createZipExportProfiler` (see
 * `performance-profiler.ts`) for `credits/metadata.json` timings where applicable,
 * suspends UI redraw/preview during export (`zip-export-ui-suspend.ts`), and uses
 * `zipGenerateBlobWithProfiler` for the final blob.
 *
 * Reviewer map: `PERFORMANCE_PROFILING.md` → "Reviewing ZIP performance changes (PR)".
 */

type ExportSplitAnimationsDeps = {
  addAnimationSliceToZip: typeof addAnimationSliceToZip;
  addCanvasToZip: typeof addCanvasToZip;
};

// Export ZIP - Split by animation
export const exportSplitAnimations = async (
  deps: Partial<ExportSplitAnimationsDeps> = {},
): Promise<void> => {
  const baseAddAnimationSliceToZip =
    deps.addAnimationSliceToZip ?? addAnimationSliceToZip;
  const baseAddCanvasToZip = deps.addCanvasToZip ?? addCanvasToZip;

  if (!guardZipExportEnvironment()) return;

  let state: State | undefined;

  const profiler = createZipExportProfiler("splitAnimations");

  try {
    const addCanvas: typeof baseAddCanvasToZip = (
      folder,
      fileName,
      srcCanvas,
    ) => baseAddCanvasToZip(folder, fileName, srcCanvas, { profiler });
    const addSlice: typeof baseAddAnimationSliceToZip = (
      folder,
      fileName,
      srcCanvas,
      srcRect,
    ) =>
      baseAddAnimationSliceToZip(folder, fileName, srcCanvas, srcRect, {
        profiler,
      });

    const zip = new window.JSZip!();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.ts")).state; // Ensure state is loaded
    state.zipByAnimation.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure to match original
    const standardFolder = zip.folder("standard");
    const customFolder = zip.folder("custom");
    const creditsFolder = zip.folder("credits");

    // Get available animations from canvas renderer
    const animationList = ANIMATIONS;
    const exportedStandard: string[] = [];
    const failedStandard: string[] = [];

    for (const anim of animationList) {
      try {
        const animCanvas = profiler.syncPhase(
          "render_composite_extractAnimationFromCanvas",
          () => extractAnimationFromCanvas(anim.value),
        );
        profiler.incrementCounter("renderExtractAnimationFromCanvasCalls");
        if (!animCanvas) {
          failedStandard.push(anim.value);
          continue;
        }
        const result = await addCanvas(
          standardFolder,
          `${anim.value}.png`,
          animCanvas,
        );
        if (result.isOk()) {
          exportedStandard.push(anim.value);
        }
      } catch (err) {
        console.error(`Failed to export animation ${anim.value}:`, err);
        failedStandard.push(anim.value);
      }
    }

    // Handle custom animations
    const exportedCustom: string[] = [];
    const failedCustom: string[] = [];
    let y = SHEET_HEIGHT;

    for (const animName of addedCustomAnimations) {
      try {
        const anim = customAnimations[animName];
        if (!anim) {
          throw new Error("Animation definition not found");
        }

        const srcRect = { x: 0, y, ...customAnimationSize(anim) };
        if (!canvas) {
          throw new Error("Canvas not initialized");
        }
        const result = await addSlice(
          customFolder,
          `${animName}.png`,
          canvas,
          srcRect,
        );

        if (result.isOk()) {
          exportedCustom.push(animName);
        }

        y += srcRect.height;
      } catch (err) {
        console.error(`Failed to export custom animation ${animName}:`, err);
        failedCustom.push(animName);
      }
    }

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state!, layers);
    });

    const metadata = {
      exportTimestamp: timestamp,
      bodyType: bodyType,
      standardAnimations: {
        exported: exportedStandard,
        failed: failedStandard,
      },
      customAnimations: {
        exported: exportedCustom,
        failed: failedCustom,
      },
      frameSize: FRAME_SIZE,
      frameCounts: {}, // Would need to map animation frame counts
      performance: profiler.toMetadata(),
    };
    creditsFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

    const zipBlob = await zipGenerateBlobWithProfiler(profiler, zip);
    downloadZipBlob(zipBlob, `lpc_${bodyType}_animations_${timestamp}.zip`);

    if (failedStandard.length > 0 || failedCustom.length > 0) {
      alert(
        `Export completed with some issues:\nFailed to export animations: ${failedStandard.join(
          ", ",
        )}`,
      );
    } else {
      alert("Export complete!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${(err as Error).message}`);
  } finally {
    endZipExportUiSuspend();
    if (state) {
      state.zipByAnimation.isRunning = false;
    }
    m.redraw();
  }
};

type ExportSplitItemSheetsDeps = {
  addCanvasToZip: typeof addCanvasToZip;
  renderSingleItem: typeof renderSingleItem;
};

// Export ZIP - Split by item
export const exportSplitItemSheets = async (
  deps: Partial<ExportSplitItemSheetsDeps> = {},
): Promise<void> => {
  const baseAddCanvasToZip = deps.addCanvasToZip ?? addCanvasToZip;
  const profiler = createZipExportProfiler("splitItemSheets");
  const addCanvas: typeof baseAddCanvasToZip = (folder, fileName, srcCanvas) =>
    baseAddCanvasToZip(folder, fileName, srcCanvas, { profiler });
  const renderSingleItemFn = deps.renderSingleItem ?? renderSingleItem;

  if (!guardZipExportEnvironment()) return;

  let state: State | undefined;

  try {
    const zip = new window.JSZip!();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.ts")).state; // Ensure state is loaded
    state.zipByItem.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure
    const itemsFolder = zip.folder("items");
    const creditsFolder = zip.folder("credits");

    const exportedItems: string[] = [];
    const failedItems: string[] = [];

    // Render each item individually
    for (const [, selection] of Object.entries(state.selections)) {
      const { itemId, variant, name } = selection;
      const itemLayers = getSortedLayersWithCustomFallback(itemId).unwrapOr([]);

      // Get Multiple Recolors If Available
      const recolors = getMultiRecolors(itemId, state.selections);

      // Render each layer of the item separately
      for (const layer of itemLayers) {
        const fileName = getItemFileName(
          itemId,
          String(variant),
          name,
          layer.layerNum,
        );
        try {
          const itemCanvas = await renderSingleItemFn(
            itemId,
            variant ?? null,
            recolors,
            bodyType,
            state.selections,
            layer.layerNum,
            profiler,
          );
          profiler.incrementCounter("renderSingleItemCalls");

          if (itemCanvas) {
            await addCanvas(itemsFolder, fileName, itemCanvas);
            exportedItems.push(fileName);
          }
        } catch (err) {
          console.error(`Failed to export item ${fileName}:`, err);
          failedItems.push(fileName);
        }
      }
    }

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state!, layers);
    });

    const zipBlob = await zipGenerateBlobWithProfiler(profiler, zip);
    downloadZipBlob(
      zipBlob,
      `lpc_${bodyType}_item_spritesheets_${timestamp}.zip`,
    );

    if (failedItems.length > 0) {
      alert(
        `Export completed with some issues:\nFailed items: ${failedItems.join(
          ", ",
        )}`,
      );
    } else {
      alert("Export complete!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${(err as Error).message}`);
  } finally {
    endZipExportUiSuspend();
    if (state) {
      state.zipByItem.isRunning = false;
    }
    m.redraw();
  }
};

type ExportSplitItemAnimationsDeps = {
  addAnimationSliceToZip: typeof addAnimationSliceToZip;
  addCanvasToZip: typeof addCanvasToZip;
  renderSingleItemAnimation: typeof renderSingleItemAnimation;
  loadImage: typeof loadImage;
  addStandardAnimationToZipCustomFolder: typeof addStandardAnimationToZipCustomFolder;
  getImageToDraw: typeof getImageToDraw;
};

// Export ZIP - Split by animation and item
export const exportSplitItemAnimations = async (
  deps: Partial<ExportSplitItemAnimationsDeps> = {},
): Promise<void> => {
  const baseAddAnimationSliceToZip =
    deps.addAnimationSliceToZip ?? addAnimationSliceToZip;
  const baseAddCanvasToZip = deps.addCanvasToZip ?? addCanvasToZip;
  const baseAddStandardAnimationToZipCustomFolder =
    deps.addStandardAnimationToZipCustomFolder ??
    addStandardAnimationToZipCustomFolder;
  const profiler = createZipExportProfiler("splitItemAnimations");
  const addCanvas: typeof baseAddCanvasToZip = (folder, fileName, srcCanvas) =>
    baseAddCanvasToZip(folder, fileName, srcCanvas, { profiler });
  const addSlice: typeof baseAddAnimationSliceToZip = (
    folder,
    fileName,
    srcCanvas,
    srcRect,
  ) =>
    baseAddAnimationSliceToZip(folder, fileName, srcCanvas, srcRect, {
      profiler,
    });
  const addStandardAnimationToZipCustomFolderFn: typeof baseAddStandardAnimationToZipCustomFolder =
    (custAnimFolder, itemFileName, src, custAnim) =>
      baseAddStandardAnimationToZipCustomFolder(
        custAnimFolder,
        itemFileName,
        src,
        custAnim,
        { profiler },
      );
  const renderSingleItemAnimationFn =
    deps.renderSingleItemAnimation ?? renderSingleItemAnimation;
  const loadImageFn = deps.loadImage ?? loadImage;
  const getImageToDrawFn = deps.getImageToDraw ?? getImageToDraw;

  if (!guardZipExportEnvironment()) return;

  let state: State | undefined;

  try {
    const zip = new window.JSZip!();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.ts")).state; // Ensure state is loaded
    state.zipByAnimimationAndItem.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure
    const standardFolder = zip.folder("standard");
    const customFolder = zip.folder("custom");
    const creditsFolder = zip.folder("credits");

    // Get available animations
    const animationList = ANIMATIONS;
    const exportedStandard: Record<string, string[]> = {};
    const failedStandard: Record<string, string[]> = {};
    const exportedCustom: Record<string, string[]> = {};
    const failedCustom: Record<string, string[]> = {};

    // For each animation, create a folder and export each item
    for (const anim of animationList) {
      if (anim.noExport) continue;
      const animFolder = standardFolder.folder(anim.value);

      exportedStandard[anim.value] = [];
      failedStandard[anim.value] = [];

      // Export each item for this animation
      for (const [, selection] of Object.entries(state.selections)) {
        const { itemId, variant, name } = selection;
        const metaResult = getItemMerged(itemId);
        if (
          metaResult.isErr() ||
          !metaResult.value.animations.includes(anim.value)
        ) {
          debugLog(
            "Skipping item ",
            itemId,
            " without the animation: ",
            anim.value,
          );
          continue;
        }

        // Get Multiple Recolors If Available
        const recolors = getMultiRecolors(itemId, state.selections);

        const itemLayers = getSortedLayersWithCustomFallback(itemId).unwrapOr(
          [],
        );
        for (const layer of itemLayers) {
          const fileName = getItemFileName(
            itemId,
            String(variant),
            name,
            layer.layerNum,
          );

          try {
            const animCanvas = await renderSingleItemAnimationFn(
              itemId,
              variant ?? null,
              recolors,
              bodyType,
              anim.value,
              state.selections,
              layer.layerNum,
              profiler,
            );
            profiler.incrementCounter("renderSingleItemAnimationCalls");

            if (animCanvas) {
              await addCanvas(animFolder, fileName, animCanvas);
              exportedStandard[anim.value].push(fileName);
            }
          } catch (err) {
            console.error(
              `Failed to export ${fileName} for ${anim.value}:`,
              err,
            );
            failedStandard[anim.value].push(fileName);
          }
        }
      }
    }

    debugLog(customAreaItems);

    for (const customAnimName of Object.keys(customAreaItems)) {
      // Export items exclusive to custom animations
      for (const layer of customAreaItems[customAnimName]) {
        debugLog("Processing layer for custom animation only export:", layer);

        const spritePath = layer.spritePath;
        const itemFileName = getItemFileName(
          layer.itemId,
          String(layer.variant),
          layer.name ?? "",
          1,
          layer.zPos,
        );
        const custExportedItems = exportedCustom[customAnimName] ?? [];
        exportedCustom[customAnimName] = custExportedItems;
        const custFailedItems = failedCustom[customAnimName] ?? [];

        try {
          debugLog(
            `Exporting item ${itemFileName} for custom animation ${customAnimName}`,
          );
          if (!spritePath) continue;
          let img: HTMLImageElement | undefined;
          let imgCanvas: HTMLImageElement | HTMLCanvasElement | undefined;
          await profiler.phase(
            "render_imageLoadDecode_customItemSprite",
            async () => {
              img = await loadImageFn(spritePath);
            },
          );
          if (!img) continue;
          await profiler.phase(
            "render_composite_customItemSprite",
            async () => {
              imgCanvas = await getImageToDrawFn(
                img!,
                layer.itemId,
                layer.recolors,
              );
            },
          );
          if (!imgCanvas) continue;

          const custAnim = customAnimations[customAnimName];
          if (!custAnim)
            throw new Error(
              "Custom animation not found for item: " + layer.itemId,
            );
          const custSize = customAnimationSize(custAnim);
          const srcRect = { x: 0, y: 0, ...custSize };
          const animFolder = customFolder.folder(customAnimName);
          // Try the "extracted_frames" rendering first; fall back to the raw
          // slice when that path doesn't apply or yields no canvas.
          let succeeded = false;
          if (layer.type === "extracted_frames") {
            const fromExtracted = await addStandardAnimationToZipCustomFolderFn(
              animFolder,
              itemFileName,
              imgCanvas,
              custAnim,
            );
            if (fromExtracted) succeeded = true;
          }
          if (!succeeded) {
            const sliceResult = await addSlice(
              animFolder,
              itemFileName,
              imgCanvas as HTMLCanvasElement,
              srcRect,
            );
            if (sliceResult.isOk()) succeeded = true;
          }

          if (succeeded) custExportedItems.push(itemFileName);
        } catch (err) {
          console.error(
            `Failed to export item ${itemFileName} in custom animation ${customAnimName}:`,
            err,
          );
          custFailedItems.push(itemFileName);
          failedCustom[customAnimName] = custFailedItems;
        }
      }
    }

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state!, layers);
    });

    const metadata = {
      exportTimestamp: timestamp,
      bodyType: bodyType,
      standardAnimations: {
        exported: exportedStandard,
        failed: failedStandard,
      },
      customAnimations: {
        exported: exportedCustom,
        failed: failedCustom,
      },
      frameSize: FRAME_SIZE,
      frameCounts: {},
      performance: profiler.toMetadata(),
    };
    creditsFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

    const zipBlob = await zipGenerateBlobWithProfiler(profiler, zip);
    downloadZipBlob(
      zipBlob,
      `lpc_${bodyType}_item_animations_${timestamp}.zip`,
    );

    // Report failures if any
    const failedCount = Object.values(failedStandard).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    if (failedCount > 0) {
      let msg = "Export completed with some issues:\n";
      for (const [anim, items] of Object.entries(failedStandard)) {
        if (items.length > 0) {
          msg += `${anim}: ${items.join(", ")}\n`;
        }
      }
      alert(msg);
    } else {
      alert("Export complete!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${(err as Error).message}`);
  } finally {
    endZipExportUiSuspend();
    if (state) {
      state.zipByAnimimationAndItem.isRunning = false;
    }
    m.redraw();
  }
};

type ExportIndividualFramesDeps = {
  extractAnimationFromCanvas: typeof extractAnimationFromCanvas;
  extractFramesFromAnimation: typeof extractFramesFromAnimation;
  canvasToBlob: typeof canvasToBlob;
  newAnimationFromSheet: typeof newAnimationFromSheet;
  extractFramesFromCustomAnimation: typeof extractFramesFromCustomAnimation;
};

type BlobTask = {
  encode: () => Promise<Blob>;
  folder: ZipFolder;
  filename: string;
  debugPath: string;
};

type BlobTaskResult = BlobTask & {
  blob: Blob | null;
  success: boolean;
};

// Export ZIP - Individual animation frames
export const exportIndividualFrames = async (
  deps: Partial<ExportIndividualFramesDeps> = {},
): Promise<void> => {
  const extractAnimationFromCanvasFn =
    deps.extractAnimationFromCanvas ?? extractAnimationFromCanvas;
  const extractFramesFromAnimationFn =
    deps.extractFramesFromAnimation ?? extractFramesFromAnimation;
  const canvasToBlobFn = deps.canvasToBlob ?? canvasToBlob;
  const extractFramesFromCustomAnimationFn =
    deps.extractFramesFromCustomAnimation ?? extractFramesFromCustomAnimation;

  const sliceCanvasForCustomAnim: typeof newAnimationFromSheet = (
    src,
    rect,
  ) => {
    if (deps.newAnimationFromSheet) {
      return deps.newAnimationFromSheet(src, rect);
    }
    return newAnimationFromSheet(src, rect);
  };

  if (!guardZipExportEnvironment()) return;

  let state: State | undefined;

  const profiler = createZipExportProfiler("individualFrames");

  try {
    const zip = new window.JSZip!();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.ts")).state;
    state.zipIndividualFrames.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure
    const standardFolder = zip.folder("standard");
    const customFolder = zip.folder("custom");
    const creditsFolder = zip.folder("credits");

    const exportedAnimations: string[] = [];
    const failedAnimations: string[] = [];
    const directions = DIRECTIONS;

    // Pre-extract, slice to per-frame canvases, and queue PNG encodes (render path)
    const animationCanvases = new Map<string, HTMLCanvasElement>();
    const blobTasks: BlobTask[] = [];
    const exportedCustom: string[] = [];
    const failedCustom: string[] = [];
    let y = SHEET_HEIGHT;

    for (const anim of ANIMATIONS) {
      try {
        const animationName = anim.value;
        profiler.syncPhase(
          "render_composite_extractAnimationFromCanvas",
          () => {
            const animCanvas = extractAnimationFromCanvasFn(animationName);
            if (animCanvas) {
              animationCanvases.set(animationName, animCanvas);
            }
          },
        );
        profiler.incrementCounter("renderExtractAnimationFromCanvasCalls");
      } catch (err) {
        console.error(`Failed to extract animation ${anim.value}:`, err);
        failedAnimations.push(anim.value);
      }
    }

    for (const anim of ANIMATIONS) {
      try {
        const animationName = anim.value;
        const animCanvas = animationCanvases.get(animationName);

        if (animCanvas) {
          await profiler.phase(
            "render_composite_extractFramesFromAnimation",
            async () => {
              const animFolder = standardFolder.folder(animationName);
              const frames = extractFramesFromAnimationFn(
                animCanvas,
                animationName,
                directions,
              );

              for (const [direction, frameList] of Object.entries(frames)) {
                if (frameList.length > 0) {
                  const directionFolder = animFolder.folder(direction);

                  for (const {
                    canvas: frameCanvas,
                    frameNumber,
                  } of frameList) {
                    blobTasks.push({
                      encode: () => canvasToBlobFn(frameCanvas),
                      folder: directionFolder,
                      filename: `${frameNumber}.png`,
                      debugPath: `standard/${animationName}/${direction}/${frameNumber}.png`,
                    });
                  }
                }
              }
              exportedAnimations.push(animationName);
            },
          );
          profiler.incrementCounter("extractFramesFromAnimationBatchCount");
        }
      } catch (err) {
        console.error(
          `Failed to process frames for animation ${anim.value}:`,
          err,
        );
        failedAnimations.push(anim.value);
      }
    }

    for (const animName of addedCustomAnimations) {
      try {
        const customAnimDef = customAnimations[animName];
        if (!customAnimDef) {
          throw new Error("Custom animation definition not found");
        }

        const custSize = customAnimationSize(customAnimDef);
        const srcRect = { x: 0, y, ...custSize };

        debugLog(`Processing custom animation: ${animName}`, {
          frameSize: customAnimDef.frameSize,
          frames: customAnimDef.frames,
          srcRect: srcRect,
        });

        if (!canvas) {
          throw new Error("Canvas not initialized");
        }
        const rendererCanvas = canvas; // narrow to non-null for the closure
        let custAnimCanvas: HTMLCanvasElement | null = null;
        profiler.syncPhase("render_composite_sliceCanvasForCustomAnim", () => {
          custAnimCanvas = sliceCanvasForCustomAnim(
            rendererCanvas,
            srcRect,
          ).unwrapOr(null);
        });
        if (custAnimCanvas) {
          profiler.syncPhase(
            "render_composite_extractFramesFromCustomAnimation",
            () => {
              const animFolder = customFolder.folder(animName);
              const frames = extractFramesFromCustomAnimationFn(
                custAnimCanvas!,
                customAnimDef,
                directions,
              );

              debugLog(`Extracted frames for ${animName}:`, frames);

              for (const [direction, frameList] of Object.entries(frames)) {
                if (frameList.length > 0) {
                  const directionFolder = animFolder.folder(direction);

                  for (const {
                    canvas: frameCanvas,
                    frameNumber,
                  } of frameList) {
                    blobTasks.push({
                      encode: () => canvasToBlobFn(frameCanvas),
                      folder: directionFolder,
                      filename: `${frameNumber}.png`,
                      debugPath: `custom/${animName}/${direction}/${frameNumber}.png`,
                    });
                  }
                }
              }
              exportedCustom.push(animName);
            },
          );
          profiler.incrementCounter("renderSliceCanvasForCustomAnimCalls");
        } else {
          debugWarn(`No canvas generated for custom animation: ${animName}`);
        }

        y += srcRect.height;
      } catch (err) {
        console.error(
          `Failed to export frames for custom animation ${animName}:`,
          err,
        );
        failedCustom.push(animName);
      }
    }

    debugLog(`Converting ${blobTasks.length} frames to blobs...`);
    let blobResults: BlobTaskResult[] = [];
    await profiler.phase("pngEncode", async () => {
      blobResults = await Promise.all(
        blobTasks.map(async (task): Promise<BlobTaskResult> => {
          try {
            const blob = await task.encode();
            if (blob) {
              profiler.incrementCounter("pngEncodeCount");
              profiler.addCounter("totalPngBytes", blob.size);
            }
            return { ...task, blob, success: true };
          } catch (err) {
            console.error(`Failed to create blob for ${task.debugPath}:`, err);
            return { ...task, blob: null, success: false };
          }
        }),
      );
    });

    let successCount = 0;
    await profiler.phase("zipFile", async () => {
      for (const result of blobResults) {
        if (result.success && result.blob) {
          result.folder.file(result.filename, result.blob);
          profiler.incrementCounter("zipFileEntryCount");
          successCount++;
          debugLog(`Added frame: ${result.debugPath}`);
        }
      }
    });

    debugLog(
      `Successfully processed ${successCount}/${blobTasks.length} frames`,
    );

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state!, layers);
    });

    const metadata = {
      exportTimestamp: timestamp,
      bodyType: bodyType,
      frameSize: FRAME_SIZE,
      structure: {
        standard: {
          exported: exportedAnimations,
          failed: failedAnimations,
        },
        custom: {
          exported: exportedCustom,
          failed: failedCustom,
        },
      },
      animationConfigs: ANIMATION_CONFIGS,
      directions: directions,
      note: "Individual animation frames organized by standard/custom > animation > direction > frame number",
      performance: profiler.toMetadata(),
    };
    creditsFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

    debugLog("Generating ZIP file...");
    const zipBlob = await zipGenerateBlobWithProfiler(profiler, zip);
    downloadZipBlob(
      zipBlob,
      `lpc_${bodyType}_individual_frames_${timestamp}.zip`,
    );

    // Report results
    const totalFailed = failedAnimations.length + failedCustom.length;
    if (totalFailed > 0) {
      let msg = "Export completed with some issues:\n";
      if (failedAnimations.length > 0) {
        msg += `Failed standard animations: ${failedAnimations.join(", ")}\n`;
      }
      if (failedCustom.length > 0) {
        msg += `Failed custom animations: ${failedCustom.join(", ")}\n`;
      }
      alert(msg);
    } else {
      alert("Individual frames export complete!");
    }
  } catch (err) {
    console.error("Individual frames export failed:", err);
    alert(`Export failed: ${(err as Error).message}`);
  } finally {
    endZipExportUiSuspend();
    if (state) {
      state.zipIndividualFrames.isRunning = false;
    }
    m.redraw();
  }
};

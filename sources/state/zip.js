import { ANIMATIONS, ANIMATION_CONFIGS, FRAME_SIZE } from "./constants.js";
import {
  extractAnimationFromCanvas,
  renderSingleItem,
  renderSingleItemAnimation,
  SHEET_HEIGHT,
  canvas,
  layers,
  customAreaItems,
  addedCustomAnimations,
} from "../canvas/renderer.js";
import { getMultiRecolors } from "./palettes.js";
import { getItemFileName } from "../utils/fileName.js";
import { loadImage } from "../canvas/load-image.js";
import { getImageToDraw } from "../canvas/palette-recolor.js";
import { customAnimations, customAnimationSize } from "../custom-animations.js";
import { getSortedLayersWithCustomFallback } from "./meta.js";
import { canvasToBlob } from "../canvas/canvas-utils.js";
import {
  addAnimationToZipFolder,
  addStandardAnimationToZipCustomFolder,
  addCharacterJsonAndCredits,
  downloadZipBlob,
  extractFramesFromAnimation,
  extractFramesFromCustomAnimation,
  guardZipExportEnvironment,
  newAnimationFromSheet,
  zipExportTimestamp,
  zipGenerateBlobWithProfiler,
} from "../utils/zip-helpers.js";
import { debugLog, debugWarn } from "../utils/debug.js";
import { createZipExportProfiler } from "../performance-profiler.js";
import {
  beginZipExportUiSuspend,
  endZipExportUiSuspend,
} from "../utils/zip-export-ui-suspend.js";

/**
 * ZIP download pack exports. Each flow uses `createZipExportProfiler` (see
 * `performance-profiler.js`) for `credits/metadata.json` timings where applicable,
 * suspends UI redraw/preview during export (`zip-export-ui-suspend.js`), and uses
 * `zipGenerateBlobWithProfiler` for the final blob.
 *
 * Reviewer map: `PERFORMANCE_PROFILING.md` → “Reviewing ZIP performance changes (PR)”.
 */

// Export ZIP - Split by animation
/**
 * @param {object} [deps]
 * @param {typeof addAnimationToZipFolder} [deps.addAnimationToZipFolder] — for tests (e.g. sinon.spy wrap)
 */
export const exportSplitAnimations = async (deps = {}) => {
  const baseAddAnimationToZipFolder =
    deps.addAnimationToZipFolder ?? addAnimationToZipFolder;

  if (!guardZipExportEnvironment()) return;

  let state;

  const profiler = createZipExportProfiler("splitAnimations");

  try {
    const addAnimationToZipFolderFn = (folder, fileName, srcCanvas, srcRect) =>
      baseAddAnimationToZipFolder(folder, fileName, srcCanvas, srcRect, {
        profiler,
      });

    const zip = new window.JSZip();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.js")).state; // Ensure state is loaded
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
    const exportedStandard = [];
    const failedStandard = [];

    for (const anim of animationList) {
      try {
        let animCanvas;
        animCanvas = profiler.syncPhase(
          "render_composite_extractAnimationFromCanvas",
          () => extractAnimationFromCanvas(anim.value),
        );
        profiler.incrementCounter("renderExtractAnimationFromCanvasCalls");
        const result = await addAnimationToZipFolderFn(
          standardFolder,
          `${anim.value}.png`,
          animCanvas,
          new DOMRect(0, 0, animCanvas.width, animCanvas.height),
        );
        if (result) {
          exportedStandard.push(anim.value);
        }
      } catch (err) {
        console.error(`Failed to export animation ${anim.value}:`, err);
        failedStandard.push(anim.value);
      }
    }

    // Handle custom animations
    const exportedCustom = [];
    const failedCustom = [];
    let y = SHEET_HEIGHT;

    for (const animName of addedCustomAnimations) {
      try {
        const anim = customAnimations[animName];
        if (!anim) {
          throw new Error("Animation definition not found");
        }

        const srcRect = { x: 0, y, ...customAnimationSize(anim) };
        const result = await addAnimationToZipFolderFn(
          customFolder,
          `${animName}.png`,
          canvas,
          srcRect,
        );

        if (result) {
          exportedCustom.push(animName);
        }

        y += srcRect.height;
      } catch (err) {
        console.error(`Failed to export custom animation ${animName}:`, err);
        failedCustom.push(animName);
      }
    }

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state, layers);
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
    alert(`Export failed: ${err.message}`);
  } finally {
    endZipExportUiSuspend();
    state.zipByAnimation.isRunning = false;
    m.redraw();
  }
};

// Export ZIP - Split by item
/**
 * @param {object} [deps]
 * @param {typeof addAnimationToZipFolder} [deps.addAnimationToZipFolder]
 * @param {typeof renderSingleItem} [deps.renderSingleItem]
 */
export const exportSplitItemSheets = async (deps = {}) => {
  const baseAddAnimationToZipFolder =
    deps.addAnimationToZipFolder ?? addAnimationToZipFolder;
  const profiler = createZipExportProfiler("splitItemSheets");
  const addAnimationToZipFolderFn = (folder, fileName, srcCanvas, srcRect) =>
    baseAddAnimationToZipFolder(folder, fileName, srcCanvas, srcRect, {
      profiler,
    });
  const renderSingleItemFn = deps.renderSingleItem ?? renderSingleItem;

  if (!guardZipExportEnvironment()) return;

  let state;

  try {
    const zip = new window.JSZip();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.js")).state; // Ensure state is loaded
    state.zipByItem.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure
    const itemsFolder = zip.folder("items");
    const creditsFolder = zip.folder("credits");

    const exportedItems = [];
    const failedItems = [];

    // Render each item individually
    for (const [, selection] of Object.entries(state.selections)) {
      const { itemId, variant, name } = selection;
      const itemLayers = getSortedLayersWithCustomFallback(itemId);

      // Get Multiple Recolors If Available
      const recolors = getMultiRecolors(itemId, state.selections);

      // Render each layer of the item separately
      for (const layer of itemLayers) {
        const fileName = getItemFileName(itemId, variant, name, layer.layerNum);
        try {
          let itemCanvas;
          itemCanvas = await renderSingleItemFn(
            itemId,
            variant,
            recolors,
            bodyType,
            state.selections,
            layer.layerNum,
            profiler,
          );
          profiler.incrementCounter("renderSingleItemCalls");

          if (itemCanvas) {
            await addAnimationToZipFolderFn(itemsFolder, fileName, itemCanvas);
            exportedItems.push(fileName);
          }
        } catch (err) {
          console.error(`Failed to export item ${fileName}:`, err);
          failedItems.push(fileName);
        }
      }
    }

    await profiler.phase("staticFiles", async () => {
      addCharacterJsonAndCredits(zip, creditsFolder, state, layers);
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
    alert(`Export failed: ${err.message}`);
  } finally {
    endZipExportUiSuspend();
    state.zipByItem.isRunning = false;
    m.redraw();
  }
};

// Export ZIP - Split by animation and item
/**
 * @param {object} [deps]
 * @param {typeof addAnimationToZipFolder} [deps.addAnimationToZipFolder]
 * @param {typeof renderSingleItemAnimation} [deps.renderSingleItemAnimation]
 * @param {typeof loadImage} [deps.loadImage]
 * @param {typeof addStandardAnimationToZipCustomFolder} [deps.addStandardAnimationToZipCustomFolder]
 * @param {typeof getImageToDraw} [deps.getImageToDraw]
 */
export const exportSplitItemAnimations = async (deps = {}) => {
  const baseAddAnimationToZipFolder =
    deps.addAnimationToZipFolder ?? addAnimationToZipFolder;
  const baseAddStandardAnimationToZipCustomFolder =
    deps.addStandardAnimationToZipCustomFolder ??
    addStandardAnimationToZipCustomFolder;
  const profiler = createZipExportProfiler("splitItemAnimations");
  const addAnimationToZipFolderFn = (folder, fileName, srcCanvas, srcRect) =>
    baseAddAnimationToZipFolder(folder, fileName, srcCanvas, srcRect, {
      profiler,
    });
  const addStandardAnimationToZipCustomFolderFn = (
    custAnimFolder,
    itemFileName,
    src,
    custAnim,
  ) =>
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

  let state;

  try {
    const zip = new window.JSZip();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.js")).state; // Ensure state is loaded
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
    const exportedStandard = {};
    const failedStandard = {};
    const exportedCustom = {};
    const failedCustom = {};

    // For each animation, create a folder and export each item
    for (const anim of animationList) {
      if (anim.noExport) continue;
      const animFolder = standardFolder.folder(anim.value);
      if (!animFolder) continue;

      exportedStandard[anim.value] = [];
      failedStandard[anim.value] = [];

      // Export each item for this animation
      for (const [, selection] of Object.entries(state.selections)) {
        const { itemId, variant, name } = selection;
        const meta = window.itemMetadata[itemId];
        if (!meta || !meta.animations.includes(anim.value)) {
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

        const itemLayers = getSortedLayersWithCustomFallback(itemId);
        for (const layer of itemLayers) {
          const fileName = getItemFileName(
            itemId,
            variant,
            name,
            layer.layerNum,
          );

          try {
            let animCanvas;
            animCanvas = await renderSingleItemAnimationFn(
              itemId,
              variant,
              recolors,
              bodyType,
              anim.value,
              state.selections,
              layer.layerNum,
              profiler,
            );
            profiler.incrementCounter("renderSingleItemAnimationCalls");

            if (animCanvas) {
              await addAnimationToZipFolderFn(animFolder, fileName, animCanvas);
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
          layer.variant,
          layer.name,
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
          let img;
          let imgCanvas;
          await profiler.phase(
            "render_imageLoadDecode_customItemSprite",
            async () => {
              img = await loadImageFn(spritePath, false);
            },
          );
          if (!img) continue;
          await profiler.phase(
            "render_composite_customItemSprite",
            async () => {
              imgCanvas = await getImageToDrawFn(
                img,
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
          const animCanvas =
            (layer.type === "extracted_frames" &&
              (await addStandardAnimationToZipCustomFolderFn(
                animFolder,
                itemFileName,
                imgCanvas,
                custAnim,
              ))) ||
            (await addAnimationToZipFolderFn(
              animFolder,
              itemFileName,
              imgCanvas,
              srcRect,
            ));

          if (animCanvas) custExportedItems.push(itemFileName);
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
      addCharacterJsonAndCredits(zip, creditsFolder, state, layers);
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
    alert(`Export failed: ${err.message}`);
  } finally {
    endZipExportUiSuspend();
    state.zipByAnimimationAndItem.isRunning = false;
    m.redraw();
  }
};

// Export ZIP - Individual animation frames
/**
 * @param {object} [deps]
 * @param {typeof extractAnimationFromCanvas} [deps.extractAnimationFromCanvas]
 * @param {typeof extractFramesFromAnimation} [deps.extractFramesFromAnimation]
 * @param {typeof canvasToBlob} [deps.canvasToBlob]
 * @param {typeof newAnimationFromSheet} [deps.newAnimationFromSheet]
 * @param {typeof extractFramesFromCustomAnimation} [deps.extractFramesFromCustomAnimation]
 */
export const exportIndividualFrames = async (deps = {}) => {
  const extractAnimationFromCanvasFn =
    deps.extractAnimationFromCanvas ?? extractAnimationFromCanvas;
  const extractFramesFromAnimationFn =
    deps.extractFramesFromAnimation ?? extractFramesFromAnimation;
  const canvasToBlobFn = deps.canvasToBlob ?? canvasToBlob;
  const extractFramesFromCustomAnimationFn =
    deps.extractFramesFromCustomAnimation ?? extractFramesFromCustomAnimation;

  const sliceCanvasForCustomAnim = (src, rect) => {
    if (deps.newAnimationFromSheet) {
      return deps.newAnimationFromSheet(src, rect);
    }
    return newAnimationFromSheet(src, rect);
  };

  if (!guardZipExportEnvironment()) return;

  let state;

  const profiler = createZipExportProfiler("individualFrames");

  try {
    const zip = new window.JSZip();
    const timestamp = zipExportTimestamp();

    state = (await import("./state.js")).state;
    state.zipIndividualFrames = state.zipIndividualFrames || {
      isRunning: false,
    };
    state.zipIndividualFrames.isRunning = true;
    m.redraw();
    beginZipExportUiSuspend();
    const bodyType = state.bodyType;

    // Create folder structure
    const standardFolder = zip.folder("standard");
    const customFolder = zip.folder("custom");
    const creditsFolder = zip.folder("credits");

    const exportedAnimations = [];
    const failedAnimations = [];
    const directions = ["up", "down", "left", "right"];

    // Pre-extract, slice to per-frame canvases, and queue PNG encodes (render path)
    const animationCanvases = new Map();
    const blobTasks = [];
    const exportedCustom = [];
    const failedCustom = [];
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

        /** @type {HTMLCanvasElement | null | undefined} */
        let custAnimCanvas;
        profiler.syncPhase("render_composite_sliceCanvasForCustomAnim", () => {
          custAnimCanvas = sliceCanvasForCustomAnim(canvas, srcRect);
        });
        if (custAnimCanvas) {
          profiler.syncPhase(
            "render_composite_extractFramesFromCustomAnimation",
            () => {
              const animFolder = customFolder.folder(animName);
              const frames = extractFramesFromCustomAnimationFn(
                custAnimCanvas,
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
    let blobResults;
    await profiler.phase("pngEncode", async () => {
      blobResults = await Promise.all(
        blobTasks.map(async (task) => {
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
      addCharacterJsonAndCredits(zip, creditsFolder, state, layers);
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
    alert(`Export failed: ${err.message}`);
  } finally {
    endZipExportUiSuspend();
    if (state && state.zipIndividualFrames) {
      state.zipIndividualFrames.isRunning = false;
    }
    m.redraw();
  }
};

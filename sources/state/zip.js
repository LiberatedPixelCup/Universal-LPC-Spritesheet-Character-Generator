import { ANIMATIONS } from "./constants.js";
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
import { getAllCredits, creditsToTxt, creditsToCsv } from "../utils/credits.js";
import { getItemFileName } from "../utils/fileName.js";
import { loadImage } from "../canvas/load-image.js";
import { drawFramesToCustomAnimation } from "../canvas/draw-frames.js";
import { exportStateAsJSON } from "./json.js";
import {
  customAnimations,
  customAnimationSize,
  isCustomAnimationBasedOnStandardAnimation,
} from "../custom-animations.js";
import { getSortedLayers } from "./meta.js";
import { get2DContext } from "../canvas/canvas-utils.js";

// Helper to convert canvas to blob
const canvasToBlob = (canvas) => {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    } catch (err) {
      reject(new Error(`Canvas to Blob conversion failed: ${err.message}`));
    }
  });
};

// Helper to convert image to canvas
function image2canvas(img) {
  const imgCanvas = document.createElement("canvas");
  imgCanvas.width = img.width;
  imgCanvas.height = img.height;
  const imgCtx = get2DContext(imgCanvas);
  if (!imgCtx) {
    throw new Error("Failed to get canvas context");
  }
  imgCtx.drawImage(img, 0, 0);
  return imgCanvas;
}

// Helper function to check if a region has non-transparent pixels
function hasContentInRegion(ctx, x, y, width, height) {
  try {
    const imageData = ctx.getImageData(x, y, width, height);
    return imageData.data.some((pixel) => pixel !== 0);
  } catch (e) {
    console.warn("Error checking region content:", e);
    return false;
  }
}

function newAnimationFromSheet(src, srcRect) {
  const { x, y, width, height } = srcRect || {
    x: 0,
    y: 0,
    width: src.width,
    height: src.height,
  };
  const fromSubregion =
    x !== 0 || y !== 0 || width !== src.width || height !== src.height;
  if (fromSubregion) {
    if (!hasContentInRegion(src.getContext("2d"), x, y, width, height))
      return null;
  }

  const animCanvas = document.createElement("canvas");
  animCanvas.width = width;
  animCanvas.height = height;
	const animCtx = get2DContext(animCanvas, true); // Set willReadFrequently to true

  if (!animCtx) {
    throw new Error("Failed to get canvas context");
  }

  animCtx.drawImage(src, x, y, width, height, 0, 0, width, height);

  return animCanvas;
}

async function addAnimationToZipFolder(folder, fileName, srcCanvas, srcRect) {
  if (srcCanvas) {
    const animCanvas = newAnimationFromSheet(srcCanvas, srcRect);
    if (animCanvas) {
      const blob = await canvasToBlob(animCanvas);
      if (fileName.endsWith(".png")) {
        if (window.DEBUG) {
          console.log(
            `Adding to ZIP: `,
            `${folder.root}${fileName}`,
            "size: ",
            blob.size
          );
        }
        folder.file(fileName, blob);
      } else {
        if (window.DEBUG) {
          console.log(
            "Adding to ZIP: ",
            `${folder.root}/${fileName}.png`,
            "size: ",
            blob.size
          );
        }
        folder.file(`${fileName}.png`, blob);
      }
      return animCanvas;
    }
  }
}

// Export ZIP - Split by animation
export const exportSplitAnimations = async () => {
  if (!window.canvasRenderer || !window.JSZip) {
    alert("JSZip library not loaded");
    return;
  }

  let state;

  try {
    const zip = new window.JSZip();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);

    state = (await import("./state.js")).state; // Ensure state is loaded
    state.zipByAnimation.isRunning = true;
    m.redraw();
    const bodyType = state.bodyType;

    // Create folder structure to match original
    const standardFolder = zip.folder("standard");
    const customFolder = zip.folder("custom");
    const creditsFolder = zip.folder("credits");

    // Get available animations from canvas renderer
    const animationList = ANIMATIONS;
    const exportedStandard = [];
    const failedStandard = [];

    // Create animation PNGs in standard folder
    for (const anim of animationList) {
      try {
        const animCanvas = extractAnimationFromCanvas(anim.value);
        await addAnimationToZipFolder(
          standardFolder,
          `${anim.value}.png`,
          animCanvas,
          new DOMRect(0, 0, animCanvas.width, animCanvas.height)
        );
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
        const animCanvas = await addAnimationToZipFolder(
          customFolder,
          `${animName}.png`,
          canvas,
          srcRect
        );

        if (animCanvas) exportedCustom.push(animName);

        y += srcRect.height;
      } catch (err) {
        console.error(`Failed to export custom animation ${animName}:`, err);
        failedCustom.push(animName);
      }
    }

    // Add character.json at root
    zip.file("character.json", exportStateAsJSON(state, layers));

    // Add credits in credits folder
    const allCredits = getAllCredits(state.selections, state.bodyType);
    creditsFolder.file("credits.txt", creditsToTxt(allCredits));
    creditsFolder.file("credits.csv", creditsToCsv(allCredits));

    // Add metadata.json in credits folder
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
      frameSize: 64,
      frameCounts: {}, // Would need to map animation frame counts
    };
    creditsFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lpc_${bodyType}_animations_${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    if (failedStandard.length > 0 || failedCustom.length > 0) {
      alert(
        `Export completed with some issues:\nFailed to export animations: ${failedStandard.join(
          ", "
        )}`
      );
    } else {
      alert("Export complete!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${err.message}`);
  } finally {
    state.zipByAnimation.isRunning = false;
    m.redraw();
  }
};

// Export ZIP - Split by item
export const exportSplitItemSheets = async () => {
  if (!window.canvasRenderer || !window.JSZip) {
    alert("JSZip library not loaded");
    return;
  }

  let state;

  try {
    const zip = new window.JSZip();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);

    state = (await import("./state.js")).state; // Ensure state is loaded
    state.zipByItem.isRunning = true;
    m.redraw();
    const bodyType = state.bodyType;

    // Create folder structure
    const itemsFolder = zip.folder("items");
    const creditsFolder = zip.folder("credits");

    const exportedItems = [];
    const failedItems = [];

    // Render each item individually
    for (const [categoryPath, selection] of Object.entries(state.selections)) {
      const { itemId, variant, name } = selection;
      const layers = getSortedLayers(itemId, true);

      // Render each layer of the item separately
      for (const layer of layers) {
        if (layer.custom_animation) continue;
        const fileName = getItemFileName(itemId, variant, name, layer.layerNum);
        try {
          // Render just this one item
          const itemCanvas = await renderSingleItem(
            itemId,
            variant,
            bodyType,
            state.selections,
            layer.layerNum
          );

          if (itemCanvas) {
            await addAnimationToZipFolder(
              itemsFolder,
              `${fileName}.png`,
              itemCanvas
            );
            exportedItems.push(fileName);
          }
        } catch (err) {
          console.error(`Failed to export item ${fileName}:`, err);
          failedItems.push(fileName);
        }
      }
    }

    // Add character.json at root
    zip.file("character.json", exportStateAsJSON(state, layers));

    // Add credits in credits folder
    const allCredits = getAllCredits(state.selections, state.bodyType);
    creditsFolder.file("credits.txt", creditsToTxt(allCredits));
    creditsFolder.file("credits.csv", creditsToCsv(allCredits));

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lpc_${bodyType}_item_spritesheets_${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    if (failedItems.length > 0) {
      alert(
        `Export completed with some issues:\nFailed items: ${failedItems.join(
          ", "
        )}`
      );
    } else {
      alert("Export complete!");
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(`Export failed: ${err.message}`);
  } finally {
    state.zipByItem.isRunning = false;
    m.redraw();
  }
};

function newStandardAnimationForCustomAnimation(src, custAnim) {
  const custCanvas = document.createElement("canvas");
  const { width: custWidth, height: custHeight } =
    customAnimationSize(custAnim);
  custCanvas.width = custWidth;
  custCanvas.height = custHeight;
	const custCtx = get2DContext(custCanvas, true); // Set willReadFrequently to true
  drawFramesToCustomAnimation(custCtx, custAnim, 0, src, null);
  return custCanvas;
}

async function addStandardAnimationToZipCustomFolder(
  custAnimFolder,
  itemFileName,
  src,
  custAnim
) {
  const custCanvas = newStandardAnimationForCustomAnimation(src, custAnim);
  const custBlob = await canvasToBlob(custCanvas);
  custAnimFolder.file(itemFileName, custBlob);
  return custCanvas;
}

// Export ZIP - Split by animation and item
export const exportSplitItemAnimations = async () => {
  if (!window.canvasRenderer || !window.JSZip) {
    alert("JSZip library not loaded");
    return;
  }

  let state;

  try {
    const zip = new window.JSZip();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);

    state = (await import("./state.js")).state; // Ensure state is loaded
    state.zipByAnimimationAndItem.isRunning = true;
    m.redraw();
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
      for (const [categoryPath, selection] of Object.entries(
        state.selections
      )) {
        const { itemId, variant, name } = selection;
        const meta = window.itemMetadata[itemId];
        if (!meta || !meta.animations.includes(anim.value)) {
          if (window.DEBUG)
            console.log(
              "Skipping item ",
              itemId,
              " without the animation: ",
              anim.value
            );
          continue;
        }

        // Render each layer of the item separately
        const layers = getSortedLayers(itemId, true);
        for (const layer of layers) {
          const fileName = getItemFileName(
            itemId,
            variant,
            name,
            layer.layerNum
          );

          try {
            // Render just this item for this animation
            const animCanvas = await renderSingleItemAnimation(
              itemId,
              variant,
              bodyType,
              anim.value,
              state.selections,
              layer.layerNum
            );

            if (animCanvas) {
              await addAnimationToZipFolder(
                animFolder,
                `${fileName}.png`,
                animCanvas
              );
              exportedStandard[anim.value].push(fileName);
            }

            for (const custAnimName of addedCustomAnimations) {
              const custAnim = customAnimations[custAnimName];
              if (!isCustomAnimationBasedOnStandardAnimation(custAnim, name))
                continue;

              const custExportedItems = exportedCustom[custAnimName] ?? [];
              exportedCustom[custAnimName] = custExportedItems;
              const custFailedItems = failedCustom[custAnimName] ?? [];
              const itemFileName = fileName;
              try {
                const custAnimFolder = customFolder.folder(custAnimName);
                const spritePath = layer.spritePath;
                const img = await loadImage(spritePath, false);
                if (
                  await addStandardAnimationToZipCustomFolder(
                    custAnimFolder,
                    itemFileName,
                    img,
                    custAnim
                  )
                )
                  custExportedItems.push(itemFileName);
              } catch (err) {
                console.error(
                  `Failed to export item ${itemFileName} in custom animation ${custAnimName}:`,
                  err
                );
                custFailedItems.push(itemFileName);
                failedCustom[custAnimName] = custFailedItems;
              }
            }
          } catch (err) {
            console.error(
              `Failed to export ${fileName} for ${anim.value}:`,
              err
            );
            failedStandard[anim.value].push(fileName);
          }
        }
      }
    }

    if (window.DEBUG) console.log(customAreaItems);

    for (const customAnimName of Object.keys(customAreaItems)) {
      // Export items exclusive to custom animations
      for (const layer of customAreaItems[customAnimName]) {
        const custName = layer.animation;

        if (window.DEBUG) {
          console.log(
            "Processing layer for custom animation only export:",
            layer
          );
        }

        const spritePath = layer.spritePath;
        const itemFileName = getItemFileName(
          layer.itemId,
          layer.variant,
          layer.name
        );
        const custExportedItems = exportedCustom[custName] ?? [];
        exportedCustom[custName] = custExportedItems;
        const custFailedItems = failedCustom[custName] ?? [];

        try {
          if (window.DEBUG) {
            console.log(
              `Exporting item ${itemFileName} for custom animation ${custName}`
            );
          }
          const img = await loadImage(spritePath, false);
          if (!img) continue;

          const imgCanvas = image2canvas(img);
          const custAnim = customAnimations[custName];
          if (!custAnim)
            throw new Error(
              "Custom animation not found for item: " + layer.itemId
            );
          const custSize = customAnimationSize(custAnim);
          const srcRect = { x: 0, y: 0, ...custSize };
          const animFolder = customFolder.folder(custName);
          if (
            await addAnimationToZipFolder(
              animFolder,
              itemFileName,
              imgCanvas,
              srcRect
            )
          )
            custExportedItems.push(itemFileName);
        } catch (err) {
          console.error(
            `Failed to export item ${itemFileName} in custom animation ${custName}:`,
            err
          );
          custFailedItems.push(itemFileName);
          failedCustom[custName] = custFailedItems;
        }
      }
    }

    // Add character.json at root
    zip.file("character.json", exportStateAsJSON(state, layers));

    // Add credits in credits folder
    const allCredits = getAllCredits(state.selections, state.bodyType);
    creditsFolder.file("credits.txt", creditsToTxt(allCredits));
    creditsFolder.file("credits.csv", creditsToCsv(allCredits));

    // Add metadata.json in credits folder
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
      frameSize: 64,
      frameCounts: {},
    };
    creditsFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

    // Generate and download ZIP
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lpc_${bodyType}_item_animations_${timestamp}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    // Report failures if any
    const failedCount = Object.values(failedStandard).reduce(
      (sum, arr) => sum + arr.length,
      0
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
    state.zipByAnimimationAndItem.isRunning = false;
    m.redraw();
  }
};

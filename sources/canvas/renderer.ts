// Canvas rendering module for Mithril UI
// Simplified renderer that draws character sprites based on selections

import { ok, err, type Result } from "neverthrow";
import { loadImage, loadImagesInParallel } from "./load-image.ts";
import type { LoadedImage } from "./load-image.ts";
import { getSpritePath } from "../state/path.ts";
import { getImageToDraw } from "./palette-recolor.ts";
import { getMultiRecolors } from "../state/palettes.ts";
import { get2DContext, getZPos } from "./canvas-utils.ts";
import { variantToFilename } from "../utils/helpers.ts";
import { drawFramesToCustomAnimation } from "./draw-frames.ts";
import {
  FRAME_SIZE,
  ANIMATION_OFFSETS,
  ANIMATION_CONFIGS,
} from "../state/constants.ts";
import { customAnimations, customAnimationBase } from "../custom-animations.ts";
import {
  setCurrentCustomAnimations,
  setCustomAnimYPositions,
} from "./preview-animation.ts";
import { getSortedLayersByAnim } from "../state/meta.ts";
import type { AnimationLayer } from "../state/meta.ts";
import { catalogReady, getItemMerged } from "../state/catalog.ts";
import m from "mithril";
import { debugWarn } from "../utils/debug.ts";
import type { Selections } from "../state/state.ts";
import type { ZipExportProfiler } from "../performance-profiler.ts";

declare global {
  interface Window {
    /** Performance profiler installed by tests / dev tooling; absent in production. */
    profiler?: {
      mark: (name: string) => void;
      measure: (name: string, start: string, end: string) => void;
    };
    /** Module namespace of this file, attached at boot by `main.js`. */
    canvasRenderer?: typeof import("./renderer.ts");
  }
}

type Recolors = ReturnType<typeof getMultiRecolors>;

type AnimationConfig = { row: number; num: number; cycle: number[] };
const animationConfigByName = ANIMATION_CONFIGS as Record<
  string,
  AnimationConfig | undefined
>;

/**
 * A standard-animation sprite item collected during `runRenderCharacter`. The
 * `customImage` variant (used for the user-uploaded sprite) carries an
 * already-loaded `HTMLImageElement` and has `spritePath: null`; everything else
 * resolves a path through `getSpritePath`.
 */
export type ItemToDraw = {
  itemId: string;
  name?: string;
  variant: string | null;
  recolors?: Recolors;
  spritePath: string | null;
  zPos: number;
  layerNum: number;
  animation: string;
  yPos: number;
  isCustom: boolean;
  needsRecolor?: boolean;
  customImage?: HTMLImageElement;
};

/**
 * One entry in the exported `layers` array — deduplicated by `(itemId, layerNum)`
 * across all standard animations of `itemsToDraw`. Consumers: `state/zip.js`,
 * `components/download/Download.js`, and tests.
 */
export type RenderedLayer = Omit<ItemToDraw, "spritePath" | "animation"> & {
  fileName: string;
  supportedAnimations: string[];
};

type CustomAnimationItem = {
  itemId: string;
  name?: string;
  variant: string | null;
  recolors: Recolors;
  spritePath: string;
  zPos: number;
  layerNum: number;
  customAnimation: string;
  isCustom: true;
};

type CustomSpriteAreaItem = {
  type: "custom_sprite";
  zPos: number;
  spritePath: string;
  itemId: string;
  animation: string;
  recolors: Recolors;
  variant: string | null;
  name?: string;
};

type ExtractedFramesAreaItem = {
  type: "extracted_frames";
  zPos: number;
  spritePath: string | null;
  itemId: string;
  animation: string;
  needsRecolor?: boolean;
  recolors?: Recolors;
  variant: string | null;
  name?: string;
};

export type CustomAreaItem = CustomSpriteAreaItem | ExtractedFramesAreaItem;

/**
 * When `zipProfiler` is set, records separate load/decode vs compositing phases; otherwise runs load then composite.
 */
async function zipExportProfiledLoadComposite(
  zipProfiler: ZipExportProfiler | null | undefined,
  loadPhaseName: string,
  compositePhaseName: string,
  loadFn: () => void | Promise<void>,
  compositeFn: () => void | Promise<void>,
): Promise<void> {
  if (zipProfiler && typeof zipProfiler.phase === "function") {
    await zipProfiler.phase(loadPhaseName, loadFn);
    await zipProfiler.phase(compositePhaseName, compositeFn);
  } else {
    await loadFn();
    await compositeFn();
  }
}

export const SHEET_HEIGHT = 3456; // Full universal sheet height
export const SHEET_WIDTH = 832; // 13 frames * 64px

export let canvas: HTMLCanvasElement | null = null;
export let ctx: CanvasRenderingContext2D | null = null;
export let layers: RenderedLayer[] = [];
export let itemsToDraw: ItemToDraw[] = [];
export let addedCustomAnimations: Set<string> = new Set();
export let customAreaItems: Record<string, CustomAreaItem[]> = {};
/** True after `initCanvas()` — offscreen buffer exists (main bootstrap runs this after S1∧S2). */
let offscreenCanvasInitialized = false;

/**
 * Initialize the canvas (creates offscreen canvas)
 */
export function initCanvas(): void {
  canvas = document.createElement("canvas");
  ctx = get2DContext(canvas);
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
  offscreenCanvasInitialized = true;
}

export function isOffscreenCanvasInitialized(): boolean {
  return offscreenCanvasInitialized;
}

/** @internal Test helper */
export function resetOffscreenCanvasStateForTests(): void {
  offscreenCanvasInitialized = false;
  canvas = null;
  ctx = null;
}

/** @internal Test helper (e.g. Node without a DOM) */
export function setOffscreenCanvasInitializedForTests(value: boolean): void {
  offscreenCanvasInitialized = value;
}

/** Commit 10: one render at a time; new calls wait behind the in-flight one. */
let renderCharacterSerial: Promise<void> = Promise.resolve();

/** @internal */
export function resetRenderCharacterQueueForTests(): void {
  renderCharacterSerial = Promise.resolve();
}

/**
 * Render character based on selections. Waits for layers metadata (S5), then runs serialized so
 * hash, defaults, and App updates cannot overlap expensive full renders.
 * The `onLayersReady` wait, dynamic `import` of `state`, and the serialized render queue
 * are outside the `renderCharacter` performance measure; marks wrap compositing in `runRenderCharacter` only.
 */
export async function renderCharacter(
  selections: Selections,
  bodyType: string,
  targetCanvas: HTMLCanvasElement | null = null,
): Promise<void> {
  await catalogReady.onLayersReady;

  const p = renderCharacterSerial.then(() =>
    runRenderCharacter(selections, bodyType, targetCanvas),
  );
  renderCharacterSerial = p.then(
    () => {},
    () => {},
  );
  return p;
}

async function runRenderCharacter(
  selections: Selections,
  bodyType: string,
  targetCanvas: HTMLCanvasElement | null,
): Promise<void> {
  const profiler = window.profiler;

  // Build list of items to draw
  itemsToDraw = [];
  addedCustomAnimations = new Set(); // Track which custom animations we've added

  // Import state to access custom uploaded image (kept out of `renderCharacter` profile span)
  const appState = await import("../state/state.ts").then((mod) => mod.state);
  appState.renderCharacter.isRendering = true;
  appState.isRenderingCharacter = true;
  m.redraw();

  if (profiler) {
    profiler.mark("renderCharacter:start");
  }

  try {
    // Use provided canvas or default to main canvas
    const renderCanvas = targetCanvas || canvas;
    const renderCtx = renderCanvas?.getContext("2d", {
      willReadFrequently: true,
    });

    if (!renderCanvas || !renderCtx) {
      console.error("Canvas not initialized");
      throw new Error("Canvas not initialized");
    }

    // Build list of items to draw
    const customAnimationItems: CustomAnimationItem[] = []; // Track items with custom animations

    for (const [, selection] of Object.entries(selections)) {
      const { itemId, subId, variant } = selection;
      const metaResult = getItemMerged(itemId);
      if (metaResult.isErr() || subId) continue;
      const meta = metaResult.value;

      // Check if this body type is supported
      if (!meta.required.includes(bodyType)) {
        continue;
      }

      // Get Multiple Recolors If Available
      const recolors = getMultiRecolors(itemId, selections);

      // Process all layers for this item
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        // Check if this layer exists
        const layerKey = `layer_${layerNum}`;
        const layer = meta.layers?.[layerKey];
        if (!layer) break;

        const zPos = getZPos(itemId, layerNum);

        // Check if this layer has a custom animation
        if (layer.custom_animation) {
          const customAnimName = layer.custom_animation as string;
          addedCustomAnimations.add(customAnimName);

          // Get base path for this body type
          const basePath = layer[bodyType] as string | undefined;
          if (!basePath) {
            continue;
          }

          // Custom animations use direct file path
          const spritePath = `spritesheets/${basePath}${variantToFilename(
            variant ?? "",
          )}.png`;

          customAnimationItems.push({
            itemId,
            name: selection.name,
            variant: variant ?? null,
            recolors,
            spritePath,
            zPos,
            layerNum,
            customAnimation: customAnimName,
            isCustom: true,
          });

          continue; // Skip standard animation processing for this layer
        }

        // Process standard animations for this layer
        for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
          // Skip if item doesn't have animations array (custom animations only)
          if (!meta.animations || meta.animations.length === 0) {
            continue;
          }

          // Map folder name to metadata name for checking support
          // e.g., "combat_idle" -> check for "combat" or "1h_slash" in metadata
          if (animName === "combat_idle") {
            // combat_idle is supported if item has "combat" in metadata
            if (!meta.animations.includes("combat")) continue;
          } else if (animName === "backslash") {
            // backslash is supported if item has "1h_slash" OR "1h_backslash" in metadata
            if (
              !meta.animations.includes("1h_slash") &&
              !meta.animations.includes("1h_backslash")
            )
              continue;
          } else if (animName === "halfslash") {
            // halfslash is supported if item has "1h_halfslash" in metadata
            if (!meta.animations.includes("1h_halfslash")) continue;
          } else {
            // For all other animations, direct match required
            if (!meta.animations.includes(animName)) continue;
          }

          const spritePath = getSpritePath(
            itemId,
            variant ?? null,
            recolors,
            bodyType,
            animName,
            layerNum,
            selections,
            meta,
          ).unwrapOr(null);

          itemsToDraw.push({
            itemId,
            name: selection.name,
            variant: variant ?? null,
            recolors,
            spritePath,
            zPos,
            layerNum,
            animation: animName,
            yPos,
            isCustom: false,
            needsRecolor: itemId === "body-body" && variant !== "light", // Flag body variants for recoloring
          });
        }
      }
    }

    // Add custom uploaded image to itemsToDraw if present
    if (appState.customUploadedImage) {
      // Add custom image to be drawn at all standard animation positions
      for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
        itemsToDraw.push({
          itemId: "custom-upload",
          variant: null,
          spritePath: null, // Will draw directly from Image object
          zPos: appState.customImageZPos,
          layerNum: 0,
          animation: animName,
          yPos,
          isCustom: false,
          customImage: appState.customUploadedImage, // Store the Image object
        });
      }
    }

    // Sort standard items by zPos only (lower zPos = drawn first = behind)
    // This ensures shadow (zPos=0) is drawn before body (zPos=10), etc.
    itemsToDraw.sort((a, b) => a.zPos - b.zPos);

    // save layers for external access — dedupe by (itemId, layerNum), collecting
    // all `animation` values into `supportedAnimations`.
    layers = itemsToDraw.reduce<RenderedLayer[]>((acc, item) => {
      const existing = acc.find(
        (l) => l.itemId === item.itemId && l.layerNum === item.layerNum,
      );
      if (existing) {
        existing.supportedAnimations.push(item.animation);
        return acc;
      }
      const { spritePath, animation, ...rest } = item;
      acc.push({
        ...rest,
        fileName: spritePath
          ? spritePath.substring("spritesheets/".length)
          : "",
        supportedAnimations: [animation],
      });
      return acc;
    }, []);

    // Calculate total canvas height needed (standard sheet + custom animations)
    let totalHeight = SHEET_HEIGHT;
    let totalWidth = SHEET_WIDTH;
    const currentCustomAnimations: Record<
      string,
      (typeof customAnimations)[string]
    > = {};

    if (addedCustomAnimations.size > 0 && customAnimations) {
      for (const customAnimName of addedCustomAnimations) {
        const customAnimDef = customAnimations[customAnimName];
        if (customAnimDef) {
          const animHeight =
            customAnimDef.frameSize * customAnimDef.frames.length;
          const animWidth =
            customAnimDef.frameSize * customAnimDef.frames[0].length;
          totalHeight += animHeight;
          totalWidth = Math.max(totalWidth, animWidth);
          currentCustomAnimations[customAnimName] = customAnimDef;
        }
      }
    }

    // Resize canvas to fit all content
    renderCanvas.width = totalWidth;
    renderCanvas.height = totalHeight;

    // Clear canvas (no transparency background on offscreen canvas)
    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);

    // Store custom animations for animation preview dropdown
    setCurrentCustomAnimations(currentCustomAnimations);

    // Calculate custom animation Y positions first (needed for drawing standard items into custom areas)
    const customAnimYPositions: Record<string, number> = {};
    if (addedCustomAnimations.size > 0 && customAnimations) {
      let currentY = SHEET_HEIGHT;
      for (const customAnimName of addedCustomAnimations) {
        customAnimYPositions[customAnimName] = currentY;
        const customAnimDef = customAnimations[customAnimName];
        if (customAnimDef) {
          const animHeight =
            customAnimDef.frameSize * customAnimDef.frames.length;
          currentY += animHeight;
        }
      }
    }

    // Store Y positions for external access
    setCustomAnimYPositions(customAnimYPositions);

    // Load all standard animation images in parallel and attach them to their items
    const loadPromises = itemsToDraw.map((item) => {
      if (item.customImage) {
        // Custom image already loaded
        return Promise.resolve({ item, img: item.customImage, success: true });
      } else {
        // Load standard image
        return loadImage(item.spritePath!)
          .then((img) => ({ item, img, success: true }))
          .catch(() => {
            debugWarn(`Failed to load sprite: ${item.spritePath}`);
            return {
              item,
              img: null as HTMLImageElement | null,
              success: false,
            };
          });
      }
    });

    const loadedItems = await Promise.all(loadPromises);

    // Draw all items in sorted z-order
    for (const { item, img, success } of loadedItems) {
      if (success && img) {
        const imageToDraw = await getImageToDraw(
          img,
          item.itemId,
          item.recolors,
          item.spritePath,
        );
        renderCtx.drawImage(imageToDraw, 0, item.yPos);
      }
    }

    customAreaItems = {};

    // Now handle custom animations (wheelchair, etc.)
    if (addedCustomAnimations.size > 0 && customAnimations) {
      // For each custom animation area, we need to draw layers in zPos order
      for (const customAnimName of addedCustomAnimations) {
        const customAnimDef = customAnimations[customAnimName];
        if (!customAnimDef) continue;

        const offsetY = customAnimYPositions[customAnimName];
        const baseAnim = customAnimationBase
          ? customAnimationBase(customAnimDef)
          : null;

        // Collect all items that need to be drawn in this custom animation area
        const areaItems: CustomAreaItem[] = [];
        customAreaItems[customAnimName] = areaItems;

        // 1. Add custom animation sprite layers (wheelchair background/foreground)
        for (const item of customAnimationItems) {
          if (item.customAnimation === customAnimName) {
            areaItems.push({
              type: "custom_sprite",
              zPos: item.zPos,
              spritePath: item.spritePath,
              itemId: item.itemId,
              animation: customAnimName,
              recolors: item.recolors,
              variant: item.variant,
              name: item.name,
            });
          }
        }

        // 2. Add standard items that need to be extracted into this custom animation
        // (e.g., body "sit" frames go into wheelchair custom animation)
        if (baseAnim) {
          for (const item of itemsToDraw) {
            if (item.animation === baseAnim) {
              areaItems.push({
                type: "extracted_frames",
                zPos: item.zPos,
                spritePath: item.spritePath,
                itemId: item.itemId,
                animation: item.animation,
                needsRecolor: item.needsRecolor,
                recolors: item.recolors,
                variant: item.variant,
                name: item.name,
              });
            }
          }
        }

        // Sort by zPos to get correct layer order
        areaItems.sort((a, b) => a.zPos - b.zPos);

        // Load all custom area images in parallel
        const loadedCustomImages = await loadImagesInParallel(areaItems);

        // Draw in zPos order
        for (const { item: areaItem, img, success } of loadedCustomImages) {
          if (success && img) {
            const imageToUse = await getImageToDraw(
              img,
              areaItem.itemId,
              areaItem.recolors,
              areaItem.spritePath,
            );

            if (areaItem.type === "custom_sprite") {
              // Draw custom sprite directly (wheelchair background or foreground)
              renderCtx.drawImage(imageToUse, 0, offsetY);
            } else if (areaItem.type === "extracted_frames") {
              // Extract and draw frames from standard sprite
              drawFramesToCustomAnimation(
                renderCtx,
                customAnimDef,
                offsetY,
                imageToUse,
              );
            }
          }
        }
      }
    }
  } finally {
    appState.renderCharacter.isRendering = false;
    appState.isRenderingCharacter = false;
    m.redraw();

    // Mark end and measure
    if (profiler) {
      profiler.mark("renderCharacter:end");
      profiler.measure(
        "renderCharacter",
        "renderCharacter:start",
        "renderCharacter:end",
      );
    }
  }
}

/**
 * Extract a specific animation from the main canvas.
 * Returns a new canvas with just that animation.
 */
export function extractAnimationFromCanvas(
  animationName: string,
): HTMLCanvasElement | null {
  if (!canvas) {
    return null;
  }

  const config = animationConfigByName[animationName];
  if (!config) {
    console.error("Unknown animation:", animationName);
    return null;
  }

  const { row, num } = config;
  const srcY = row * FRAME_SIZE;
  const srcHeight = num * FRAME_SIZE;

  // Create new canvas for this animation
  const animCanvas = document.createElement("canvas");
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = srcHeight;
  const animCtx = get2DContext(animCanvas);

  // Copy animation from main canvas
  animCtx.drawImage(
    canvas,
    0,
    srcY,
    SHEET_WIDTH,
    srcHeight,
    0,
    0,
    SHEET_WIDTH,
    srcHeight,
  );

  return animCanvas;
}

/** Error returned by `getCanvas` when called before `initCanvas` runs. */
export type CanvasNotInitialized = { kind: "canvas-not-initialized" };

/** Get current canvas reference (for external use). */
export function getCanvas(): Result<HTMLCanvasElement, CanvasNotInitialized> {
  return canvas ? ok(canvas) : err({ kind: "canvas-not-initialized" });
}

/**
 * Render a single item to a new canvas.
 * Returns a canvas with just this one item rendered.
 */
export async function renderSingleItem(
  itemId: string,
  variant: string | null,
  recolors: Recolors,
  bodyType: string,
  selections: Selections,
  singleLayer: number | null = null,
  zipProfiler: ZipExportProfiler | null = null,
): Promise<HTMLCanvasElement | null> {
  const metaResult = getItemMerged(itemId);
  if (metaResult.isErr()) {
    console.error("Item metadata not found:", itemId);
    return null;
  }
  const meta = metaResult.value;

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    console.error("Body type not supported for this item:", bodyType, itemId);
    return null;
  }

  // Check if this is a custom animation item
  const layer1 =
    meta.layers && Object.values(meta.layers).find((l) => l.custom_animation);
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  let itemCanvas: HTMLCanvasElement;
  let itemCtx: CanvasRenderingContext2D;

  if (hasCustomAnimation && customAnimations) {
    // Custom animation item - use custom animation size
    const customAnimName = layer1.custom_animation as string;
    const customAnimDef = customAnimations[customAnimName];
    if (!customAnimDef) {
      console.error("Custom animation definition not found:", customAnimName);
      return null;
    }

    const animHeight = customAnimDef.frameSize * customAnimDef.frames.length;
    const animWidth = customAnimDef.frameSize * customAnimDef.frames[0].length;

    const customLayers = Object.values(meta.layers).filter(
      (l) => l.custom_animation,
    );
    const customAnimationsInItem = customLayers
      .map((l) => l.custom_animation as string)
      .filter((value, index, array) => array.indexOf(value) === index);
    const numCustomAnims = customAnimationsInItem.length;
    const getYPosForCustomAnim = (name: string): number => {
      const index = customAnimationsInItem.indexOf(name);
      return SHEET_HEIGHT + index * animHeight;
    };

    itemCanvas = document.createElement("canvas");
    itemCanvas.width = animWidth;
    itemCanvas.height = SHEET_HEIGHT + animHeight * numCustomAnims;
    itemCtx = get2DContext(itemCanvas);

    // Render all layers of this custom animation item
    const customSprites: { spritePath: string; zPos: number; yPos: number }[] =
      [];
    const animsList = getSortedLayersByAnim(itemId, true).unwrapOr(
      {} as Record<string, AnimationLayer[]>,
    );
    for (const animName in animsList) {
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        if (singleLayer !== null && layerNum !== singleLayer) continue;
        const animLayer = animsList[animName]?.find(
          (l) => l.animLayerNum === layerNum,
        );
        if (!animLayer) continue;
        const layerKey = `layer_${animLayer.layerNum}`;
        const layer = meta.layers?.[layerKey];
        if (!layer) break;

        const yPos = getYPosForCustomAnim(layer.custom_animation as string);
        const basePath = layer[bodyType] as string | undefined;
        if (!basePath) continue;

        const spritePath = `spritesheets/${basePath}${variantToFilename(
          variant ?? "",
        )}.png`;

        customSprites.push({ spritePath, zPos: animLayer.zPos, yPos });
      }
    }

    // Sort by zPos
    customSprites.sort((a, b) => a.zPos - b.zPos);

    let loadedSprites:
      | LoadedImage<(typeof customSprites)[number]>[]
      | undefined;
    await zipExportProfiledLoadComposite(
      zipProfiler,
      "render_imageLoadDecode_renderSingleItem",
      "render_composite_renderSingleItem",
      async () => {
        loadedSprites = await loadImagesInParallel(customSprites);
      },
      async () => {
        if (!loadedSprites) return;
        for (const { item: sprite, img, success } of loadedSprites) {
          if (success && img) {
            const imageToDraw = await getImageToDraw(
              img,
              itemId,
              recolors,
              sprite.spritePath,
            );
            itemCtx.drawImage(imageToDraw, 0, sprite.yPos);
          }
        }
      },
    );
  } else {
    // Standard animation item - use standard sheet size
    itemCanvas = document.createElement("canvas");
    itemCanvas.width = SHEET_WIDTH;
    itemCanvas.height = SHEET_HEIGHT;
    itemCtx = get2DContext(itemCanvas);
  }

  // Build list of sprites to draw for this item
  type StandardSprite = {
    itemId: string;
    variant: string | null;
    recolors: Recolors;
    spritePath: string | null;
    zPos: number;
    layerNum: number;
    animation: string;
    yPos: number;
  };
  const spritesToDraw: StandardSprite[] = [];

  for (let layerNum = 1; layerNum < 10; layerNum++) {
    if (singleLayer !== null && layerNum !== singleLayer) continue;
    const layerKey = `layer_${layerNum}`;
    if (!meta.layers?.[layerKey]) break;

    const zPos = getZPos(itemId, layerNum);

    // Add each animation for this layer
    for (const [animName, yPos] of Object.entries(ANIMATION_OFFSETS)) {
      // Check animation support (same logic as renderCharacter)
      if (animName === "combat_idle") {
        if (!meta.animations.includes("combat")) continue;
      } else if (animName === "backslash") {
        if (
          !meta.animations.includes("1h_slash") &&
          !meta.animations.includes("1h_backslash")
        )
          continue;
      } else if (animName === "halfslash") {
        if (!meta.animations.includes("1h_halfslash")) continue;
      } else {
        if (!meta.animations.includes(animName)) continue;
      }

      const spritePath = getSpritePath(
        itemId,
        variant,
        recolors,
        bodyType,
        animName,
        layerNum,
        selections,
        meta,
      ).unwrapOr(null);

      spritesToDraw.push({
        itemId,
        variant,
        recolors,
        spritePath,
        zPos,
        layerNum,
        animation: animName,
        yPos,
      });
    }

    // Sort by animation first, then by zPos
    spritesToDraw.sort((a, b) => {
      if (a.yPos !== b.yPos) return a.yPos - b.yPos;
      return a.zPos - b.zPos;
    });

    let loadedImages: LoadedImage<StandardSprite>[] | undefined;
    await zipExportProfiledLoadComposite(
      zipProfiler,
      "render_imageLoadDecode_renderSingleItem",
      "render_composite_renderSingleItem",
      async () => {
        loadedImages = await loadImagesInParallel(spritesToDraw);
      },
      async () => {
        if (!loadedImages) return;
        for (const { item: sprite, img, success } of loadedImages) {
          if (success && img) {
            const imageToDraw = await getImageToDraw(
              img,
              itemId,
              sprite.recolors,
              sprite.spritePath,
            );
            itemCtx.drawImage(imageToDraw, 0, sprite.yPos);
          }
        }
      },
    );
  }

  return itemCanvas;
}

/**
 * Render a single item for a single animation to a new canvas.
 * Returns a canvas with just this one item's one animation rendered.
 */
export async function renderSingleItemAnimation(
  itemId: string,
  variant: string | null,
  recolors: Recolors,
  bodyType: string,
  animationName: string,
  selections: Selections,
  singleLayer: number | null = null,
  zipProfiler: ZipExportProfiler | null = null,
): Promise<HTMLCanvasElement | null> {
  const metaResult = getItemMerged(itemId);
  if (metaResult.isErr()) {
    console.error("Item metadata not found:", itemId);
    return null;
  }
  const meta = metaResult.value;

  // Check if this body type is supported
  if (!meta.required.includes(bodyType)) {
    return null;
  }

  // Check if this is a custom animation item
  const layer1 = meta.layers?.layer_1;
  const hasCustomAnimation = layer1 && layer1.custom_animation;

  if (hasCustomAnimation && customAnimations) {
    // Custom animation item - just return the full item canvas (custom animations are not split by standard animation)
    return await renderSingleItem(
      itemId,
      variant,
      recolors,
      bodyType,
      selections,
      singleLayer,
      zipProfiler,
    );
  }

  const config = animationConfigByName[animationName];
  if (!config) {
    console.error("Unknown animation:", animationName);
    return null;
  }

  const { num } = config;
  const animYPos = 0;
  const animHeight = num * FRAME_SIZE;

  // Create a new canvas for this animation
  const animCanvas = document.createElement("canvas");
  animCanvas.width = SHEET_WIDTH;
  animCanvas.height = animHeight;
  const animCtx = get2DContext(animCanvas);

  // Build list of sprites to draw for this item & animation
  type AnimSprite = {
    spritePath: string | null;
    zPos: number;
    layerNum: number;
    recolors: Recolors;
  };
  const spritesToDraw: AnimSprite[] = [];

  for (let layerNum = 1; layerNum < 10; layerNum++) {
    if (singleLayer !== null && layerNum !== singleLayer) continue;
    const layerKey = `layer_${layerNum}`;
    if (!meta.layers?.[layerKey]) break;

    const zPos = getZPos(itemId, layerNum);

    // Check animation support
    if (animationName === "combat_idle") {
      if (!meta.animations.includes("combat")) continue;
    } else if (animationName === "backslash") {
      if (
        !meta.animations.includes("1h_slash") &&
        !meta.animations.includes("1h_backslash")
      )
        continue;
    } else if (animationName === "halfslash") {
      if (!meta.animations.includes("1h_halfslash")) continue;
    } else {
      if (!meta.animations.includes(animationName)) continue;
    }

    const spritePath = getSpritePath(
      itemId,
      variant,
      recolors,
      bodyType,
      animationName,
      layerNum,
      selections,
      meta,
    ).unwrapOr(null);

    spritesToDraw.push({
      spritePath,
      zPos,
      layerNum,
      recolors,
    });
  }

  // Sort by zPos
  spritesToDraw.sort((a, b) => a.zPos - b.zPos);

  let loadedImages: LoadedImage<AnimSprite>[] | undefined;
  await zipExportProfiledLoadComposite(
    zipProfiler,
    "render_imageLoadDecode_renderSingleItemAnimation",
    "render_composite_renderSingleItemAnimation",
    async () => {
      loadedImages = await loadImagesInParallel(spritesToDraw);
    },
    async () => {
      if (!loadedImages) return;
      for (const { item: sprite, img, success } of loadedImages) {
        if (success && img) {
          const imageToDraw = await getImageToDraw(
            img,
            itemId,
            sprite.recolors,
            sprite.spritePath,
          );
          animCtx.drawImage(
            imageToDraw,
            0,
            animYPos,
            SHEET_WIDTH,
            animHeight,
            0,
            0,
            SHEET_WIDTH,
            animHeight,
          );
        }
      }
    },
  );

  return animCanvas;
}

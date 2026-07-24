import { ok, type Result } from "neverthrow";
import { variantToFilename } from "../utils/helpers.ts";
import { replaceInPath } from "./path.ts";
import {
  type CatalogReader,
  type ItemMerged,
  type LoadError,
} from "./catalog.ts";
import type { Selections } from "./state.ts";

export type SortedLayer = { layerNum: number; zPos: number };
export type AnimationLayer = SortedLayer & { animLayerNum: number };

/**
 * Tap a `LoadError` to surface a missing-item error to the console. Loading
 * errors are transient (chunk hasn't registered yet) and stay silent.
 */
function logIfNotFound(itemId: string): (err: LoadError) => LoadError {
  return (err) => {
    if (err.kind === "not-found") {
      console.error("Item metadata not found:", itemId);
    }
    return err;
  };
}

export type LayerToLoad = { zPos: number; path: string };

/** Sort layers by zPos. */
export function getSortedLayers(
  catalog: CatalogReader,
  itemId: string,
  standardOnly: boolean = false,
): Result<SortedLayer[], LoadError> {
  return catalog
    .getItemMerged(itemId)
    .mapErr(logIfNotFound(itemId))
    .map((meta) => {
      const layersList: SortedLayer[] = [];
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        const layerKey = `layer_${layerNum}`;
        const layer = meta.layers[layerKey];
        if (!layer) break;
        if (standardOnly && layer.custom_animation) continue;

        layersList.push({ layerNum, zPos: layer.zPos ?? 100 });
      }
      return layersList;
    });
}

/**
 * Layers for item-based ZIP exports: prefer standard sheet rows; if none
 * (custom-animation-only items), fall back to all layers.
 */
export function getSortedLayersWithCustomFallback(
  catalog: CatalogReader,
  itemId: string,
): Result<SortedLayer[], LoadError> {
  return getSortedLayers(catalog, itemId, true).andThen((layers) =>
    layers.length === 0 ? getSortedLayers(catalog, itemId) : ok(layers),
  );
}

/** Split layers by animation type, then sort by zPos. */
export function getSortedLayersByAnim(
  catalog: CatalogReader,
  itemId: string,
  customOnly: boolean = false,
): Result<Record<string, AnimationLayer[]>, LoadError> {
  return catalog
    .getItemMerged(itemId)
    .mapErr(logIfNotFound(itemId))
    .map((meta) => {
      const animsList: Record<string, SortedLayer[]> = {};
      for (let layerNum = 1; layerNum < 10; layerNum++) {
        const layerKey = `layer_${layerNum}`;
        const layer = meta.layers[layerKey];
        if (!layer) break;
        if (customOnly && !layer.custom_animation) continue;

        const animName =
          (layer.custom_animation as string | undefined) || "standard";
        if (!animsList[animName]) {
          animsList[animName] = [];
        }

        animsList[animName].push({ layerNum, zPos: layer.zPos ?? 100 });
      }

      // Sort each animation's layers by zPos.
      const result: Record<string, AnimationLayer[]> = {};
      for (const animName in animsList) {
        result[animName] = animsList[animName]
          .sort((a, b) => a.zPos - b.zPos)
          .map((layer, index) => ({
            layerNum: layer.layerNum,
            animLayerNum: index + 1,
            zPos: layer.zPos,
          }));
      }

      return result;
    });
}

/**
 * Get layers to load for the given metadata and variant.
 *
 * `variant` is required for layers with `custom_animation` (those entries
 * are omitted if missing).
 */
export function getLayersToLoad(
  catalog: CatalogReader,
  meta: ItemMerged,
  bodyType: string,
  selections: Selections,
  variant: string | null = null,
): LayerToLoad[] {
  // Check if this item uses a custom animation.
  const layer1 = meta.layers["layer_1"];
  const hasCustomAnimation = layer1?.custom_animation;
  const layer1CustomAnimation = hasCustomAnimation
    ? layer1.custom_animation
    : null;

  const layersToLoad: LayerToLoad[] = [];
  for (let layerNum = 1; layerNum < 10; layerNum++) {
    const layer = meta.layers[`layer_${layerNum}`];
    if (!layer) break;

    let layerPath = layer[bodyType] as string | undefined;
    if (!layerPath) continue;

    // Filter: only include layers with matching custom animation.
    if (layer1CustomAnimation) {
      if (layer.custom_animation !== layer1CustomAnimation) {
        continue;
      }
    }

    // Replace template variables like ${head}.
    if (layerPath.includes("${")) {
      layerPath = replaceInPath(catalog, layerPath, selections, meta);
    }

    const hasCustomAnim = layer.custom_animation;
    let imagePath: string;
    const variantFileName =
      variant !== null ? `${variantToFilename(variant)}` : "";
    if (hasCustomAnim) {
      // Skip legacy custom-animation directory paths (trailing slash) when no variant is selected
      if (!variantFileName && layerPath.endsWith("/")) {
        continue;
      }
      imagePath = `spritesheets/${layerPath}${variantFileName}.png`;
    } else {
      const defaultAnim = meta.animations.includes("walk")
        ? "walk"
        : meta.animations[0];
      imagePath = `spritesheets/${layerPath}${defaultAnim}${variantFileName ? `/${variantFileName}` : ""}.png`;
    }

    layersToLoad.push({
      zPos: (layer.zPos as number | undefined) ?? 100,
      path: imagePath,
    });
  }
  return layersToLoad.sort((a, b) => a.zPos - b.zPos);
}

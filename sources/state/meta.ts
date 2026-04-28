import { ok, type Result } from "neverthrow";
import { getZPos } from "../canvas/canvas-utils.ts";
import { variantToFilename } from "../utils/helpers.ts";
import { replaceInPath } from "./path.js";
import { getItemMerged, type ItemMerged, type LoadError } from "./catalog.ts";

// TODO(PR 3 — state.ts conversion): replace this placeholder with the canonical
// `Selection` type imported from `./state.ts`. `meta.ts` doesn't inspect the
// values itself — these fields exist downstream (`hash.js` reads them via
// `getHashParamsforSelections`) — but we declare them here so callers get a
// real shape until `state.ts` becomes the canonical source.
type Selection = {
  itemId: string;
  name?: string;
  variant?: string;
  recolor?: string;
  subId?: number | null;
};
type Selections = Record<string, Selection>;

type MetaDeps = {
  getZPos: (itemId: string, layerNum?: number) => number;
  variantToFilename: (variant: string) => string;
  replaceInPath: (
    path: string,
    selections: Selections,
    meta: ItemMerged,
  ) => string;
  /** Result-returning lookup; callers either `.unwrapOr(default)` or branch on `.isErr()`. */
  getItemMetadata: (itemId: string) => Result<ItemMerged, LoadError>;
};

// Dependency injection for testability (see setMetaDeps / resetMetaDeps)
function createDefaultMetaDeps(): MetaDeps {
  return {
    getZPos,
    variantToFilename,
    replaceInPath,
    getItemMetadata: getItemMerged,
  };
}

let metaDeps = createDefaultMetaDeps();

export function setMetaDeps(overrides: Partial<MetaDeps>): void {
  Object.assign(metaDeps, overrides);
}

export function resetMetaDeps(): void {
  metaDeps = createDefaultMetaDeps();
}

export function getMetaDeps(): MetaDeps {
  return metaDeps;
}

export type SortedLayer = { layerNum: number; zPos: number };
export type AnimationLayer = SortedLayer & { animLayerNum: number };

/** Sort layers by zPos. */
export function getSortedLayers(
  itemId: string,
  standardOnly: boolean = false,
): Result<SortedLayer[], LoadError> {
  return metaDeps.getItemMetadata(itemId).map((meta) => {
    const layersList: SortedLayer[] = [];
    for (let layerNum = 1; layerNum < 10; layerNum++) {
      const layerKey = `layer_${layerNum}`;
      const layer = meta.layers[layerKey];
      if (!layer) break;
      if (standardOnly && layer.custom_animation) continue;

      const zPos = metaDeps.getZPos(itemId, layerNum);
      layersList.push({ layerNum, zPos });
    }
    return layersList;
  });
}

/**
 * Layers for item-based ZIP exports: prefer standard sheet rows; if none
 * (custom-animation-only items), fall back to all layers.
 */
export function getSortedLayersWithCustomFallback(
  itemId: string,
): Result<SortedLayer[], LoadError> {
  return getSortedLayers(itemId, true).andThen((layers) =>
    layers.length === 0 ? getSortedLayers(itemId) : ok(layers),
  );
}

/** Split layers by animation type, then sort by zPos. */
export function getSortedLayersByAnim(
  itemId: string,
  customOnly: boolean = false,
): Result<Record<string, AnimationLayer[]>, LoadError> {
  return metaDeps.getItemMetadata(itemId).map((meta) => {
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

      const zPos = metaDeps.getZPos(itemId, layerNum);
      animsList[animName].push({ layerNum, zPos });
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

export type LayerToLoad = { zPos: number; path: string };

/**
 * Get layers to load for the given metadata and variant.
 *
 * `variant` is required for layers with `custom_animation` (those entries
 * are omitted if missing).
 */
export function getLayersToLoad(
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
      layerPath = metaDeps.replaceInPath(layerPath, selections, meta);
    }

    const hasCustomAnim = layer.custom_animation;
    let imagePath: string;
    const variantFileName =
      variant !== null ? `${metaDeps.variantToFilename(variant)}` : "";
    if (hasCustomAnim) {
      if (!variantFileName) {
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

/** Shared setup helpers for renderer browser specs. */
import {
  initCanvas,
  resetRenderCharacterQueueForTests,
  addedCustomAnimations,
  drawCalls,
  customAreaItems,
} from "../../sources/canvas/renderer.ts";

export const ALL_BODY_TYPES = [
  "male",
  "female",
  "teen",
  "child",
  "muscular",
  "pregnant",
];

/** Standard walk item pointing at real body sheets (path ok; load needs recolors). */
export function walkItemMeta(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: "Walk item",
    type_name: "misc",
    required: ["male"],
    animations: ["walk"],
    recolors: [],
    layers: {
      layer_1: {
        zPos: 10,
        male: "body/bodies/male/",
      },
    },
    ...overrides,
  };
}

export function resetRendererModuleState(): void {
  resetRenderCharacterQueueForTests();
  drawCalls.length = 0;
  for (const k of Object.keys(customAreaItems)) {
    delete customAreaItems[k];
  }
  addedCustomAnimations.clear();
  initCanvas();
}

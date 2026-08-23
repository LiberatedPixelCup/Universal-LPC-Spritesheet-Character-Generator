/** Shared body-recolor catalog fixtures for palette-recolor browser specs. */
import { createCatalog } from "../../sources/state/catalog.ts";
import { seedCatalog } from "../browser-catalog-fixture.js";

export const RECOLOR_ITEM_ID = "body";

export const itemMetadata = {
  [RECOLOR_ITEM_ID]: {
    name: "Body",
    type_name: "body",
    recolors: [
      {
        material: "body",
        default: "ulpc",
        base: "ulpc.light",
      },
    ],
  },
};

export const paletteMetadata = {
  versions: {},
  materials: {
    body: {
      default: "ulpc",
      base: "light",
      palettes: {
        ulpc: {
          light: ["#FF0000"],
          olive: ["#00FF00"],
          bronze: ["#0000FF"],
          teal: ["#00FFFF"],
        },
      },
    },
  },
};

export function seedRecolorCatalog(
  catalog: ReturnType<typeof createCatalog>,
): void {
  seedCatalog(catalog, itemMetadata, { paletteMetadata });
}

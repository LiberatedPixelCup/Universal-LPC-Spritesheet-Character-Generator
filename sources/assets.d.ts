// Ambient declarations for non-code module imports handled by Vite.
// Side-effect imports (`import "./foo.scss"`) need a matching module
// declaration so TypeScript doesn't complain. These have no runtime
// types; Vite processes the assets at build time.

declare module "*.scss";
declare module "*.css";

// Generated metadata chunks — imported via dynamic `import()` from
// `install-item-metadata.ts`. Vite's `vite/wiring.js` aliases these to
// `dist/*-metadata.js` (regex match), which the metadata plugin generates
// from `sheet_definitions/` + `palette_definitions/`. The shapes mirror
// the catalog's `register*` payloads.
declare module "*/index-metadata.js" {
  import type {
    AliasMetadata,
    CategoryTree,
    MetadataIndexes,
  } from "./state/catalog.ts";
  export const aliasMetadata: AliasMetadata;
  export const categoryTree: CategoryTree;
  export const metadataIndexes: MetadataIndexes;
}

declare module "*/palette-metadata.js" {
  import type { PaletteMetadata } from "./state/catalog.ts";
  export const paletteMetadata: PaletteMetadata;
}

declare module "*/item-metadata.js" {
  import type { ItemLite } from "./state/catalog.ts";
  export const itemMetadata: Record<string, ItemLite>;
}

declare module "*/credits-metadata.js" {
  import type { Credit } from "./state/catalog.ts";
  export const itemCredits: Record<string, Credit[]>;
}

declare module "*/layers-metadata.js" {
  import type { LayerEntry } from "./state/catalog.ts";
  export const itemLayers: Record<string, Record<string, LayerEntry>>;
}

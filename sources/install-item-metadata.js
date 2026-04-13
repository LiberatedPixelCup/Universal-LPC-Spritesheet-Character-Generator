/**
 * Single place that statically imports generated item metadata and exposes it on
 * `window`. Imported early from main (and from path) so globals exist before use.
 */
import {
  itemMetadata,
  aliasMetadata,
  categoryTree,
  paletteMetadata,
} from "../item-metadata.js";

window.itemMetadata = itemMetadata;
window.aliasMetadata = aliasMetadata;
window.categoryTree = categoryTree;
window.paletteMetadata = paletteMetadata;

import "chai";
import m from "mithril";
import {
  itemMetadata,
  aliasMetadata,
  categoryTree,
  paletteMetadata,
} from "../item-metadata.js";

globalThis.m = m;

window.__TEST_DEBUG_LOCKED__ = true;
window.DEBUG = import.meta.env.VITEST_DEBUG === "true";

window.itemMetadata = itemMetadata;
window.aliasMetadata = aliasMetadata;
window.categoryTree = categoryTree;
window.paletteMetadata = paletteMetadata;

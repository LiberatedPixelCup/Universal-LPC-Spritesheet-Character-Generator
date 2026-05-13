import "chai";
import "../sources/vendor-globals.ts";
import { catalogReady } from "../sources/state/catalog.ts";
// `install-item-metadata` runs `loadAllMetadata()` on the Testem/Vite test page and registers
// all five `dist/*-metadata.js` chunks with `catalog` before this module’s body runs.
import "../sources/install-item-metadata.ts";

await catalogReady.onAllReady;

window.__TEST_DEBUG_LOCKED__ = true;
window.DEBUG = import.meta.env.VITEST_DEBUG === "true";

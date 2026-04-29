// Main entry point - initializes and mounts the Mithril application

import m from "mithril";
import "./styles/critical-entry.scss";
import "./vendor-globals.js";
import { loadAllMetadata } from "./install-item-metadata.ts";
import { catalogReady } from "./state/catalog.ts";

// Import debug first so `window.DEBUG` is set before other modules run.
import { debugLog, getDebugParam } from "./utils/debug.js";

export { getDebugParam };

// Import canvas renderer
import * as canvasRenderer from "./canvas/renderer.js";

// Import palette recoloring
import {
  getRecolorStats,
  resetRecolorStats,
  setPaletteRecolorMode,
  getPaletteRecolorConfig,
} from "./canvas/palette-recolor.js";

// Expose palette recolor stats globally
window.getPaletteRecolorStats = () => {
  const stats = getRecolorStats();
  const total = stats.webgl + stats.cpu + stats.fallback;
  debugLog("📊 Palette Recolor Statistics:");
  debugLog(
    `  WebGL (GPU): ${stats.webgl} (${total ? ((stats.webgl / total) * 100).toFixed(1) : 0}%)`,
  );
  debugLog(
    `  CPU: ${stats.cpu} (${total ? ((stats.cpu / total) * 100).toFixed(1) : 0}%)`,
  );
  debugLog(
    `  Fallback: ${stats.fallback} (${total ? ((stats.fallback / total) * 100).toFixed(1) : 0}%)`,
  );
  debugLog(`  Total: ${total}`);
  return stats;
};
window.resetPaletteRecolorStats = resetRecolorStats;
window.setPaletteRecolorMode = setPaletteRecolorMode;
window.getPaletteRecolorConfig = getPaletteRecolorConfig;

// Import state management
import { initState, state } from "./state/state.ts";
import { initHashChangeListener } from "./state/hash.js";

// Import components
import { App } from "./components/App.js";
import { AnimationPreview } from "./components/preview/AnimationPreview.js";
import { FullSpritesheetPreview } from "./components/preview/FullSpritesheetPreview.js";

// Import performance profiler
import { PerformanceProfiler } from "./performance-profiler.js";

// DEBUG mode will be turned on if on localhost and off in production
// but this can be overridden by adding debug=(true|false) to the querystring.
export const DEBUG = getDebugParam();

// Initialize performance profiler (uses same DEBUG flag as console logging)
export const profiler = new PerformanceProfiler({
  enabled: DEBUG,
  verbose: false,
  logSlowOperations: true,
});

// Always expose profiler globally for manual control (window.DEBUG is set in utils/debug.js)
window.profiler = profiler;

// Expose canvas renderer to global scope for compatibility
window.canvasRenderer = canvasRenderer;

// Expose initialization function to be called after canvas is ready
window.setDefaultSelections = async function () {
  await initState();
};

// Start metadata chunk fetches as soon as the entry module runs (no DOM required),
// so download/parse overlaps HTML parse and the rest of this file.
void loadAllMetadata();

void import("./styles/load-deferred-styles.ts");

/** Commit 10 step 1: single-flight hash / init after index + lite are both registered. */
let hashHydrationInitDone = false;

// Wait for DOM to be ready, then mount UI; catalog may already be loading or ready.
document.addEventListener("DOMContentLoaded", () => {
  m.mount(document.getElementById("mithril-filters"), App);
  m.mount(document.getElementById("mithril-preview"), AnimationPreview);
  m.mount(
    document.getElementById("mithril-spritesheet-preview"),
    FullSpritesheetPreview,
  );

  clearShellLoadingClass();

  void (async () => {
    await Promise.all([catalogReady.onIndexReady, catalogReady.onLiteReady]);
    if (hashHydrationInitDone) return;
    hashHydrationInitDone = true;

    canvasRenderer.initCanvas();

    initHashChangeListener();

    // Before first render: overlay uses this; during render, `isRenderingCharacter` hides overlay.
    state.previewBootstrapRenderDone = true;

    if (window.setDefaultSelections) {
      await window.setDefaultSelections();
    }

    m.redraw();
  })();
});

/** Strips shell spinner from Mithril mount roots only (see index.html), not in-component spinners. */
const SHELL_LOADING_ROOT_IDS = [
  "mithril-filters",
  "mithril-preview",
  "mithril-spritesheet-preview",
];

function clearShellLoadingClass() {
  for (const id of SHELL_LOADING_ROOT_IDS) {
    document.getElementById(id)?.classList.remove("loading");
  }
}

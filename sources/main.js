// Main entry point - initializes and mounts the Mithril application

import "./vendor-globals.js";
import "./install-item-metadata.js";

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
import { initState } from "./state/state.js";
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

// Wait for DOM to be ready, then load Mithril app
document.addEventListener("DOMContentLoaded", async () => {
  clearLoadingIndicators();

  // Initialize offscreen canvas
  canvasRenderer.initCanvas();

  // Set defaults after canvas is ready
  if (window.setDefaultSelections) {
    await window.setDefaultSelections();
  }

  // Initialize hash change listener
  initHashChangeListener();

  // Mount the components
  m.mount(document.getElementById("mithril-filters"), App);
  m.mount(document.getElementById("mithril-preview"), AnimationPreview);
  m.mount(
    document.getElementById("mithril-spritesheet-preview"),
    FullSpritesheetPreview,
  );
});

function clearLoadingIndicators() {
  const loadingElements = document.querySelectorAll(".loading");
  for (const element of loadingElements) {
    element.classList.remove("loading");
  }
}

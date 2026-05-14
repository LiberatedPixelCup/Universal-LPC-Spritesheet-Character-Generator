// Main entry point - initializes and mounts the Mithril application

import m from "mithril";
import "./styles/critical-entry.scss";
import "./vendor-globals.ts";
import { loadAllMetadata } from "./install-item-metadata.ts";
import { catalogReady } from "./state/catalog.ts";

// Import debug first so `window.DEBUG` is set before other modules run.
import { debugLog, getDebugParam } from "./utils/debug.ts";

export { getDebugParam };

// Import canvas renderer
import * as canvasRenderer from "./canvas/renderer.ts";

// Import palette recoloring
import {
  getRecolorStats,
  resetRecolorStats,
  setPaletteRecolorMode,
  getPaletteRecolorConfig,
} from "./canvas/palette-recolor.ts";
import type {
  RecolorStats,
  RecolorMode,
  RecolorConfig,
} from "./canvas/palette-recolor.ts";

declare global {
  interface Window {
    /** Console-only diagnostic; logs and returns recolor pipeline stats. */
    getPaletteRecolorStats?: () => RecolorStats;
    /** Console-only diagnostic; resets the recolor stats counters. */
    resetPaletteRecolorStats?: () => void;
    /** Console-only; force the recolor mode. */
    setPaletteRecolorMode?: (mode: RecolorMode) => void;
    /** Console-only; reads current recolor config. */
    getPaletteRecolorConfig?: () => RecolorConfig;
    /** Set by main.ts after boot; awaited inside the DOMContentLoaded handler. */
    setDefaultSelections?: () => Promise<void>;
  }
}

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
import { initHashChangeListener } from "./state/hash.ts";

// Import components
import { App } from "./components/App.ts";
import { AnimationPreview } from "./components/preview/AnimationPreview.ts";
import { FullSpritesheetPreview } from "./components/preview/FullSpritesheetPreview.ts";

// Import performance profiler
import { PerformanceProfiler } from "./performance-profiler.ts";

// DEBUG mode will be turned on if on localhost and off in production
// but this can be overridden by adding debug=(true|false) to the querystring.
export const DEBUG = getDebugParam();

// Initialize performance profiler (uses same DEBUG flag as console logging)
export const profiler = new PerformanceProfiler({
  enabled: DEBUG,
  verbose: false,
  logSlowOperations: true,
});

// Always expose profiler globally for manual control (window.DEBUG is set in utils/debug.ts)
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

// TODO: this dynamic import doesn't actually load the deferred CSS in prod.
// `load-deferred-styles.ts` has no JS exports (only `import "./deferred-entry.scss"`),
// so after transpile the module body is empty; Rolldown collapses the dynamic
// `import()` to `Promise.resolve({})` and the CSS chunk never runs. The CSS file IS
// emitted to dist/ and registered in `__vite__mapDeps`, but this bundle's preload
// helper only handles `<link rel="modulepreload">` (JS), not `<link rel="stylesheet">`
// (CSS) — so the file sits there unloaded.
//
// We're currently surviving because every class used at runtime also lives in the
// critical CSS chunk (kept in sync by the PurgeCSS plugin scanning sources/). If a
// future class lands only in `deferred-entry.scss` consumers, it'll silently break.
//
// Fix sketch: delete `load-deferred-styles.ts` and replace this line with
//   import deferredCssHref from "./styles/deferred-entry.scss?url";
//   ...inject <link rel="stylesheet" href={deferredCssHref}> via requestIdleCallback.
// The `?url` import has a real binding so Rolldown can't optimize it away, and the
// manual link injection bypasses the missing CSS branch in the preload helper.
void import("./styles/load-deferred-styles.ts");

/** Commit 10 step 1: single-flight hash / init after index + lite are both registered. */
let hashHydrationInitDone = false;

// Wait for DOM to be ready, then mount UI; catalog may already be loading or ready.
document.addEventListener("DOMContentLoaded", () => {
  // Mount roots are static markup in index.html; assert non-null.
  m.mount(document.getElementById("mithril-filters")!, App);
  m.mount(document.getElementById("mithril-preview")!, AnimationPreview);
  m.mount(
    document.getElementById("mithril-spritesheet-preview")!,
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

function clearShellLoadingClass(): void {
  for (const id of SHELL_LOADING_ROOT_IDS) {
    document.getElementById(id)?.classList.remove("loading");
  }
}

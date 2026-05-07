import {
  debugLog,
  debugWarn,
  debugGroup,
  debugGroupEnd,
  debugTable,
} from "./utils/debug.js";

/**
 * Performance Profiler for LPC Spritesheet Generator
 *
 * - {@link PerformanceProfiler}: real-time monitoring (marks/measures, FPS) when enabled.
 * - {@link createZipExportProfiler}: phase timings for ZIP export (metadata.json + optional DEBUG table).
 *
 * Usage (global profiler):
 *   import { PerformanceProfiler } from './performance-profiler.ts';
 *   const profiler = new PerformanceProfiler({ enabled: true });
 *   profiler.mark('operation:start');
 *   profiler.mark('operation:end');
 *   profiler.measure('operation', 'operation:start', 'operation:end');
 *
 * Usage (ZIP export):
 *   import { createZipExportProfiler } from './performance-profiler.ts';
 *   const zipProfiler = createZipExportProfiler('splitAnimations');
 *   await zipProfiler.phase('drawAndSlice', async () => { ... });
 *   zipProfiler.syncPhase('render_composite_extractAnimationFromCanvas', () => { ... });
 *   zipProfiler.incrementCounter('pngEncodeCount');
 */

export type PerformanceProfilerOptions = {
  enabled?: boolean;
  logSlowOperations?: boolean;
  slowThresholdMs?: number;
  verbose?: boolean;
};

type MetricBucket = { count: number; totalTime: number };
type MetricsByCategory = {
  imageLoads: MetricBucket;
  draws: MetricBucket;
  previews: MetricBucket;
  domUpdates: MetricBucket;
};

/** Chrome-only `performance.memory`; absent in other browsers. */
type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
};

export class PerformanceProfiler {
  enabled: boolean;
  logSlowOperations: boolean;
  slowThresholdMs: number;
  verbose: boolean;

  metrics: MetricsByCategory;
  fpsFrames: number;
  fpsStartTime: number | null;
  currentFps: number;

  constructor(options: PerformanceProfilerOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.logSlowOperations = options.logSlowOperations !== false;
    this.slowThresholdMs = options.slowThresholdMs || 50;
    this.verbose = options.verbose || false;

    this.metrics = {
      imageLoads: { count: 0, totalTime: 0 },
      draws: { count: 0, totalTime: 0 },
      previews: { count: 0, totalTime: 0 },
      domUpdates: { count: 0, totalTime: 0 },
    };

    this.fpsFrames = 0;
    this.fpsStartTime = null;
    this.currentFps = 0;

    if (this.enabled) {
      this._initializeFPSMonitor();
      debugLog("📊 Performance Profiler enabled");
      debugLog('💡 Type "profiler.report()" in console for summary.');
    }
  }

  /** Enable profiler at runtime. */
  enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      this._initializeFPSMonitor();
      debugLog("📊 Performance Profiler enabled");
      debugLog('💡 Type "profiler.report()" in console for summary.');
    }
  }

  /** Disable profiler at runtime. */
  disable(): void {
    if (this.enabled) {
      this.enabled = false;
      debugLog("📊 Performance Profiler disabled");
    }
  }

  /** Create a performance mark (appears in DevTools timeline). */
  mark(name: string): void {
    if (!this.enabled) return;

    try {
      performance.mark(name);
      if (this.verbose) {
        debugLog(`🔵 Mark: ${name}`);
      }
    } catch (e) {
      debugWarn("Performance.mark failed:", e);
    }
  }

  /**
   * Measure time between two marks.
   * `renderCharacter` is bracketed only around compositing work (not dynamic-import latency).
   * `image-load:…` pairings require unique mark names; duplicate fetches of the same URL are
   * deduplicated in `load-image.ts` so one span per network load.
   */
  measure(
    measureName: string,
    startMark: string,
    endMark: string,
  ): number | null {
    if (!this.enabled) return null;

    try {
      performance.measure(measureName, startMark, endMark);

      const measures = performance.getEntriesByName(measureName, "measure");
      if (measures.length > 0) {
        const measure = measures[measures.length - 1];
        const duration = measure.duration;

        if (this.logSlowOperations && duration > this.slowThresholdMs) {
          debugWarn(
            `⚠️ Slow operation: ${measureName} took ${duration.toFixed(2)}ms`,
          );
        } else if (this.verbose) {
          debugLog(`⏱️ ${measureName}: ${duration.toFixed(2)}ms`);
        }

        this._trackMetric(measureName, duration);

        return duration;
      }
    } catch (e) {
      debugWarn("Performance.measure failed:", e);
    }

    return null;
  }

  /** Bucket a measurement into one of the named metric categories. */
  _trackMetric(name: string, duration: number): void {
    let category: keyof MetricsByCategory | null = null;
    if (name.includes("image") || name.includes("load")) {
      category = "imageLoads";
    } else if (name.includes("draw") || name.includes("render")) {
      category = "draws";
    } else if (name.includes("preview")) {
      category = "previews";
    } else if (
      name.includes("dom") ||
      name.includes("filter") ||
      name.includes("show")
    ) {
      category = "domUpdates";
    }

    if (category && this.metrics[category]) {
      this.metrics[category].count++;
      this.metrics[category].totalTime += duration;
    }
  }

  _initializeFPSMonitor(): void {
    this.fpsStartTime = performance.now();

    const countFrame = () => {
      this.fpsFrames++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);

    setInterval(() => {
      const now = performance.now();
      const elapsed = (now - (this.fpsStartTime ?? now)) / 1000;
      this.currentFps = Math.round(this.fpsFrames / elapsed);

      if (this.verbose) {
        const fpsEmoji =
          this.currentFps >= 55 ? "✅" : this.currentFps >= 30 ? "⚠️" : "❌";
        debugLog(`${fpsEmoji} FPS: ${this.currentFps}`);
      }

      this.fpsFrames = 0;
      this.fpsStartTime = now;
    }, 2000);
  }

  getFPS(): number {
    return this.currentFps;
  }

  /** Memory usage (Chrome only). */
  getMemoryUsage(): {
    usedJSHeapSize: string;
    totalJSHeapSize: string;
    jsHeapSizeLimit: string;
  } | null {
    const mem = (performance as PerformanceWithMemory).memory;
    if (mem) {
      return {
        usedJSHeapSize: (mem.usedJSHeapSize / 1048576).toFixed(2) + " MB",
        totalJSHeapSize: (mem.totalJSHeapSize / 1048576).toFixed(2) + " MB",
        jsHeapSizeLimit: (mem.jsHeapSizeLimit / 1048576).toFixed(2) + " MB",
      };
    }
    return null;
  }

  /** Print comprehensive performance report. */
  report(): void {
    if (!this.enabled) {
      debugLog("Performance profiler is disabled");
      return;
    }

    debugGroup("📊 Performance Report");

    debugGroup("⏱️ Timing Summary");
    for (const [category, data] of Object.entries(this.metrics)) {
      if (data.count > 0) {
        const avg = (data.totalTime / data.count).toFixed(2);
        debugLog(
          `${category}: ${data.count} ops, ${data.totalTime.toFixed(2)}ms total, ${avg}ms avg`,
        );
      }
    }
    debugGroupEnd();

    debugLog(`\n🎬 Current FPS: ${this.currentFps}`);

    const memory = this.getMemoryUsage();
    if (memory) {
      debugGroup("💾 Memory Usage");
      debugTable(memory);
      debugGroupEnd();
    }

    const allMeasures = performance.getEntriesByType("measure");
    if (allMeasures.length > 0) {
      debugGroup(`📏 All Measurements (${allMeasures.length} total)`);

      const sorted = allMeasures
        .map((m) => ({ name: m.name, duration: m.duration }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20);

      debugTable(
        sorted.map((m) => ({
          Operation: m.name,
          "Duration (ms)": m.duration.toFixed(2),
        })),
      );
      debugGroupEnd();
    }

    debugLog(
      "\n💡 Tip: Open DevTools → Performance tab and click Record to see visual timeline",
    );
    debugGroupEnd();
  }

  /** Clear all performance marks and measures. */
  clear(): void {
    if (!this.enabled) return;

    try {
      performance.clearMarks();
      performance.clearMeasures();
      this.metrics = {
        imageLoads: { count: 0, totalTime: 0 },
        draws: { count: 0, totalTime: 0 },
        previews: { count: 0, totalTime: 0 },
        domUpdates: { count: 0, totalTime: 0 },
      };
      debugLog("🧹 Performance data cleared");
    } catch (e) {
      debugWarn("Failed to clear performance data:", e);
    }
  }
}

function zipProfilerNowMs(): number {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function zipProfilerRoundMs(ms: number): number {
  return Math.round(ms * 10) / 10;
}

/** Default keys so ZIP profile JSON has a stable `counters` shape (zeros omitted until first increment). */
const ZIP_EXPORT_COUNTER_KEYS = [
  "pngEncodeCount",
  "totalPngBytes",
  "drawAndSliceCount",
  "zipFileEntryCount",
  "renderExtractAnimationFromCanvasCalls",
  "renderSingleItemCalls",
  "renderSingleItemAnimationCalls",
  "extractFramesFromAnimationBatchCount",
  "renderSliceCanvasForCustomAnimCalls",
] as const;

/** Snapshot shape returned by `ZipExportProfiler.toMetadata()`. */
export type ZipExportProfilerMetadata = {
  exportKind: string;
  /** Wall time for recorded phases only (typically everything except JSZip compression). */
  totalMs: number;
  phasesMs: Record<string, number>;
  counters: Record<string, number>;
  userAgent: string | undefined;
};

/**
 * Profiler instance returned by `createZipExportProfiler`. Pinned here so the
 * ZIP export consumer (zip.ts) and helpers (zip-helpers.ts) reuse the same
 * shape via a single import.
 */
export type ZipExportProfiler = {
  phase: (name: string, fn: () => void | Promise<void>) => Promise<void>;
  syncPhase: <T>(name: string, fn: () => T) => T;
  incrementCounter: (name: string, delta?: number) => void;
  addCounter: (name: string, amount: number) => void;
  toMetadata: () => ZipExportProfilerMetadata;
  logReport: () => void;
};

/** `window.DEBUG` is a project-specific runtime flag set by `utils/debug.js`. */
type WindowWithDebug = Window & { DEBUG?: boolean };

/**
 * High-resolution phase timings for ZIP export. Safe in tests (no User Timing
 * side effects unless DEBUG).
 *
 * @param exportKind e.g. `splitAnimations` (for logging / optional performance marks)
 */
export function createZipExportProfiler(exportKind: string): ZipExportProfiler {
  const t0 = zipProfilerNowMs();
  const phases: Record<string, number> = {};
  const counters: Record<string, number> = {};

  function userMark(suffix: string): void {
    if (
      typeof performance === "undefined" ||
      typeof performance.mark !== "function" ||
      typeof window === "undefined" ||
      !(window as WindowWithDebug).DEBUG
    ) {
      return;
    }
    try {
      performance.mark(`zip:${exportKind}:${suffix}`);
    } catch {
      /* ignore quota / duplicate mark */
    }
  }

  async function phase(
    name: string,
    fn: () => void | Promise<void>,
  ): Promise<void> {
    const start = zipProfilerNowMs();
    userMark(`${name}-start`);
    try {
      await fn();
    } finally {
      const elapsed = zipProfilerNowMs() - start;
      phases[name] = (phases[name] ?? 0) + elapsed;
      userMark(`${name}-end`);
    }
  }

  /** Like {@link phase} but for synchronous work (no `await` inside `fn`). */
  function syncPhase<T>(name: string, fn: () => T): T {
    const start = zipProfilerNowMs();
    userMark(`${name}-start`);
    try {
      return fn();
    } finally {
      const elapsed = zipProfilerNowMs() - start;
      phases[name] = (phases[name] ?? 0) + elapsed;
      userMark(`${name}-end`);
    }
  }

  function incrementCounter(name: string, delta: number = 1): void {
    counters[name] = (counters[name] ?? 0) + delta;
  }

  function addCounter(name: string, amount: number): void {
    counters[name] = (counters[name] ?? 0) + amount;
  }

  function totalMs(): number {
    return zipProfilerNowMs() - t0;
  }

  /**
   * Snapshot for metadata.json (deterministic rounding). Call before
   * `generateZip` so the zip does not embed compression time (avoids a
   * second `generateAsync`).
   */
  function toMetadata(): ZipExportProfilerMetadata {
    const phasesRounded: Record<string, number> = {};
    for (const [k, v] of Object.entries(phases)) {
      phasesRounded[k] = zipProfilerRoundMs(v);
    }
    const countersOut: Record<string, number> = {};
    for (const k of ZIP_EXPORT_COUNTER_KEYS) {
      countersOut[k] = 0;
    }
    for (const [k, v] of Object.entries(counters)) {
      countersOut[k] = Number.isInteger(v) ? v : zipProfilerRoundMs(v);
    }
    return {
      exportKind,
      totalMs: zipProfilerRoundMs(totalMs()),
      phasesMs: phasesRounded,
      counters: countersOut,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
  }

  /** Pretty console report when `window.DEBUG` is set. */
  function logReport(): void {
    if (typeof window === "undefined" || !(window as WindowWithDebug).DEBUG)
      return;
    const meta = toMetadata();
    debugGroup(`ZIP export profile: ${exportKind} (${meta.totalMs} ms total)`);
    const rows = Object.entries(meta.phasesMs).map(([phase, ms]) => ({
      phase,
      ms,
    }));
    rows.sort((a, b) => b.ms - a.ms);
    debugTable(rows);
    if (meta.counters && Object.keys(meta.counters).length > 0) {
      const cRows = Object.entries(meta.counters).map(([name, value]) => ({
        counter: name,
        value,
      }));
      cRows.sort((a, b) => a.counter.localeCompare(b.counter));
      debugTable(cRows);
    }
    debugGroupEnd();
  }

  return {
    phase,
    syncPhase,
    incrementCounter,
    addCounter,
    toMetadata,
    logReport,
  };
}

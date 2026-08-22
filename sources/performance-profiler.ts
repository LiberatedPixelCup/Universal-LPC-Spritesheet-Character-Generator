import {
  debugLog,
  debugWarn,
  debugGroup,
  debugGroupEnd,
  debugTable,
} from "./utils/debug.ts";

/**
 * Performance Profiler for LPC Spritesheet Generator
 *
 * - {@link PerformanceProfiler}: real-time monitoring (marks/measures, FPS) when enabled.
 * - {@link beginRenderCharacterSpan}: per-step timings for `runRenderCharacter`.
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

export type ProfilerMeasureRow = { name: string; durationMs: number };

/** Fixed phase keys for one `runRenderCharacter` call. */
export const RENDER_CHARACTER_PHASE_KEYS = [
  "mithrilRedrawStart",
  "buildDrawCalls",
  "sizeCanvas",
  "loadImages",
  "recolor",
  "draw",
  "customLoad",
  "customRecolor",
  "customDraw",
  "mithrilRedrawEnd",
] as const;

export type RenderCharacterPhaseName =
  (typeof RENDER_CHARACTER_PHASE_KEYS)[number];

export type RenderCharacterCounters = {
  drawCalls: number;
  selections: number;
  customAnims: number;
  canvasWidth: number;
  canvasHeight: number;
  imageCacheHits: number;
  imageLoads: number;
  recolorSkipped: number;
  recolorCacheHits: number;
  recolorMisses: number;
};

export type RenderCharacterPhaseReport = {
  totalMs: number;
  phasesMs: Record<RenderCharacterPhaseName, number>;
  unaccountedMs: number;
  counters: RenderCharacterCounters;
};

export type RenderCharacterSnapshot = {
  calls: RenderCharacterPhaseReport[];
};

/** Duck-typed host so `renderer.ts` can pass `window.profiler`. */
export type RenderCharacterProfilerHost = {
  enabled: boolean;
  recordRenderCharacterCall: (report: RenderCharacterPhaseReport) => void;
};

export type RenderCharacterSpan = {
  sync: <T>(name: RenderCharacterPhaseName, fn: () => T) => T;
  async: <T>(
    name: RenderCharacterPhaseName,
    fn: () => T | Promise<T>,
  ) => Promise<T>;
  addPhaseMs: (name: RenderCharacterPhaseName, ms: number) => void;
  setCounter: (name: keyof RenderCharacterCounters, value: number) => void;
  finish: () => RenderCharacterPhaseReport | null;
};

/** Machine-readable form of {@link PerformanceProfiler.report}. */
export type ProfilerSnapshot = {
  enabled: boolean;
  fps: number;
  metrics: MetricsByCategory;
  memory: {
    usedJSHeapSize: string;
    totalJSHeapSize: string;
    jsHeapSizeLimit: string;
  } | null;
  measures: ProfilerMeasureRow[];
  renderCharacter: RenderCharacterSnapshot;
};

function emptyMetrics(): MetricsByCategory {
  return {
    imageLoads: { count: 0, totalTime: 0 },
    draws: { count: 0, totalTime: 0 },
    previews: { count: 0, totalTime: 0 },
    domUpdates: { count: 0, totalTime: 0 },
  };
}

function emptyRenderCharacterPhases(): Record<
  RenderCharacterPhaseName,
  number
> {
  return {
    mithrilRedrawStart: 0,
    buildDrawCalls: 0,
    sizeCanvas: 0,
    loadImages: 0,
    recolor: 0,
    draw: 0,
    customLoad: 0,
    customRecolor: 0,
    customDraw: 0,
    mithrilRedrawEnd: 0,
  };
}

function emptyRenderCharacterCounters(): RenderCharacterCounters {
  return {
    drawCalls: 0,
    selections: 0,
    customAnims: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    imageCacheHits: 0,
    imageLoads: 0,
    recolorSkipped: 0,
    recolorCacheHits: 0,
    recolorMisses: 0,
  };
}

function emptyRenderCharacterSnapshot(): RenderCharacterSnapshot {
  return { calls: [] };
}

function copyRenderCharacterReport(
  report: RenderCharacterPhaseReport,
): RenderCharacterPhaseReport {
  return {
    totalMs: report.totalMs,
    unaccountedMs: report.unaccountedMs,
    phasesMs: { ...report.phasesMs },
    counters: { ...report.counters },
  };
}

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
  renderCharacterCalls: RenderCharacterPhaseReport[];

  constructor(options: PerformanceProfilerOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.logSlowOperations = options.logSlowOperations !== false;
    this.slowThresholdMs = options.slowThresholdMs || 50;
    this.verbose = options.verbose || false;

    this.metrics = emptyMetrics();
    this.renderCharacterCalls = [];

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

  /**
   * Same data as {@link report}, without console I/O. Used by the headless
   * app profiler (`scripts/profile/app-profile.ts`) and by `copy(JSON.stringify(profiler.snapshot()))`.
   */
  snapshot(): ProfilerSnapshot {
    if (!this.enabled) {
      return {
        enabled: false,
        fps: 0,
        metrics: emptyMetrics(),
        memory: null,
        measures: [],
        renderCharacter: emptyRenderCharacterSnapshot(),
      };
    }

    const measures = performance
      .getEntriesByType("measure")
      .map((m) => ({ name: m.name, durationMs: m.duration }))
      .sort((a, b) => b.durationMs - a.durationMs);

    return {
      enabled: true,
      fps: this.currentFps,
      metrics: {
        imageLoads: { ...this.metrics.imageLoads },
        draws: { ...this.metrics.draws },
        previews: { ...this.metrics.previews },
        domUpdates: { ...this.metrics.domUpdates },
      },
      memory: this.getMemoryUsage(),
      measures,
      renderCharacter: {
        calls: this.renderCharacterCalls.map(copyRenderCharacterReport),
      },
    };
  }

  /** Print comprehensive performance report. */
  report(): void {
    if (!this.enabled) {
      debugLog("Performance profiler is disabled");
      return;
    }

    const snap = this.snapshot();

    debugGroup("📊 Performance Report");

    debugGroup("⏱️ Timing Summary");
    for (const [category, data] of Object.entries(snap.metrics)) {
      if (data.count > 0) {
        const avg = (data.totalTime / data.count).toFixed(2);
        debugLog(
          `${category}: ${data.count} ops, ${data.totalTime.toFixed(2)}ms total, ${avg}ms avg`,
        );
      }
    }
    debugGroupEnd();

    debugLog(`\n🎬 Current FPS: ${snap.fps}`);

    if (snap.memory) {
      debugGroup("💾 Memory Usage");
      debugTable(snap.memory);
      debugGroupEnd();
    }

    if (snap.measures.length > 0) {
      debugGroup(`📏 All Measurements (${snap.measures.length} total)`);

      debugTable(
        snap.measures.slice(0, 20).map((m) => ({
          Operation: m.name,
          "Duration (ms)": m.durationMs.toFixed(2),
        })),
      );
      debugGroupEnd();
    }

    const rcCalls = snap.renderCharacter.calls;
    if (rcCalls.length > 0) {
      debugGroup(`🎨 renderCharacter phases (${rcCalls.length} calls)`);
      for (let i = 0; i < rcCalls.length; i++) {
        const call = rcCalls[i];
        debugGroup(
          `call ${i} (${call.totalMs} ms total, ${call.unaccountedMs} ms unaccounted)`,
        );
        const rows = RENDER_CHARACTER_PHASE_KEYS.map((phase) => ({
          phase,
          ms: call.phasesMs[phase],
        }));
        rows.sort((a, b) => b.ms - a.ms);
        debugTable(rows);
        debugTable(call.counters);
        debugGroupEnd();
      }
      debugGroupEnd();
    }

    debugLog(
      "\n💡 Tip: Open DevTools → Performance tab and click Record to see visual timeline",
    );
    debugGroupEnd();
  }

  /** Append one completed `runRenderCharacter` phase report. */
  recordRenderCharacterCall(report: RenderCharacterPhaseReport): void {
    if (!this.enabled) return;
    this.renderCharacterCalls.push(copyRenderCharacterReport(report));
  }

  /** Clear all performance marks and measures. */
  clear(): void {
    this.renderCharacterCalls = [];
    if (!this.enabled) return;

    try {
      performance.clearMarks();
      performance.clearMeasures();
      this.metrics = emptyMetrics();
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

function roundRenderCharacterPhases(
  phases: Record<RenderCharacterPhaseName, number>,
): Record<RenderCharacterPhaseName, number> {
  const out = emptyRenderCharacterPhases();
  for (const key of RENDER_CHARACTER_PHASE_KEYS) {
    out[key] = zipProfilerRoundMs(phases[key]);
  }
  return out;
}

/**
 * Per-`runRenderCharacter` phase timer. When `profiler` is missing or
 * disabled, `sync` / `async` just run `fn()` (no User Timing, no publish).
 * Sub-phases are not fed through {@link PerformanceProfiler.measure}.
 */
export function beginRenderCharacterSpan(
  profiler?: Partial<RenderCharacterProfilerHost> | null,
): RenderCharacterSpan {
  const record = profiler?.recordRenderCharacterCall?.bind(profiler);
  const enabled = Boolean(profiler?.enabled && typeof record === "function");
  const t0 = zipProfilerNowMs();
  const phases = emptyRenderCharacterPhases();
  const counters = emptyRenderCharacterCounters();

  function userMark(
    name: RenderCharacterPhaseName,
    kind: "start" | "end",
  ): void {
    if (!enabled || typeof performance === "undefined") return;
    try {
      performance.mark(`rc:${name}-${kind}`);
    } catch {
      /* ignore quota / duplicate mark */
    }
  }

  function sync<T>(name: RenderCharacterPhaseName, fn: () => T): T {
    if (!enabled) return fn();
    userMark(name, "start");
    const start = zipProfilerNowMs();
    try {
      return fn();
    } finally {
      phases[name] += zipProfilerNowMs() - start;
      userMark(name, "end");
    }
  }

  async function asyncPhase<T>(
    name: RenderCharacterPhaseName,
    fn: () => T | Promise<T>,
  ): Promise<T> {
    if (!enabled) return await fn();
    userMark(name, "start");
    const start = zipProfilerNowMs();
    try {
      return await fn();
    } finally {
      phases[name] += zipProfilerNowMs() - start;
      userMark(name, "end");
    }
  }

  function addPhaseMs(name: RenderCharacterPhaseName, ms: number): void {
    if (!enabled) return;
    phases[name] += ms;
  }

  function setCounter(
    name: keyof RenderCharacterCounters,
    value: number,
  ): void {
    if (!enabled) return;
    counters[name] = value;
  }

  function finish(): RenderCharacterPhaseReport | null {
    if (!enabled || typeof record !== "function") return null;
    let phaseSum = 0;
    for (const key of RENDER_CHARACTER_PHASE_KEYS) {
      phaseSum += phases[key];
    }
    const totalMs = zipProfilerNowMs() - t0;
    const report: RenderCharacterPhaseReport = {
      totalMs: zipProfilerRoundMs(totalMs),
      phasesMs: roundRenderCharacterPhases(phases),
      unaccountedMs: zipProfilerRoundMs(totalMs - phaseSum),
      counters: { ...counters },
    };
    record(report);
    return report;
  }

  return {
    sync,
    async: asyncPhase,
    addPhaseMs,
    setCounter,
    finish,
  };
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
      !window.DEBUG
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
    if (typeof window === "undefined" || !window.DEBUG) return;
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

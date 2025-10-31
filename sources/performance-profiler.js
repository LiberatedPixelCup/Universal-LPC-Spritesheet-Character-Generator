/**
 * Performance Profiler for LPC Spritesheet Generator
 *
 * Provides real-time performance monitoring using browser Performance API.
 * All measurements appear in Chrome DevTools Performance tab as User Timing marks.
 *
 * Usage:
 *   import { PerformanceProfiler } from './performance-profiler.js';
 *   const profiler = new PerformanceProfiler({ enabled: true });
 *   profiler.mark('operation:start');
 *   // ... do work ...
 *   profiler.mark('operation:end');
 *   profiler.measure('operation', 'operation:start', 'operation:end');
 */

export class PerformanceProfiler {
  constructor(options = {}) {
    this.enabled = options.enabled ?? false; // Default: disabled
    this.logSlowOperations = options.logSlowOperations !== false;
    this.slowThresholdMs = options.slowThresholdMs || 50;
    this.verbose = options.verbose || false;

    // Track metrics
    this.metrics = {
      imageLoads: { count: 0, totalTime: 0 },
      draws: { count: 0, totalTime: 0 },
      previews: { count: 0, totalTime: 0 },
      domUpdates: { count: 0, totalTime: 0 }
    };

    // FPS monitoring
    this.fpsFrames = 0;
    this.fpsStartTime = null;
    this.currentFps = 0;

    if (this.enabled) {
      this._initializeFPSMonitor();
      console.log('📊 Performance Profiler enabled');
      console.log('💡 Type "profiler.report()" in console for summary.');
    }
  }

  /**
   * Enable profiler at runtime
   */
  enable() {
    if (!this.enabled) {
      this.enabled = true;
      this._initializeFPSMonitor();
      console.log('📊 Performance Profiler enabled');
      console.log('💡 Type "profiler.report()" in console for summary.');
    }
  }

  /**
   * Disable profiler at runtime
   */
  disable() {
    if (this.enabled) {
      this.enabled = false;
      console.log('📊 Performance Profiler disabled');
    }
  }

  /**
   * Create a performance mark (appears in DevTools timeline)
   */
  mark(name) {
    if (!this.enabled) return;

    try {
      performance.mark(name);
      if (this.verbose) {
        console.log(`🔵 Mark: ${name}`);
      }
    } catch (e) {
      console.warn('Performance.mark failed:', e);
    }
  }

  /**
   * Measure time between two marks
   */
  measure(measureName, startMark, endMark) {
    if (!this.enabled) return null;

    try {
      performance.measure(measureName, startMark, endMark);

      // Get the measurement
      const measures = performance.getEntriesByName(measureName, 'measure');
      if (measures.length > 0) {
        const measure = measures[measures.length - 1];
        const duration = measure.duration;

        // Log slow operations
        if (this.logSlowOperations && duration > this.slowThresholdMs) {
          console.warn(`⚠️ Slow operation: ${measureName} took ${duration.toFixed(2)}ms`);
        } else if (this.verbose) {
          console.log(`⏱️ ${measureName}: ${duration.toFixed(2)}ms`);
        }

        // Track in metrics
        this._trackMetric(measureName, duration);

        return duration;
      }
    } catch (e) {
      console.warn('Performance.measure failed:', e);
    }

    return null;
  }

  /**
   * Track metric by category
   */
  _trackMetric(name, duration) {
    // Categorize the metric
    let category = null;
    if (name.includes('image') || name.includes('load')) {
      category = 'imageLoads';
    } else if (name.includes('draw') || name.includes('render')) {
      category = 'draws';
    } else if (name.includes('preview')) {
      category = 'previews';
    } else if (name.includes('dom') || name.includes('filter') || name.includes('show')) {
      category = 'domUpdates';
    }

    if (category && this.metrics[category]) {
      this.metrics[category].count++;
      this.metrics[category].totalTime += duration;
    }
  }


  /**
   * Initialize FPS monitoring
   */
  _initializeFPSMonitor() {
    this.fpsStartTime = performance.now();

    const countFrame = () => {
      this.fpsFrames++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);

    // Report FPS every 2 seconds
    setInterval(() => {
      const now = performance.now();
      const elapsed = (now - this.fpsStartTime) / 1000;
      this.currentFps = Math.round(this.fpsFrames / elapsed);

      if (this.verbose) {
        const fpsEmoji = this.currentFps >= 55 ? '✅' : this.currentFps >= 30 ? '⚠️' : '❌';
        console.log(`${fpsEmoji} FPS: ${this.currentFps}`);
      }

      // Reset
      this.fpsFrames = 0;
      this.fpsStartTime = now;
    }, 2000);
  }

  /**
   * Get current FPS
   */
  getFPS() {
    return this.currentFps;
  }

  /**
   * Get memory usage (Chrome only)
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
        totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
        jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
      };
    }
    return null;
  }

  /**
   * Print comprehensive performance report
   */
  report() {
    if (!this.enabled) {
      console.log('Performance profiler is disabled');
      return;
    }

    console.group('📊 Performance Report');

    // Summary by category
    console.group('⏱️ Timing Summary');
    for (const [category, data] of Object.entries(this.metrics)) {
      if (data.count > 0) {
        const avg = (data.totalTime / data.count).toFixed(2);
        console.log(`${category}: ${data.count} ops, ${data.totalTime.toFixed(2)}ms total, ${avg}ms avg`);
      }
    }
    console.groupEnd();

    // FPS
    console.log(`\n🎬 Current FPS: ${this.currentFps}`);

    // Memory (Chrome only)
    const memory = this.getMemoryUsage();
    if (memory) {
      console.group('💾 Memory Usage');
      console.table(memory);
      console.groupEnd();
    }

    // All measures
    const allMeasures = performance.getEntriesByType('measure');
    if (allMeasures.length > 0) {
      console.group(`📏 All Measurements (${allMeasures.length} total)`);

      // Sort by duration
      const sorted = allMeasures
        .map(m => ({ name: m.name, duration: m.duration }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 20); // Top 20

      console.table(sorted.map(m => ({
        'Operation': m.name,
        'Duration (ms)': m.duration.toFixed(2)
      })));
      console.groupEnd();
    }

    console.log('\n💡 Tip: Open DevTools → Performance tab and click Record to see visual timeline');
    console.groupEnd();
  }

  /**
   * Clear all performance marks and measures
   */
  clear() {
    if (!this.enabled) return;

    try {
      performance.clearMarks();
      performance.clearMeasures();
      this.metrics = {
        imageLoads: { count: 0, totalTime: 0 },
        draws: { count: 0, totalTime: 0 },
        previews: { count: 0, totalTime: 0 },
        domUpdates: { count: 0, totalTime: 0 }
      };
      console.log('🧹 Performance data cleared');
    } catch (e) {
      console.warn('Failed to clear performance data:', e);
    }
  }
}

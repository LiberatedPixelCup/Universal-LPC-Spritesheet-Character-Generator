import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "vitest";
import {
  PerformanceProfiler,
  createZipExportProfiler,
} from "../sources/performance-profiler.js";

/** Deterministic work so phase timings are non-zero without relying on setTimeout (throttled in some browsers). */
function cpuWork(iterations = 400_000) {
  let x = 0;
  for (let i = 0; i < iterations; i++) x += i;
  return x;
}

describe("performance-profiler.js", () => {
  describe("PerformanceProfiler", () => {
    it("is disabled by default and does not create marks", () => {
      const before = performance.getEntriesByType("mark").length;
      const p = new PerformanceProfiler();
      p.mark("zip_test_mark_should_not_exist");
      const after = performance.getEntriesByType("mark").length;
      expect(p.enabled).to.be.false;
      expect(after).to.equal(before);
    });

    it("returns null from measure when disabled", () => {
      const p = new PerformanceProfiler({ enabled: false });
      p.mark("a");
      p.mark("b");
      expect(p.measure("m", "a", "b")).to.equal(null);
    });

    it("report() is a no-op when disabled (does not throw)", () => {
      const p = new PerformanceProfiler({ enabled: false });
      expect(() => p.report()).to.not.throw();
    });
  });

  describe("PerformanceProfiler (enabled)", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(globalThis, "requestAnimationFrame").returns(1);
      sandbox.stub(globalThis, "setInterval").returns(999);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("mark and measure record duration between two marks", () => {
      const p = new PerformanceProfiler({ enabled: true });
      p.mark("op:start");
      p.mark("op:end");
      const duration = p.measure("draw_render_measure", "op:start", "op:end");
      expect(duration).to.be.a("number");
      expect(duration).to.be.at.least(0);
    });

    it("measure() increments categorized metrics for draw-related names", () => {
      const p = new PerformanceProfiler({ enabled: true });
      p.mark("d1");
      p.mark("d2");
      p.measure("draw_something", "d1", "d2");
      expect(p.metrics.draws.count).to.equal(1);
      expect(p.metrics.draws.totalTime).to.be.at.least(0);
    });

    it("clear() resets metrics and clears User Timing entries", () => {
      const p = new PerformanceProfiler({ enabled: true });
      p.mark("c1");
      p.mark("c2");
      p.measure("draw_clear", "c1", "c2");
      expect(p.metrics.draws.count).to.be.at.least(1);
      p.clear();
      expect(p.metrics.draws.count).to.equal(0);
      expect(p.metrics.draws.totalTime).to.equal(0);
    });

    it("disable() sets enabled to false", () => {
      const p = new PerformanceProfiler({ enabled: true });
      expect(p.enabled).to.be.true;
      p.disable();
      expect(p.enabled).to.be.false;
    });
  });

  describe("createZipExportProfiler", () => {
    it("records phase durations and exportKind in toMetadata()", async () => {
      const z = createZipExportProfiler("splitAnimations");
      await z.phase("alpha", async () => {
        cpuWork();
      });
      await z.phase("beta", async () => {
        cpuWork();
      });
      const meta = z.toMetadata();
      expect(meta.exportKind).to.equal("splitAnimations");
      expect(meta.phasesMs.alpha).to.be.at.least(0);
      expect(meta.phasesMs.beta).to.be.at.least(0);
      expect(meta.counters).to.be.an("object");
      expect(meta.totalMs).to.be.at.least(
        meta.phasesMs.alpha + meta.phasesMs.beta - 0.1,
      );
      if (typeof navigator !== "undefined") {
        expect(meta.userAgent).to.equal(navigator.userAgent);
      }
    });

    it("sums repeated phase names", async () => {
      // Enough work that phase durations survive ms rounding; one profiler so we
      // compare accumulated "same" vs a single block (two instances can both
      // round to the same phasesMs when timers are coarse).
      const heavy = 6_000_000;
      const z = createZipExportProfiler("accum");
      await z.phase("same", async () => {
        cpuWork(heavy);
      });
      const afterFirst = z.toMetadata().phasesMs.same;
      await z.phase("same", async () => {
        cpuWork(heavy);
      });
      const afterBoth = z.toMetadata().phasesMs.same;

      expect(afterFirst).to.be.greaterThan(0);
      expect(afterBoth).to.be.greaterThan(afterFirst);
    });

    it("logReport() does nothing when window.DEBUG is false", async () => {
      const prev = window.DEBUG;
      window.DEBUG = false;
      const z = createZipExportProfiler("x");
      await z.phase("p", async () => {});
      const groupSpy = sinon.spy(console, "group");
      try {
        z.logReport();
        expect(groupSpy.called).to.be.false;
      } finally {
        groupSpy.restore();
        window.DEBUG = prev;
      }
    });

    it("syncPhase and counters accumulate into toMetadata()", () => {
      const z = createZipExportProfiler("splitAnimations");
      z.syncPhase("render_composite_extractAnimationFromCanvas", () => {
        cpuWork(200_000);
      });
      z.incrementCounter("pngEncodeCount", 2);
      z.addCounter("totalPngBytes", 100);
      const meta = z.toMetadata();
      expect(
        meta.phasesMs.render_composite_extractAnimationFromCanvas,
      ).to.be.at.least(0);
      expect(meta.counters.pngEncodeCount).to.equal(2);
      expect(meta.counters.totalPngBytes).to.equal(100);
    });

    it("logReport() groups and tables when window.DEBUG is true", async () => {
      const prev = window.DEBUG;
      window.DEBUG = true;
      const z = createZipExportProfiler("y");
      await z.phase("p", async () => {});
      const groupSpy = sinon.spy(console, "group");
      const tableSpy = sinon.spy(console, "table");
      const groupEndSpy = sinon.spy(console, "groupEnd");
      try {
        z.logReport();
        expect(groupSpy.called).to.be.true;
        expect(tableSpy.called).to.be.true;
        expect(groupEndSpy.called).to.be.true;
      } finally {
        groupSpy.restore();
        tableSpy.restore();
        groupEndSpy.restore();
        window.DEBUG = prev;
      }
    });
  });
});

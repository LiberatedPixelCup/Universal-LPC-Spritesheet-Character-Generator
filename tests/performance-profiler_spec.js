import { expect } from "chai";
import sinon from "sinon";
import { describe, it, beforeEach, afterEach } from "mocha-globals";
import {
  PerformanceProfiler,
  beginRenderCharacterSpan,
  RENDER_CHARACTER_PHASE_KEYS,
  createZipExportProfiler,
} from "../sources/performance-profiler.ts";

/** Deterministic work so phase timings are non-zero without relying on setTimeout (throttled in some browsers). */
function cpuWork(iterations = 400_000) {
  let x = 0;
  for (let i = 0; i < iterations; i++) x += i;
  return x;
}

describe("performance-profiler.ts", () => {
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

    it("snapshot() is empty when disabled", () => {
      const p = new PerformanceProfiler({ enabled: false });
      const snap = p.snapshot();
      expect(snap.enabled).to.be.false;
      expect(snap.fps).to.equal(0);
      expect(snap.measures).to.deep.equal([]);
      expect(snap.renderCharacter.calls).to.deep.equal([]);
      expect(snap.metrics.draws.count).to.equal(0);
      expect(snap.memory).to.equal(null);
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

    it("snapshot() copies metrics and User Timing measures", () => {
      const p = new PerformanceProfiler({ enabled: true });
      p.mark("snap:start");
      p.mark("snap:end");
      p.measure("draw_snapshot", "snap:start", "snap:end");
      const snap = p.snapshot();
      expect(snap.enabled).to.be.true;
      expect(snap.metrics.draws.count).to.equal(1);
      expect(snap.measures.some((m) => m.name === "draw_snapshot")).to.be.true;
      expect(snap.renderCharacter.calls).to.deep.equal([]);
      snap.metrics.draws.count = 99;
      expect(p.metrics.draws.count).to.equal(1);
    });

    it("clear() drops renderCharacter calls", () => {
      const p = new PerformanceProfiler({ enabled: true });
      const span = beginRenderCharacterSpan(p);
      span.sync("buildDrawCalls", () => cpuWork(50_000));
      span.finish();
      expect(p.snapshot().renderCharacter.calls).to.have.length(1);
      p.clear();
      expect(p.snapshot().renderCharacter.calls).to.deep.equal([]);
    });
  });

  describe("beginRenderCharacterSpan", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(globalThis, "requestAnimationFrame").returns(1);
      sandbox.stub(globalThis, "setInterval").returns(999);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("records phases, counters, and unaccountedMs when enabled", async () => {
      const p = new PerformanceProfiler({ enabled: true });
      const span = beginRenderCharacterSpan(p);
      span.sync("mithrilRedrawStart", () => cpuWork(80_000));
      span.sync("buildDrawCalls", () => cpuWork(80_000));
      await span.async("loadImages", async () => {
        cpuWork(80_000);
      });
      span.addPhaseMs("recolor", 1.25);
      span.addPhaseMs("draw", 0.5);
      span.setCounter("drawCalls", 12);
      span.setCounter("selections", 3);
      const report = span.finish();
      expect(report).to.not.equal(null);
      expect(report.phasesMs.buildDrawCalls).to.be.at.least(0);
      expect(report.phasesMs.loadImages).to.be.at.least(0);
      expect(report.phasesMs.recolor).to.be.at.least(1.2);
      expect(report.phasesMs.draw).to.be.at.least(0.5);
      expect(report.counters.drawCalls).to.equal(12);
      expect(report.counters.selections).to.equal(3);
      expect(report.totalMs).to.be.at.least(report.phasesMs.buildDrawCalls);
      expect(report.unaccountedMs).to.be.a("number");
      for (const key of RENDER_CHARACTER_PHASE_KEYS) {
        expect(report.phasesMs).to.have.property(key);
      }
      const snap = p.snapshot();
      expect(snap.renderCharacter.calls).to.have.length(1);
      expect(snap.renderCharacter.calls[0].counters.drawCalls).to.equal(12);
      snap.renderCharacter.calls[0].counters.drawCalls = 99;
      expect(p.snapshot().renderCharacter.calls[0].counters.drawCalls).to.equal(
        12,
      );
    });

    it("runs fn and does not publish when profiler is missing or disabled", () => {
      let ran = 0;
      const missing = beginRenderCharacterSpan();
      missing.sync("buildDrawCalls", () => {
        ran++;
      });
      expect(missing.finish()).to.equal(null);

      const p = new PerformanceProfiler({ enabled: false });
      const disabled = beginRenderCharacterSpan(p);
      disabled.sync("draw", () => {
        ran++;
      });
      disabled.addPhaseMs("recolor", 10);
      disabled.setCounter("drawCalls", 5);
      expect(disabled.finish()).to.equal(null);
      expect(p.snapshot().renderCharacter.calls).to.deep.equal([]);
      expect(ran).to.equal(2);
    });

    it("report() includes renderCharacter phase tables when calls exist", () => {
      const p = new PerformanceProfiler({ enabled: true });
      const span = beginRenderCharacterSpan(p);
      span.sync("draw", () => cpuWork(20_000));
      span.finish();
      expect(() => p.report()).to.not.throw();
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

/**
 * Compare two app-profile JSON files (from `app-profile.ts` or `profile:app`).
 *
 * Usage:
 *   node scripts/profile/diff-app-profile.ts <before.json> <after.json>
 *   node scripts/profile/diff-app-profile.ts --before tmp/baseline.json --after tmp/current.json
 *
 * Prints per-recolor-mode metric and measure deltas (after − before).
 * Positive Δ means slower. Exit code 0 always (reporting tool).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RENDER_CHARACTER_PHASE_KEYS,
  type ProfilerSnapshot,
  type RenderCharacterCounters,
  type RenderCharacterPhaseReport,
} from "../../sources/performance-profiler.ts";
import {
  rendererLabel,
  type AppProfileFile,
  type AppProfileModeResult,
  type AppProfileRecolorMode,
} from "./app-profile.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

type LegacyAppProfileFile = AppProfileFile & {
  profiler?: ProfilerSnapshot;
};

type MeasureAgg = { count: number; totalMs: number; maxMs: number };

function parseArgs(argv: string[]): { beforePath: string; afterPath: string } {
  const args = argv.slice(2);
  const bi = args.indexOf("--before");
  const ai = args.indexOf("--after");
  let beforePath: string | undefined;
  let afterPath: string | undefined;
  const beforeArg = args[bi + 1];
  const afterArg = args[ai + 1];
  if (bi !== -1 && beforeArg && ai !== -1 && afterArg) {
    beforePath = path.resolve(REPO_ROOT, beforeArg);
    afterPath = path.resolve(REPO_ROOT, afterArg);
  } else if (
    args.length >= 2 &&
    args[0] &&
    args[1] &&
    !args[0].startsWith("-")
  ) {
    beforePath = path.resolve(REPO_ROOT, args[0]);
    afterPath = path.resolve(REPO_ROOT, args[1]);
  } else {
    throw new Error(
      "Usage: diff-app-profile.ts <before.json> <after.json>\n" +
        "   or: diff-app-profile.ts --before <before.json> --after <after.json>",
    );
  }
  return { beforePath, afterPath };
}

function loadProfile(p: string): LegacyAppProfileFile {
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as LegacyAppProfileFile;
}

function modesOf(file: LegacyAppProfileFile): AppProfileRecolorMode[] {
  if (file.profiles && Object.keys(file.profiles).length > 0) {
    return (["webgl", "cpu"] as const).filter((m) => file.profiles[m]);
  }
  if (file.profiler) return ["webgl"];
  return [];
}

function modeResult(
  file: LegacyAppProfileFile,
  mode: AppProfileRecolorMode,
): AppProfileModeResult | undefined {
  const fromProfiles = file.profiles?.[mode];
  if (fromProfiles) return fromProfiles;
  if (mode === "webgl" && file.profiler) {
    return {
      requestedMode: "webgl",
      activeMode: "webgl",
      recolorStats: { webgl: 0, cpu: 0, fallback: 0 },
      profiler: file.profiler,
    };
  }
  return undefined;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function fmt(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) {
    return "—";
  }
  return String(round1(n));
}

function aggregateMeasures(
  measures: { name: string; durationMs: number }[] | undefined,
): Map<string, MeasureAgg> {
  const out = new Map<string, MeasureAgg>();
  for (const m of measures ?? []) {
    const prev = out.get(m.name);
    if (!prev) {
      out.set(m.name, { count: 1, totalMs: m.durationMs, maxMs: m.durationMs });
    } else {
      prev.count += 1;
      prev.totalMs += m.durationMs;
      prev.maxMs = Math.max(prev.maxMs, m.durationMs);
    }
  }
  return out;
}

function pad(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - s.length));
}

function diffSnapshots(
  lines: string[],
  pb: ProfilerSnapshot,
  pa: ProfilerSnapshot,
): void {
  lines.push(`  fps: ${fmt(pb.fps)} → ${fmt(pa.fps)}`);
  lines.push("");
  lines.push("── metrics ──");

  const cats = new Set([
    ...Object.keys(pb.metrics ?? {}),
    ...Object.keys(pa.metrics ?? {}),
  ]);
  for (const cat of [...cats].sort()) {
    const b = pb.metrics?.[cat as keyof typeof pb.metrics];
    const a = pa.metrics?.[cat as keyof typeof pa.metrics];
    const dCount = (a?.count ?? 0) - (b?.count ?? 0);
    const dTotal = (a?.totalTime ?? 0) - (b?.totalTime ?? 0);
    const avgB = b && b.count > 0 ? b.totalTime / b.count : undefined;
    const avgA = a && a.count > 0 ? a.totalTime / a.count : undefined;
    const dAvg = (avgA ?? 0) - (avgB ?? 0);
    lines.push(
      `  ${cat}: count ${fmt(b?.count)} → ${fmt(a?.count)} (Δ ${dCount >= 0 ? "+" : ""}${fmt(dCount)})` +
        `  total ${fmt(b?.totalTime)} → ${fmt(a?.totalTime)} (Δ ${dTotal >= 0 ? "+" : ""}${fmt(dTotal)})` +
        `  avg ${fmt(avgB)} → ${fmt(avgA)} (Δ ${dAvg >= 0 ? "+" : ""}${fmt(dAvg)})`,
    );
  }
  lines.push("");

  const mb = aggregateMeasures(pb.measures);
  const ma = aggregateMeasures(pa.measures);
  const names = new Set([...mb.keys(), ...ma.keys()]);

  function sumPrefix(map: Map<string, MeasureAgg>, prefix: string): MeasureAgg {
    const acc: MeasureAgg = { count: 0, totalMs: 0, maxMs: 0 };
    for (const [name, v] of map) {
      if (!name.startsWith(prefix)) continue;
      acc.count += v.count;
      acc.totalMs += v.totalMs;
      acc.maxMs = Math.max(acc.maxMs, v.maxMs);
    }
    return acc;
  }

  const pinned = [
    "renderCharacter",
    "hash-loadSelectionsFromHash",
    "hash-loadSelectionsFromHash:subitems",
  ];
  const display = new Map<
    string,
    { before?: MeasureAgg; after?: MeasureAgg }
  >();
  for (const name of pinned) {
    display.set(name, { before: mb.get(name), after: ma.get(name) });
  }
  display.set("image-load:*", {
    before: sumPrefix(mb, "image-load:"),
    after: sumPrefix(ma, "image-load:"),
  });
  const rest = [...names].filter(
    (n) =>
      n !== "renderCharacter" &&
      !n.startsWith("image-load:") &&
      !n.startsWith("hash-"),
  );
  rest.sort((a, b) => (ma.get(b)?.totalMs ?? 0) - (ma.get(a)?.totalMs ?? 0));
  for (const name of rest.slice(0, 20)) {
    display.set(name, { before: mb.get(name), after: ma.get(name) });
  }

  const ordered = [...display.keys()];

  const w = {
    name: "measure".length,
    before: "before".length,
    after: "after".length,
    delta: "Δ".length,
  };
  const rows = ordered.map((name) => {
    const pair = display.get(name);
    const b = pair?.before;
    const a = pair?.after;
    const d = (a?.totalMs ?? 0) - (b?.totalMs ?? 0);
    return {
      name: `${name} (n=${a?.count ?? 0})`,
      before: fmt(b?.totalMs),
      after: fmt(a?.totalMs),
      delta: `${d >= 0 ? "+" : ""}${fmt(d)}`,
    };
  });
  for (const r of rows) {
    w.name = Math.max(w.name, r.name.length);
    w.before = Math.max(w.before, r.before.length);
    w.after = Math.max(w.after, r.after.length);
    w.delta = Math.max(w.delta, r.delta.length);
  }

  lines.push(
    "── measures (total ms; renderCharacter, hash, image-load:* first) ──",
  );
  lines.push(
    `  ${pad("measure", w.name)}  ${pad("before", w.before)}  ${pad("after", w.after)}  ${pad("Δ", w.delta)}`,
  );
  lines.push(
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.before)}  ${"-".repeat(w.after)}  ${"-".repeat(w.delta)}`,
  );
  for (const r of rows) {
    lines.push(
      `  ${pad(r.name, w.name)}  ${pad(r.before, w.before)}  ${pad(r.after, w.after)}  ${pad(r.delta, w.delta)}`,
    );
  }
  lines.push("");

  diffRenderCharacterPhases(lines, pb, pa);
}

function emptyPhaseReport(): RenderCharacterPhaseReport {
  const phasesMs = Object.fromEntries(
    RENDER_CHARACTER_PHASE_KEYS.map((k) => [k, 0]),
  ) as RenderCharacterPhaseReport["phasesMs"];
  const counters: RenderCharacterCounters = {
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
  return { totalMs: 0, unaccountedMs: 0, phasesMs, counters };
}

function diffRenderCharacterPhases(
  lines: string[],
  pb: ProfilerSnapshot,
  pa: ProfilerSnapshot,
): void {
  const beforeCalls = pb.renderCharacter?.calls ?? [];
  const afterCalls = pa.renderCharacter?.calls ?? [];
  const n = Math.max(beforeCalls.length, afterCalls.length);
  lines.push("── renderCharacter phases ──");
  if (n === 0) {
    lines.push("  (no renderCharacter phase reports)");
    lines.push("");
    return;
  }
  for (let i = 0; i < n; i++) {
    const b = beforeCalls[i] ?? emptyPhaseReport();
    const a = afterCalls[i] ?? emptyPhaseReport();
    lines.push(
      `  call ${i}: total ${fmt(b.totalMs)} → ${fmt(a.totalMs)}` +
        ` (Δ ${signed((a.totalMs ?? 0) - (b.totalMs ?? 0))})` +
        `  unaccounted ${fmt(b.unaccountedMs)} → ${fmt(a.unaccountedMs)}`,
    );
    const pw = {
      name: "phase".length,
      before: "before".length,
      after: "after".length,
      delta: "Δ".length,
    };
    const phaseRows = [
      {
        name: "totalMs",
        before: fmt(b.totalMs),
        after: fmt(a.totalMs),
        delta: signed((a.totalMs ?? 0) - (b.totalMs ?? 0)),
      },
      ...RENDER_CHARACTER_PHASE_KEYS.map((phase) => {
        const bv = b.phasesMs[phase] ?? 0;
        const av = a.phasesMs[phase] ?? 0;
        return {
          name: phase,
          before: fmt(bv),
          after: fmt(av),
          delta: signed(av - bv),
        };
      }),
    ];
    for (const r of phaseRows) {
      pw.name = Math.max(pw.name, r.name.length);
      pw.before = Math.max(pw.before, r.before.length);
      pw.after = Math.max(pw.after, r.after.length);
      pw.delta = Math.max(pw.delta, r.delta.length);
    }
    lines.push(
      `    ${pad("phase", pw.name)}  ${pad("before", pw.before)}  ${pad("after", pw.after)}  ${pad("Δ", pw.delta)}`,
    );
    lines.push(
      `    ${"-".repeat(pw.name)}  ${"-".repeat(pw.before)}  ${"-".repeat(pw.after)}  ${"-".repeat(pw.delta)}`,
    );
    for (const r of phaseRows) {
      lines.push(
        `    ${pad(r.name, pw.name)}  ${pad(r.before, pw.before)}  ${pad(r.after, pw.after)}  ${pad(r.delta, pw.delta)}`,
      );
    }
    const counterKeys = [
      ...new Set([...Object.keys(b.counters), ...Object.keys(a.counters)]),
    ].sort();
    for (const key of counterKeys) {
      const bv = b.counters[key as keyof RenderCharacterCounters] ?? 0;
      const av = a.counters[key as keyof RenderCharacterCounters] ?? 0;
      lines.push(`    ${key}: ${fmt(bv)} → ${fmt(av)} (Δ ${signed(av - bv)})`);
    }
    lines.push("");
  }
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmt(n)}`;
}

function main(): void {
  const { beforePath, afterPath } = parseArgs(process.argv);
  const before = loadProfile(beforePath);
  const after = loadProfile(afterPath);

  const lines: string[] = [];
  lines.push("App profile diff");
  lines.push(`  before: ${path.relative(REPO_ROOT, beforePath)}`);
  if (before.generatedAt)
    lines.push(`           generatedAt: ${before.generatedAt}`);
  lines.push(`  after:  ${path.relative(REPO_ROOT, afterPath)}`);
  if (after.generatedAt)
    lines.push(`           generatedAt: ${after.generatedAt}`);
  if (before.renderer || after.renderer) {
    const beforeRenderer = before.renderer
      ? rendererLabel(before.renderer)
      : "(missing)";
    const afterRenderer = after.renderer
      ? rendererLabel(after.renderer)
      : "(missing)";
    lines.push(`  renderer: ${beforeRenderer} → ${afterRenderer}`);
    if (
      before.headed !== undefined ||
      after.headed !== undefined ||
      before.channel !== undefined ||
      after.channel !== undefined
    ) {
      lines.push(
        `  launch: headed ${String(before.headed ?? false)} channel ${before.channel ?? "(bundled)"}` +
          ` → headed ${String(after.headed ?? false)} channel ${after.channel ?? "(bundled)"}`,
      );
    }
  }
  lines.push("");

  if (before.hash !== after.hash || before.hash2 !== after.hash2) {
    lines.push("  (warning: compare like-with-like — hash or hash2 differ.)");
    lines.push("");
  }

  const modes = new Set([...modesOf(before), ...modesOf(after)]);
  if (modes.size === 0) {
    lines.push("  (missing profiler snapshot in before or after)");
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }

  for (const mode of ["webgl", "cpu"] as const) {
    if (!modes.has(mode)) continue;
    const b = modeResult(before, mode);
    const a = modeResult(after, mode);
    lines.push(`======== ${mode} ========`);
    if (!b) {
      lines.push("  (missing in before)");
      lines.push("");
      continue;
    }
    if (!a) {
      lines.push("  (missing in after)");
      lines.push("");
      continue;
    }
    lines.push(
      `  activeMode: ${b.activeMode} → ${a.activeMode}` +
        `  stats before webgl=${b.recolorStats.webgl} cpu=${b.recolorStats.cpu}` +
        `  after webgl=${a.recolorStats.webgl} cpu=${a.recolorStats.cpu}`,
    );
    diffSnapshots(lines, b.profiler, a.profiler);
  }

  process.stdout.write(lines.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

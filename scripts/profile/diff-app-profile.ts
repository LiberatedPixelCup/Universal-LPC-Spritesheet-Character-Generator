/**
 * Compare two app-profile JSON files (from `app-profile.ts` or `profile:app`).
 *
 * Usage:
 *   node scripts/profile/diff-app-profile.ts <before.json> <after.json>
 *   node scripts/profile/diff-app-profile.ts --before tmp/baseline.json --after tmp/current.json
 *
 * Prints metric and measure deltas (after − before). Positive Δ means slower.
 * Exit code 0 always (reporting tool).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ProfilerSnapshot } from "../../sources/performance-profiler.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

type AppProfileFile = {
  generatedAt?: string;
  hash?: string;
  hash2?: string | null;
  actions?: string[];
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

function loadProfile(p: string): AppProfileFile {
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as AppProfileFile;
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

function main(): void {
  const { beforePath, afterPath } = parseArgs(process.argv);
  const before = loadProfile(beforePath);
  const after = loadProfile(afterPath);
  const pb = before.profiler;
  const pa = after.profiler;

  const lines: string[] = [];
  lines.push("App profile diff");
  lines.push(`  before: ${path.relative(REPO_ROOT, beforePath)}`);
  if (before.generatedAt)
    lines.push(`           generatedAt: ${before.generatedAt}`);
  lines.push(`  after:  ${path.relative(REPO_ROOT, afterPath)}`);
  if (after.generatedAt)
    lines.push(`           generatedAt: ${after.generatedAt}`);
  lines.push("");

  if (before.hash !== after.hash || before.hash2 !== after.hash2) {
    lines.push("  (warning: compare like-with-like — hash or hash2 differ.)");
    lines.push("");
  }

  if (!pb || !pa) {
    lines.push("  (missing profiler snapshot in before or after)");
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }

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

  process.stdout.write(lines.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

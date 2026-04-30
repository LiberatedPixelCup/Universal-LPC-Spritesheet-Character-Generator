/**
 * Compare two ZIP-profile JSON files (from `zip-export-profile.js` or `profile:zip`).
 *
 * Usage:
 *   node scripts/zip/diff-zip-profile.js <before.json> <after.json>
 *   node scripts/zip/diff-zip-profile.js --before tmp/baseline.json --after tmp/current.json
 *
 * Prints per-export-kind phase deltas (after − before). Positive Δ means slower.
 * Exit code 0 always (reporting tool).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

function parseArgs(argv) {
  const args = argv.slice(2);
  const bi = args.indexOf("--before");
  const ai = args.indexOf("--after");
  let beforePath;
  let afterPath;
  if (bi !== -1 && args[bi + 1] && ai !== -1 && args[ai + 1]) {
    beforePath = path.resolve(REPO_ROOT, args[bi + 1]);
    afterPath = path.resolve(REPO_ROOT, args[ai + 1]);
  } else if (args.length >= 2 && !args[0].startsWith("-")) {
    beforePath = path.resolve(REPO_ROOT, args[0]);
    afterPath = path.resolve(REPO_ROOT, args[1]);
  } else {
    throw new Error(
      "Usage: diff-zip-profile.js <before.json> <after.json>\n" +
        "   or: diff-zip-profile.js --before <before.json> --after <after.json>",
    );
  }
  return { beforePath, afterPath };
}

function loadProfile(p) {
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function fmt(n) {
  if (n === undefined || n === null || Number.isNaN(n)) {
    return "—";
  }
  return String(round1(n));
}

function main() {
  const { beforePath, afterPath } = parseArgs(process.argv);
  const before = loadProfile(beforePath);
  const after = loadProfile(afterPath);

  const lines = [];
  lines.push("ZIP profile diff");
  lines.push(`  before: ${path.relative(REPO_ROOT, beforePath)}`);
  if (before.generatedAt)
    lines.push(`           generatedAt: ${before.generatedAt}`);
  lines.push(`  after:  ${path.relative(REPO_ROOT, afterPath)}`);
  if (after.generatedAt)
    lines.push(`           generatedAt: ${after.generatedAt}`);
  lines.push("");

  const meta =
    `quickMode: before=${before.quickMode} after=${after.quickMode} ` +
    `| only: before=${before.only ?? "?"} after=${after.only ?? "?"}`;
  lines.push(`Metadata: ${meta}`);
  if (before.quickMode !== after.quickMode || before.only !== after.only) {
    lines.push(
      "  (warning: compare like-with-like — quickMode or only differ.)",
    );
  }
  lines.push("");

  const pb = before.profiles || {};
  const pa = after.profiles || {};
  const kinds = new Set([...Object.keys(pb), ...Object.keys(pa)]);
  const sorted = [...kinds].sort();

  for (const kind of sorted) {
    const b = pb[kind];
    const a = pa[kind];
    lines.push(`── ${kind} ──`);
    if (!b && !a) continue;
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

    const tb = b.totalMs;
    const ta = a.totalMs;
    const dt = ta - tb;
    lines.push(
      `  totalMs: ${fmt(tb)} → ${fmt(ta)}  (Δ ${dt >= 0 ? "+" : ""}${fmt(dt)})`,
    );

    const mb = b.phasesMs || {};
    const ma = a.phasesMs || {};
    const phases = new Set([...Object.keys(mb), ...Object.keys(ma)]);
    const phaseList = [...phases].sort();

    const w = {
      phase: "phase".length,
      before: "before".length,
      after: "after".length,
      delta: "Δ".length,
    };
    for (const ph of phaseList) {
      w.phase = Math.max(w.phase, ph.length);
      w.before = Math.max(w.before, fmt(mb[ph]).length);
      w.after = Math.max(w.after, fmt(ma[ph]).length);
      const d = (ma[ph] ?? 0) - (mb[ph] ?? 0);
      w.delta = Math.max(w.delta, `${d >= 0 ? "+" : ""}${fmt(d)}`.length);
    }

    const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));
    lines.push(
      `  ${pad("phase", w.phase)}  ${pad("before", w.before)}  ${pad("after", w.after)}  ${pad("Δ", w.delta)}`,
    );
    lines.push(
      `  ${"-".repeat(w.phase)}  ${"-".repeat(w.before)}  ${"-".repeat(w.after)}  ${"-".repeat(w.delta)}`,
    );

    for (const ph of phaseList) {
      const vb = mb[ph];
      const va = ma[ph];
      const d = (va ?? 0) - (vb ?? 0);
      const dStr = `${d >= 0 ? "+" : ""}${fmt(d)}`;
      lines.push(
        `  ${pad(ph, w.phase)}  ${pad(fmt(vb), w.before)}  ${pad(fmt(va), w.after)}  ${pad(dStr, w.delta)}`,
      );
    }
    lines.push("");
  }

  process.stdout.write(lines.join("\n") + "\n");
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}

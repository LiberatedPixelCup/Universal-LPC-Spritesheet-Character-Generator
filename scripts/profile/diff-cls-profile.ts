/**
 * Compare two CLS profile JSON files (from `cls-profile.ts`).
 *
 * Usage:
 *   node scripts/profile/diff-cls-profile.ts <before.json> <after.json>
 *   node scripts/profile/diff-cls-profile.ts --before tmp/baseline.json --after tmp/current.json
 *
 * Prints per-preset median deltas (after − before). Positive Δ means more shift.
 * Warns when lighthouseVersion, platform, delayCssMs, or hostUserAgent differ.
 * Exit code 0 always (reporting tool).
 *
 * @see CLS.md
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ClsPreset,
  ClsPresetResult,
  ClsProfileFile,
} from "./cls-profile.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

export type DiffCliOpts = { beforePath: string; afterPath: string };

export function parseArgs(argv: readonly string[]): DiffCliOpts {
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
      "Usage: diff-cls-profile.ts <before.json> <after.json>\n" +
        "   or: diff-cls-profile.ts --before <before.json> --after <after.json>",
    );
  }
  return { beforePath, afterPath };
}

export function loadProfile(p: string): ClsProfileFile {
  return JSON.parse(readFileSync(p, "utf8")) as ClsProfileFile;
}

function fmtCls(n: number): string {
  return n.toFixed(3);
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmtCls(n)}`;
}

function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s;
  const spaces = " ".repeat(n - s.length);
  return right ? spaces + s : s + spaces;
}

function byPreset(
  file: ClsProfileFile,
): Map<ClsPreset | string, ClsPresetResult> {
  const map = new Map<ClsPreset | string, ClsPresetResult>();
  for (const preset of file.presets) {
    map.set(preset.preset, preset);
  }
  return map;
}

/** Unique sample `hostUserAgent`s; null when none were recorded. */
export function hostUserAgentLabel(file: ClsProfileFile): string | null {
  const uas: string[] = [];
  const seen = new Set<string>();
  for (const preset of file.presets) {
    for (const sample of preset.samples) {
      if (sample.hostUserAgent === "" || seen.has(sample.hostUserAgent)) {
        continue;
      }
      seen.add(sample.hostUserAgent);
      uas.push(sample.hostUserAgent);
    }
  }
  if (uas.length === 0) {
    return null;
  }
  return uas.join(" | ");
}

export function formatClsProfileDiff(
  before: ClsProfileFile,
  after: ClsProfileFile,
  beforePath: string,
  afterPath: string,
): string {
  const beforeMap = byPreset(before);
  const afterMap = byPreset(after);
  const names = [...new Set([...beforeMap.keys(), ...afterMap.keys()])];

  const rows: {
    name: string;
    before: string;
    after: string;
    delta: string;
  }[] = [];
  for (const name of names) {
    const b = beforeMap.get(name);
    const a = afterMap.get(name);
    if (b && a) {
      const d = a.summary.median - b.summary.median;
      rows.push({
        name,
        before: fmtCls(b.summary.median),
        after: fmtCls(a.summary.median),
        delta: signed(d),
      });
    } else {
      rows.push({
        name,
        before: b ? fmtCls(b.summary.median) : "—",
        after: a ? fmtCls(a.summary.median) : "—",
        delta: "n/a",
      });
    }
  }

  const w = {
    name: "preset".length,
    before: "before".length,
    after: "after".length,
    delta: "Δ".length,
  };
  for (const r of rows) {
    w.name = Math.max(w.name, r.name.length);
    w.before = Math.max(w.before, r.before.length);
    w.after = Math.max(w.after, r.after.length);
    w.delta = Math.max(w.delta, r.delta.length);
  }

  const lines = [
    "CLS profile diff (median; positive Δ is more shift)",
    `  before: ${path.relative(REPO_ROOT, beforePath)}`,
    `  after:  ${path.relative(REPO_ROOT, afterPath)}`,
    `  ${pad("preset", w.name)}  ${pad("before", w.before, true)}  ${pad("after", w.after, true)}  ${pad("Δ", w.delta, true)}`,
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.before)}  ${"-".repeat(w.after)}  ${"-".repeat(w.delta)}`,
    ...rows.map(
      (r) =>
        `  ${pad(r.name, w.name)}  ${pad(r.before, w.before, true)}  ${pad(r.after, w.after, true)}  ${pad(r.delta, w.delta, true)}`,
    ),
  ];

  if (before.lighthouseVersion !== after.lighthouseVersion) {
    lines.push(
      `  warning: lighthouseVersion differs (${before.lighthouseVersion} → ${after.lighthouseVersion}); do not treat Δ as a layout change`,
    );
  }
  if (before.platform !== after.platform) {
    lines.push(
      `  warning: platform differs (${before.platform} → ${after.platform}); local ≠ CI`,
    );
  }

  if (before.delayCssMs !== after.delayCssMs) {
    lines.push(
      `  warning: delayCssMs differs (${before.delayCssMs} → ${after.delayCssMs}); do not treat Δ as a layout change`,
    );
  }

  const beforeUa = hostUserAgentLabel(before);
  const afterUa = hostUserAgentLabel(after);
  if (beforeUa !== null && afterUa !== null && beforeUa !== afterUa) {
    lines.push(
      `  warning: hostUserAgent differs (${beforeUa} → ${afterUa}); CI Chrome floats independently of lighthouseVersion; do not treat Δ as a layout change`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function main(argv: readonly string[] = process.argv): number {
  const { beforePath, afterPath } = parseArgs(argv);
  const before = loadProfile(beforePath);
  const after = loadProfile(afterPath);
  process.stdout.write(
    formatClsProfileDiff(before, after, beforePath, afterPath),
  );
  return 0;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

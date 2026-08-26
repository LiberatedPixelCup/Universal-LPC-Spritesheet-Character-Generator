/**
 * Compare two catalog-load profile JSON files (from `app-load-profile.ts`).
 *
 * Usage:
 *   node scripts/profile/diff-app-load-profile.ts <before.json> <after.json>
 *   node scripts/profile/diff-app-load-profile.ts --before tmp/baseline.json --after tmp/current.json
 *
 * Prints median deltas (after − before). Positive Δ means slower / larger.
 * Exit code 0 always (reporting tool). An indexReadyMs or liteReadyMs median
 * move of 50 ms+ is worth a second look (first-paint gates). A 50 ms+ move on
 * catalogReadyMs alone can be the credits/palette tail.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SLOW_CATALOG_READY_DELTA_MS,
  type AppLoadProfileFile,
  type LoadStats,
} from "./app-load-profile.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

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
      "Usage: diff-app-load-profile.ts <before.json> <after.json>\n" +
        "   or: diff-app-load-profile.ts --before <before.json> --after <after.json>",
    );
  }
  return { beforePath, afterPath };
}

function loadProfile(p: string): AppLoadProfileFile {
  return JSON.parse(readFileSync(p, "utf8")) as AppLoadProfileFile;
}

function fmtMs(n: number): string {
  return `${n.toFixed(1)} ms`;
}

function signed(n: number, fmt: (v: number) => string): string {
  return `${n >= 0 ? "+" : ""}${fmt(n)}`;
}

function pad(s: string, n: number, right = false): string {
  if (s.length >= n) return s;
  const sp = " ".repeat(n - s.length);
  return right ? sp + s : s + sp;
}

function row(
  name: string,
  before: LoadStats | null | undefined,
  after: LoadStats | null | undefined,
  fmt: (n: number) => string,
): { name: string; before: string; after: string; delta: string } | null {
  if (!before || !after) return null;
  const d = after.median - before.median;
  return {
    name,
    before: fmt(before.median),
    after: fmt(after.median),
    delta: signed(d, fmt),
  };
}

function main(): void {
  const { beforePath, afterPath } = parseArgs(process.argv);
  const before = loadProfile(beforePath);
  const after = loadProfile(afterPath);

  const rows = [
    row(
      "navigation.duration",
      before.summary.navigationDurationMs,
      after.summary.navigationDurationMs,
      fmtMs,
    ),
    row(
      "indexReadyMs",
      before.summary.indexReadyMs,
      after.summary.indexReadyMs,
      fmtMs,
    ),
    row(
      "liteReadyMs",
      before.summary.liteReadyMs,
      after.summary.liteReadyMs,
      fmtMs,
    ),
    row(
      "catalogReadyMs",
      before.summary.catalogReadyMs,
      after.summary.catalogReadyMs,
      fmtMs,
    ),
    row(
      "catalog-load",
      before.summary.catalogLoadMs,
      after.summary.catalogLoadMs,
      fmtMs,
    ),
    ...Object.keys({ ...before.summary.chunks, ...after.summary.chunks }).map(
      (name) =>
        row(
          name,
          before.summary.chunks[name],
          after.summary.chunks[name],
          fmtMs,
        ),
    ),
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  const w = {
    name: "metric".length,
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
    "Catalog load profile diff (median; positive Δ is slower)",
    `  before: ${path.relative(REPO_ROOT, beforePath)}`,
    `  after:  ${path.relative(REPO_ROOT, afterPath)}`,
    `  ${pad("metric", w.name)}  ${pad("before", w.before, true)}  ${pad("after", w.after, true)}  ${pad("Δ", w.delta, true)}`,
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.before)}  ${"-".repeat(w.after)}  ${"-".repeat(w.delta)}`,
    ...rows.map(
      (r) =>
        `  ${pad(r.name, w.name)}  ${pad(r.before, w.before, true)}  ${pad(r.after, w.after, true)}  ${pad(r.delta, w.delta, true)}`,
    ),
  ];

  const indexDelta =
    before.summary.indexReadyMs && after.summary.indexReadyMs
      ? after.summary.indexReadyMs.median - before.summary.indexReadyMs.median
      : null;
  const liteDelta =
    before.summary.liteReadyMs && after.summary.liteReadyMs
      ? after.summary.liteReadyMs.median - before.summary.liteReadyMs.median
      : null;
  const readyDelta =
    after.summary.catalogReadyMs.median - before.summary.catalogReadyMs.median;
  if (
    indexDelta !== null &&
    Math.abs(indexDelta) >= SLOW_CATALOG_READY_DELTA_MS
  ) {
    lines.push(
      `  note: indexReadyMs median moved ${signed(indexDelta, fmtMs)}; worth a second look (first-paint gate)`,
    );
  }
  if (
    liteDelta !== null &&
    Math.abs(liteDelta) >= SLOW_CATALOG_READY_DELTA_MS
  ) {
    lines.push(
      `  note: liteReadyMs median moved ${signed(liteDelta, fmtMs)}; worth a second look (first-paint gate)`,
    );
  }
  if (Math.abs(readyDelta) >= SLOW_CATALOG_READY_DELTA_MS) {
    lines.push(
      `  note: catalogReadyMs median moved ${signed(readyDelta, fmtMs)}; credits/palette tail, not the intern load verdict`,
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
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

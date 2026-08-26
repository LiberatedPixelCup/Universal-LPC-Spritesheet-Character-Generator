/**
 * Report raw, gzip, and brotli bytes of generated metadata modules.
 *
 * Regenerates the five modules in memory (no `dist/`, no Vite, no CREDITS.csv).
 * The item + index pair is reported because interned emit moves bytes between
 * those two files. Byte counts are generator output, a proxy for Vite's
 * bundled-chunk warning.
 *
 * Usage:
 *   node scripts/profile/metadata-size.ts
 *   node scripts/profile/metadata-size.ts --json tmp/baseline-metadata-size.json
 *   node scripts/profile/metadata-size.ts --json tmp/baseline-metadata-size.json --bench
 *   node scripts/profile/metadata-size.ts --baseline tmp/baseline-metadata-size.json
 *   node scripts/profile/metadata-size.ts --check
 *
 * @see PERFORMANCE_PROFILING.md
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { generateSources } from "../generate_sources.ts";
import { METADATA_MODULE_BASENAMES } from "../generateSources/state.ts";
import {
  expandInternedItemLite,
  type InternedItemLite,
} from "../../sources/state/resolve-hash-param.ts";
import type { PaletteMap } from "../../sources/state/catalog.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const DEFAULT_JSON_PATH = path.join(REPO_ROOT, "tmp", "metadata-size.json");
const BENCH_RUNS = 40;
const KIB = 1024;

/** Vite's default chunk-size warning (keep headroom; do not tighten to current size). */
export const ITEM_METADATA_RAW_BUDGET_BYTES = 500 * KIB;
/** Pair budget so intern cannot shuffle bytes into index-metadata.js. */
export const ITEM_INDEX_PAIR_RAW_BUDGET_BYTES = 600 * KIB;

export const PAIR_MODULE_NAMES = [
  "item-metadata.js",
  "index-metadata.js",
] as const;

export type ByteSizes = {
  raw: number;
  gzip: number;
  brotli: number;
};

export type BenchStats = {
  medianMs: number;
  minMs: number;
  maxMs: number;
  runs: number;
};

export type MetadataSizeReport = {
  generatedAt: string;
  env: "production";
  modules: Record<string, ByteSizes>;
  pair: ByteSizes & { modules: typeof PAIR_MODULE_NAMES };
  bench?: {
    itemCount: number;
    parseLite: BenchStats;
    expand: BenchStats;
  };
};

type CliOpts = {
  jsonPath: string | null;
  baselinePath: string | null;
  bench: boolean;
  check: boolean;
};

export type BudgetViolation = {
  name: string;
  actual: number;
  budget: number;
};

function usage(): string {
  return [
    "Usage: node scripts/profile/metadata-size.ts [--json [path]] [--baseline <path>] [--bench] [--check]",
    "  --json [path]       Write the report as JSON (default: tmp/metadata-size.json)",
    "  --baseline <path>   Print byte deltas against a previous --json report",
    "  --bench             Median of JSON.parse(lite) and expandInternedItemLite over every item",
    "  --check             Exit 1 if item-metadata.js raw exceeds 500 KiB or the item+index pair exceeds 600 KiB",
  ].join("\n");
}

export function parseArgs(argv: readonly string[]): CliOpts {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  let jsonPath: string | null = null;
  let baselinePath: string | null = null;
  let bench = false;
  let check = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === "--json") {
      if (next && !next.startsWith("-")) {
        jsonPath = path.resolve(REPO_ROOT, next);
        i += 1;
      } else {
        jsonPath = DEFAULT_JSON_PATH;
      }
    } else if (a === "--baseline" && next) {
      baselinePath = path.resolve(REPO_ROOT, next);
      i += 1;
    } else if (a === "--baseline") {
      throw new Error("--baseline requires a path");
    } else if (a === "--bench") {
      bench = true;
    } else if (a === "--check") {
      check = true;
    } else {
      throw new Error(`Unknown argument: ${a}\n${usage()}`);
    }
  }
  return { jsonPath, baselinePath, bench, check };
}

function measureBytes(source: string): ByteSizes {
  const buf = Buffer.from(source, "utf8");
  return {
    raw: buf.byteLength,
    gzip: gzipSync(buf).byteLength,
    brotli: brotliCompressSync(buf).byteLength,
  };
}

function sumSizes(parts: ByteSizes[]): ByteSizes {
  return parts.reduce(
    (acc, part) => ({
      raw: acc.raw + part.raw,
      gzip: acc.gzip + part.gzip,
      brotli: acc.brotli + part.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 },
  );
}

/**
 * Slice of `const name =` followed by a JSON object or array (balanced `{` `[` with strings).
 */
function extractJsonSlice(outputText: string, constName: string): string {
  const marker = `const ${constName} = `;
  const start = outputText.indexOf(marker);
  if (start < 0) {
    throw new Error(`Expected const ${constName} in generated metadata`);
  }
  let i = start + marker.length;
  while (/\s/.test(outputText[i] ?? "")) i += 1;
  const open = outputText[i];
  if (open !== "{" && open !== "[") {
    throw new Error(`const ${constName} should be an object or array literal`);
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < outputText.length; j++) {
    const c = outputText[j];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") depth += 1;
    else if (c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) {
        return outputText.slice(i, j + 1);
      }
    }
  }
  throw new Error(`Unclosed JSON for const ${constName}`);
}

function extractTopLevelJsonLiteral(
  outputText: string,
  constName: string,
): unknown {
  return JSON.parse(extractJsonSlice(outputText, constName));
}

function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error("median of empty list");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function bench(fn: () => void, runs: number): BenchStats {
  fn();
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return {
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    runs,
  };
}

function captureGeneratedModules(): Map<string, string> {
  const writes = new Map<string, string>();
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    generateSources({
      writeMetadata: true,
      writeCredits: false,
      env: "production",
      metadataOutputPath: path.join(REPO_ROOT, "item-metadata.js"),
      writeFileSync: (filePath, contents) => {
        writes.set(path.basename(String(filePath)), String(contents));
      },
    });
  } finally {
    process.stdout.write = origWrite;
  }
  for (const basename of METADATA_MODULE_BASENAMES) {
    if (!writes.has(basename)) {
      throw new Error(`generateSources did not write ${basename}`);
    }
  }
  return writes;
}

function runBench(
  writes: Map<string, string>,
): NonNullable<MetadataSizeReport["bench"]> {
  const itemSrc = writes.get("item-metadata.js") ?? "";
  const indexSrc = writes.get("index-metadata.js") ?? "";
  const liteJson = extractJsonSlice(itemSrc, "itemMetadata");
  const variantArrays = extractTopLevelJsonLiteral(
    indexSrc,
    "variantArrays",
  ) as string[][];
  const recolorVariantArrays = extractTopLevelJsonLiteral(
    indexSrc,
    "recolorVariantArrays",
  ) as string[][];
  const paletteArrays = indexSrc.includes("const paletteArrays = ")
    ? (extractTopLevelJsonLiteral(indexSrc, "paletteArrays") as PaletteMap[])
    : undefined;
  const parsed = JSON.parse(liteJson) as Record<string, InternedItemLite>;
  const ids = Object.keys(parsed);

  const parseLite = bench(() => {
    JSON.parse(liteJson);
  }, BENCH_RUNS);

  const expand = bench(() => {
    for (const id of ids) {
      expandInternedItemLite(
        parsed[id]!,
        variantArrays,
        recolorVariantArrays,
        paletteArrays,
      );
    }
  }, BENCH_RUNS);

  return { itemCount: ids.length, parseLite, expand };
}

export function collectMetadataSizes(opts: {
  bench: boolean;
}): MetadataSizeReport {
  const writes = captureGeneratedModules();
  const modules: Record<string, ByteSizes> = {};
  for (const basename of METADATA_MODULE_BASENAMES) {
    modules[basename] = measureBytes(writes.get(basename)!);
  }
  const pairParts = PAIR_MODULE_NAMES.map((name) => modules[name]!);
  const report: MetadataSizeReport = {
    generatedAt: new Date().toISOString(),
    env: "production",
    modules,
    pair: {
      modules: PAIR_MODULE_NAMES,
      ...sumSizes(pairParts),
    },
  };
  if (opts.bench) {
    report.bench = runBench(writes);
  }
  return report;
}

export function checkBudgets(report: MetadataSizeReport): BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  const item = report.modules["item-metadata.js"];
  if (item !== undefined && item.raw > ITEM_METADATA_RAW_BUDGET_BYTES) {
    violations.push({
      name: "item-metadata.js",
      actual: item.raw,
      budget: ITEM_METADATA_RAW_BUDGET_BYTES,
    });
  }
  if (report.pair.raw > ITEM_INDEX_PAIR_RAW_BUDGET_BYTES) {
    violations.push({
      name: "item+index pair",
      actual: report.pair.raw,
      budget: ITEM_INDEX_PAIR_RAW_BUDGET_BYTES,
    });
  }
  return violations;
}

function formatKiB(bytes: number): string {
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

function formatBytesCell(bytes: number): string {
  return `${bytes.toLocaleString("en")} (${formatKiB(bytes)})`;
}

function pad(s: string, n: number, align: "left" | "right" = "left"): string {
  if (s.length >= n) return s;
  const sp = " ".repeat(n - s.length);
  return align === "left" ? s + sp : sp + s;
}

function printTable(report: MetadataSizeReport): void {
  const rows: Array<{ name: string; sizes: ByteSizes }> = [
    ...METADATA_MODULE_BASENAMES.map((name) => ({
      name,
      sizes: report.modules[name]!,
    })),
    { name: "item+index pair", sizes: report.pair },
  ];
  const w = {
    name: "module".length,
    raw: "raw".length,
    gzip: "gzip".length,
    brotli: "brotli".length,
  };
  const formatted = rows.map((row) => ({
    name: row.name,
    raw: formatBytesCell(row.sizes.raw),
    gzip: formatBytesCell(row.sizes.gzip),
    brotli: formatBytesCell(row.sizes.brotli),
  }));
  for (const row of formatted) {
    w.name = Math.max(w.name, row.name.length);
    w.raw = Math.max(w.raw, row.raw.length);
    w.gzip = Math.max(w.gzip, row.gzip.length);
    w.brotli = Math.max(w.brotli, row.brotli.length);
  }
  const lines = [
    "Generated metadata sizes (production compact; generator output, not the Vite chunk)",
    `  ${pad("module", w.name)}  ${pad("raw", w.raw, "right")}  ${pad("gzip", w.gzip, "right")}  ${pad("brotli", w.brotli, "right")}`,
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.raw)}  ${"-".repeat(w.gzip)}  ${"-".repeat(w.brotli)}`,
    ...formatted.map(
      (row) =>
        `  ${pad(row.name, w.name)}  ${pad(row.raw, w.raw, "right")}  ${pad(row.gzip, w.gzip, "right")}  ${pad(row.brotli, w.brotli, "right")}`,
    ),
  ];
  if (report.bench) {
    const { parseLite, expand, itemCount } = report.bench;
    const fmt = (s: BenchStats) =>
      `median ${s.medianMs.toFixed(2)} ms (min ${s.minMs.toFixed(2)}, max ${s.maxMs.toFixed(2)}, n=${s.runs})`;
    lines.push("");
    lines.push(
      `Bench (${itemCount} items, ${BENCH_RUNS} timed runs after warmup)`,
    );
    lines.push(`  JSON.parse(lite):          ${fmt(parseLite)}`);
    lines.push(`  expandInternedItemLite:    ${fmt(expand)}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printBudgetFailures(violations: BudgetViolation[]): void {
  const lines = [
    "Generated metadata size budget exceeded (generator output, not the Vite chunk):",
    ...violations.map(
      (v) =>
        `  ${v.name}  ${formatBytesCell(v.actual)}  exceeds  ${formatBytesCell(v.budget)}`,
    ),
    "Raising a budget is a deliberate commit, not a drive-by. Load time is local: npm run profile:load",
  ];
  console.error(lines.join("\n"));
}

function signedBytes(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString("en")} (${sign}${formatKiB(n)})`;
}

function printBaselineDiff(
  current: MetadataSizeReport,
  baselinePath: string,
): void {
  const baseline = JSON.parse(
    readFileSync(baselinePath, "utf8"),
  ) as MetadataSizeReport;
  const names = [...METADATA_MODULE_BASENAMES, "item+index pair"] as const;
  const sizesOf = (
    report: MetadataSizeReport,
    name: (typeof names)[number],
  ): ByteSizes | undefined =>
    name === "item+index pair" ? report.pair : report.modules[name];

  const w = {
    name: "module".length,
    raw: "Δ raw".length,
    gzip: "Δ gzip".length,
    brotli: "Δ brotli".length,
  };
  const formatted = names.map((name) => {
    const after = sizesOf(current, name);
    const before = sizesOf(baseline, name);
    if (!after || !before) {
      return {
        name,
        raw: "n/a",
        gzip: "n/a",
        brotli: "n/a",
      };
    }
    return {
      name,
      raw: signedBytes(after.raw - before.raw),
      gzip: signedBytes(after.gzip - before.gzip),
      brotli: signedBytes(after.brotli - before.brotli),
    };
  });
  for (const row of formatted) {
    w.name = Math.max(w.name, row.name.length);
    w.raw = Math.max(w.raw, row.raw.length);
    w.gzip = Math.max(w.gzip, row.gzip.length);
    w.brotli = Math.max(w.brotli, row.brotli.length);
  }
  const rel = path.relative(REPO_ROOT, baselinePath);
  const lines = [
    "",
    `Delta vs ${rel} (positive is larger)`,
    `  ${pad("module", w.name)}  ${pad("Δ raw", w.raw, "right")}  ${pad("Δ gzip", w.gzip, "right")}  ${pad("Δ brotli", w.brotli, "right")}`,
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.raw)}  ${"-".repeat(w.gzip)}  ${"-".repeat(w.brotli)}`,
    ...formatted.map(
      (row) =>
        `  ${pad(row.name, w.name)}  ${pad(row.raw, w.raw, "right")}  ${pad(row.gzip, w.gzip, "right")}  ${pad(row.brotli, w.brotli, "right")}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function main(argv: readonly string[] = process.argv): void {
  const opts = parseArgs(argv);
  process.chdir(REPO_ROOT);
  process.stderr.write("Generating metadata in memory…\n");
  const report = collectMetadataSizes({ bench: opts.bench });
  printTable(report);
  if (opts.baselinePath) {
    printBaselineDiff(report, opts.baselinePath);
  }
  if (opts.jsonPath) {
    mkdirSync(path.dirname(opts.jsonPath), { recursive: true });
    writeFileSync(
      opts.jsonPath,
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, opts.jsonPath)}\n`);
  }
  if (opts.check) {
    const violations = checkBudgets(report);
    if (violations.length > 0) {
      printBudgetFailures(violations);
      process.exit(1);
    }
    process.stdout.write(
      "Size budgets ok (item-metadata.js raw <= 500 KiB; item+index pair raw <= 600 KiB).\n",
    );
  }
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

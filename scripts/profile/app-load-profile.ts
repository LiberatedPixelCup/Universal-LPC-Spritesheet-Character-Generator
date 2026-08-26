/**
 * Drive a production preview and report catalog-load User Timing.
 *
 * Default: `vite build` then `vite preview` on 127.0.0.1 (not Vite serve).
 * Each `--repeat` is a fresh page: `goto` + `waitForHomepageReady`.
 *
 * Usage:
 *   node scripts/profile/app-load-profile.ts
 *   node scripts/profile/app-load-profile.ts --url http://127.0.0.1:4173
 *   node scripts/profile/app-load-profile.ts --repeat 5 --out tmp/app-load-profile.json
 *
 * Environment:
 *   APP_LOAD_PROFILE_PORT — preview port when this script starts the server (default 4178).
 *
 * @see PERFORMANCE_PROFILING.md
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

import { waitForHomepageReady } from "../../tests/visual/home-helpers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const DEFAULT_PORT = 4178;
const DEFAULT_REPEAT = 5;
/** Same 50 ms bar as the live app profiler’s slow-operation threshold. */
export const SLOW_CATALOG_READY_DELTA_MS = 50;

const CATALOG_LOAD_MEASURE = "catalog-load";
const CATALOG_CHUNK_MEASURE_NAMES = [
  "catalog-chunk:index",
  "catalog-chunk:item",
  "catalog-chunk:credits",
  "catalog-chunk:palette",
  "catalog-chunk:layers",
] as const;

export type LoadStats = {
  median: number;
  min: number;
  max: number;
  n: number;
};

export type MetadataResourceSample = {
  name: string;
  transferSize: number;
  decodedBodySize: number;
  duration: number;
};

export type AppLoadProfileSample = {
  navigationDurationMs: number | null;
  indexReadyMs: number;
  liteReadyMs: number;
  catalogReadyMs: number;
  catalogLoadMs: number[];
  chunks: Record<string, number[]>;
  resources: MetadataResourceSample[];
};

export type AppLoadProfileFile = {
  generatedAt: string;
  url: string;
  repeat: number;
  userAgent: string;
  samples: AppLoadProfileSample[];
  summary: {
    navigationDurationMs: LoadStats | null;
    indexReadyMs: LoadStats;
    liteReadyMs: LoadStats;
    catalogReadyMs: LoadStats;
    catalogLoadMs: LoadStats | null;
    chunks: Record<string, LoadStats | null>;
    resources: Record<
      string,
      {
        transferSize: LoadStats;
        decodedBodySize: LoadStats;
        duration: LoadStats;
      }
    >;
  };
};

type CliOpts = {
  outPath: string;
  url: string | null;
  repeat: number;
};

function parsePort(): number {
  const raw = process.env.APP_LOAD_PROFILE_PORT;
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `APP_LOAD_PROFILE_PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`,
    );
  }
  return n;
}

function usage(): string {
  return [
    "Usage: node scripts/profile/app-load-profile.ts [--url <origin>] [--repeat n] [--out <path>] [--json <path>]",
    "  --url <origin>   Attach to an already-running preview (skips vite build + preview)",
    "  --repeat n       Fresh-page navigations (default 5)",
    "  --out / --json   Write JSON (default: tmp/app-load-profile.json)",
  ].join("\n");
}

export function parseArgs(argv: readonly string[]): CliOpts {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  let outPath: string | null = null;
  let url: string | null = null;
  let repeat = DEFAULT_REPEAT;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if ((a === "--out" || a === "--json") && next) {
      outPath = path.resolve(REPO_ROOT, next);
      i += 1;
    } else if (a === "--url" && next) {
      url = next.replace(/\/?$/, "/");
      i += 1;
    } else if (a === "--repeat" && next) {
      const n = Number.parseInt(next, 10);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--repeat must be an integer >= 1, got: ${next}`);
      }
      repeat = n;
      i += 1;
    } else if (
      a === "--out" ||
      a === "--json" ||
      a === "--url" ||
      a === "--repeat"
    ) {
      throw new Error(`${a} requires a value\n${usage()}`);
    } else {
      throw new Error(`Unknown argument: ${a}\n${usage()}`);
    }
  }
  return {
    outPath: outPath ?? path.join(REPO_ROOT, "tmp", "app-load-profile.json"),
    url,
    repeat,
  };
}

export function median(values: number[]): number {
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

export function statsOf(values: number[]): LoadStats | null {
  if (values.length === 0) return null;
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    n: values.length,
  };
}

function loadPageUrl(base: string): string {
  const u = new URL(base);
  u.searchParams.set("debug", "true");
  return u.href;
}

async function waitForHttpOk(url: string, maxMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for preview: ${url}`);
}

async function collectPageTimings(
  page: Page,
): Promise<
  Omit<AppLoadProfileSample, "indexReadyMs" | "liteReadyMs" | "catalogReadyMs">
> {
  return page.evaluate(
    ({ loadName, chunkNames }) => {
      const nav = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;
      const chunks: Record<string, number[]> = {};
      for (const name of chunkNames) {
        chunks[name] = performance
          .getEntriesByName(name, "measure")
          .map((m) => m.duration);
      }
      const resources: MetadataResourceSample[] = performance
        .getEntriesByType("resource")
        .filter((r) => /-metadata/i.test(r.name))
        .map((r) => {
          const rt = r as PerformanceResourceTiming;
          let base = rt.name;
          try {
            const parts = new URL(rt.name).pathname.split("/");
            base = parts[parts.length - 1] || rt.name;
          } catch {
            /* keep the full URL */
          }
          return {
            name: base,
            transferSize: rt.transferSize,
            decodedBodySize: rt.decodedBodySize,
            duration: rt.duration,
          };
        });
      return {
        navigationDurationMs:
          nav && Number.isFinite(nav.duration) ? nav.duration : null,
        catalogLoadMs: performance
          .getEntriesByName(loadName, "measure")
          .map((m) => m.duration),
        chunks,
        resources,
      };
    },
    {
      loadName: CATALOG_LOAD_MEASURE,
      chunkNames: [...CATALOG_CHUNK_MEASURE_NAMES],
    },
  );
}

async function runOneNavigation(
  page: Page,
  url: string,
): Promise<AppLoadProfileSample> {
  // `commit` is early enough that the catalog wait hooks can still be
  // pending; `load` would wait for every resource and inflate ready times.
  await page.goto(url, { waitUntil: "commit", timeout: 120000 });
  await page.waitForFunction(
    () =>
      typeof window.__LPC_waitCatalogIndexReady === "function" &&
      typeof window.__LPC_waitCatalogLiteReady === "function" &&
      typeof window.__LPC_waitCatalogAllReady === "function",
    undefined,
    { timeout: 120000 },
  );
  // Start the three waits together. Awaiting all-ready first would stamp
  // index/lite with the credits/palette/layers tail.
  const { indexReadyMs, liteReadyMs, catalogReadyMs } = await page.evaluate(
    async () => {
      const indexP = window.__LPC_waitCatalogIndexReady!().then(() =>
        performance.now(),
      );
      const liteP = window.__LPC_waitCatalogLiteReady!().then(() =>
        performance.now(),
      );
      const allP = window.__LPC_waitCatalogAllReady!().then(() =>
        performance.now(),
      );
      const [indexReadyMs, liteReadyMs, catalogReadyMs] = await Promise.all([
        indexP,
        liteP,
        allP,
      ]);
      return { indexReadyMs, liteReadyMs, catalogReadyMs };
    },
  );
  await waitForHomepageReady(page);
  const rest = await collectPageTimings(page);
  return { indexReadyMs, liteReadyMs, catalogReadyMs, ...rest };
}

function summarize(
  samples: AppLoadProfileSample[],
): AppLoadProfileFile["summary"] {
  const nav = samples
    .map((s) => s.navigationDurationMs)
    .filter((n): n is number => n !== null);
  const catalogLoad = samples.flatMap((s) => s.catalogLoadMs);
  const chunks: Record<string, LoadStats | null> = {};
  for (const name of CATALOG_CHUNK_MEASURE_NAMES) {
    chunks[name] = statsOf(samples.flatMap((s) => s.chunks[name] ?? []));
  }
  const byResource = new Map<
    string,
    { transferSize: number[]; decodedBodySize: number[]; duration: number[] }
  >();
  for (const sample of samples) {
    for (const r of sample.resources) {
      let bucket = byResource.get(r.name);
      if (!bucket) {
        bucket = { transferSize: [], decodedBodySize: [], duration: [] };
        byResource.set(r.name, bucket);
      }
      bucket.transferSize.push(r.transferSize);
      bucket.decodedBodySize.push(r.decodedBodySize);
      bucket.duration.push(r.duration);
    }
  }
  const resources: AppLoadProfileFile["summary"]["resources"] = {};
  for (const [name, bucket] of byResource) {
    resources[name] = {
      transferSize: statsOf(bucket.transferSize)!,
      decodedBodySize: statsOf(bucket.decodedBodySize)!,
      duration: statsOf(bucket.duration)!,
    };
  }
  return {
    navigationDurationMs: statsOf(nav),
    indexReadyMs: statsOf(samples.map((s) => s.indexReadyMs))!,
    liteReadyMs: statsOf(samples.map((s) => s.liteReadyMs))!,
    catalogReadyMs: statsOf(samples.map((s) => s.catalogReadyMs))!,
    catalogLoadMs: statsOf(catalogLoad),
    chunks,
    resources,
  };
}

function fmtMs(n: number): string {
  return `${n.toFixed(1)} ms`;
}

function fmtBytes(n: number): string {
  return `${Math.round(n).toLocaleString("en")} B`;
}

function printSummary(file: AppLoadProfileFile): void {
  const rows: Array<{
    name: string;
    stats: LoadStats | null;
    fmt: (n: number) => string;
  }> = [
    {
      name: "navigation.duration",
      stats: file.summary.navigationDurationMs,
      fmt: fmtMs,
    },
    {
      name: "indexReadyMs",
      stats: file.summary.indexReadyMs,
      fmt: fmtMs,
    },
    {
      name: "liteReadyMs",
      stats: file.summary.liteReadyMs,
      fmt: fmtMs,
    },
    {
      name: "catalogReadyMs",
      stats: file.summary.catalogReadyMs,
      fmt: fmtMs,
    },
    {
      name: CATALOG_LOAD_MEASURE,
      stats: file.summary.catalogLoadMs,
      fmt: fmtMs,
    },
    ...CATALOG_CHUNK_MEASURE_NAMES.map((name) => ({
      name,
      stats: file.summary.chunks[name] ?? null,
      fmt: fmtMs,
    })),
  ];
  for (const [name, r] of Object.entries(file.summary.resources)) {
    rows.push({
      name: `${name} decodedBodySize`,
      stats: r.decodedBodySize,
      fmt: fmtBytes,
    });
    rows.push({
      name: `${name} transferSize`,
      stats: r.transferSize,
      fmt: fmtBytes,
    });
    rows.push({
      name: `${name} duration`,
      stats: r.duration,
      fmt: fmtMs,
    });
  }
  const w = {
    name: "metric".length,
    median: "median".length,
    min: "min".length,
    max: "max".length,
  };
  const formatted = rows.map((row) => {
    if (!row.stats) {
      return { name: row.name, median: "n/a", min: "n/a", max: "n/a" };
    }
    return {
      name: row.name,
      median: row.fmt(row.stats.median),
      min: row.fmt(row.stats.min),
      max: row.fmt(row.stats.max),
    };
  });
  for (const row of formatted) {
    w.name = Math.max(w.name, row.name.length);
    w.median = Math.max(w.median, row.median.length);
    w.min = Math.max(w.min, row.min.length);
    w.max = Math.max(w.max, row.max.length);
  }
  const pad = (s: string, n: number, right = false): string =>
    s.length >= n
      ? s
      : right
        ? " ".repeat(n - s.length) + s
        : s + " ".repeat(n - s.length);
  const lines = [
    `Catalog load profile (production preview, n=${file.repeat})`,
    `  ${pad("metric", w.name)}  ${pad("median", w.median, true)}  ${pad("min", w.min, true)}  ${pad("max", w.max, true)}`,
    `  ${"-".repeat(w.name)}  ${"-".repeat(w.median)}  ${"-".repeat(w.min)}  ${"-".repeat(w.max)}`,
    ...formatted.map(
      (row) =>
        `  ${pad(row.name, w.name)}  ${pad(row.median, w.median, true)}  ${pad(row.min, w.min, true)}  ${pad(row.max, w.max, true)}`,
    ),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function runViteBuild(): void {
  process.stderr.write("Building production bundle…\n");
  const result = spawnSync("npx", ["vite", "build"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`vite build failed with status ${result.status}`);
  }
}

async function main(): Promise<void> {
  const sandboxCache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (sandboxCache?.includes("cursor-sandbox-cache")) {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  const opts = parseArgs(process.argv);
  const port = parsePort();
  const spawnedBase = `http://127.0.0.1:${port}/`;
  const base = opts.url ?? spawnedBase;
  const url = loadPageUrl(base);

  let preview: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    if (!opts.url) {
      runViteBuild();
      preview = spawn(
        "npx",
        [
          "vite",
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
        ],
        {
          cwd: REPO_ROOT,
          stdio: "ignore",
          shell: process.platform === "win32",
        },
      );
      await waitForHttpOk(spawnedBase, 120000);
    }

    browser = await chromium.launch({ headless: true });
    const pageErrors: string[] = [];
    const samples: AppLoadProfileSample[] = [];
    let userAgent = "";

    for (let i = 0; i < opts.repeat; i++) {
      const page = await browser.newPage();
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      process.stderr.write(`Navigation ${i + 1}/${opts.repeat}…\n`);
      samples.push(await runOneNavigation(page, url));
      if (!userAgent) {
        userAgent = await page.evaluate(() => navigator.userAgent);
      }
      await page.close();
    }

    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    }

    const payload: AppLoadProfileFile = {
      generatedAt: new Date().toISOString(),
      url,
      repeat: opts.repeat,
      userAgent,
      samples,
      summary: summarize(samples),
    };

    printSummary(payload);
    mkdirSync(path.dirname(opts.outPath), { recursive: true });
    writeFileSync(
      opts.outPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    );
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, opts.outPath)}\n`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (preview) {
      preview.kill("SIGTERM");
    }
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

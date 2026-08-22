/**
 * Drive the live app the way a human would and dump `window.profiler.snapshot()`.
 *
 * Starts Vite (unless `--url`), opens Chromium with `?debug=true`, waits for
 * catalog + first render, changes the hash once, then writes JSON under `tmp/`.
 *
 * Usage:
 *   node scripts/profile/app-profile.ts
 *   node scripts/profile/app-profile.ts --url http://127.0.0.1:5173
 *   node scripts/profile/app-profile.ts --hash 'sex=male&body=Body_Color_light'
 *   node scripts/profile/app-profile.ts --out custom/path.json
 *
 * Environment:
 *   APP_PROFILE_PORT — Vite port when this script starts the server (default 5178).
 *
 * @see PERFORMANCE_PROFILING.md
 */

import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

import { ZIP_PROFILE_DEFAULT_HASH } from "../zip/zip-profile-default-hash.ts";
import { waitForHomepageReady } from "../../tests/visual/home-helpers.ts";
import type { ProfilerSnapshot } from "../../sources/performance-profiler.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

/** Same default outfit as ZIP profiling, minus layered gear — a typical deselect. */
const APP_PROFILE_SECOND_HASH =
  "sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light";

const DEFAULT_PORT = 5178;

type AppProfileOpts = {
  outPath: string;
  url: string | null;
  hash: string;
  hash2: string;
};

type AppProfileWindow = Window & {
  profiler?: {
    enabled: boolean;
    snapshot?: () => ProfilerSnapshot;
    metrics?: ProfilerSnapshot["metrics"];
    currentFps?: number;
    getMemoryUsage?: () => ProfilerSnapshot["memory"];
  };
};

function parsePort(): number {
  const raw = process.env.APP_PROFILE_PORT;
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `APP_PROFILE_PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`,
    );
  }
  return n;
}

function parseArgs(argv: string[]): AppProfileOpts {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(
      "Usage: node scripts/profile/app-profile.ts [--url <origin>] [--hash <h>] [--hash2 <h>] [--out <path>]\n",
    );
    process.exit(0);
  }
  let outPath: string | null = null;
  let url: string | null = null;
  let hash = ZIP_PROFILE_DEFAULT_HASH;
  let hash2 = APP_PROFILE_SECOND_HASH;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === "--out" && next) {
      outPath = path.resolve(REPO_ROOT, next);
      i++;
    } else if (a === "--url" && next) {
      url = next;
      i++;
    } else if (a === "--hash" && next) {
      hash = next.replace(/^#/, "");
      i++;
    } else if (a === "--hash2" && next) {
      hash2 = next.replace(/^#/, "");
      i++;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return {
    outPath: outPath ?? path.join(REPO_ROOT, "tmp", "app-profile.json"),
    url,
    hash,
    hash2,
  };
}

function profilePageUrl(base: string, hash: string): string {
  const u = new URL(base);
  u.searchParams.set("debug", "true");
  u.hash = hash;
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
  throw new Error(`Timeout waiting for Vite: ${url}`);
}

function collectSnapshotInPage(): ProfilerSnapshot {
  const w = window as AppProfileWindow;
  const profiler = w.profiler;
  if (!profiler) {
    throw new Error("window.profiler is missing; is ?debug=true set?");
  }
  if (typeof profiler.snapshot === "function") {
    return profiler.snapshot();
  }
  const measures = performance
    .getEntriesByType("measure")
    .map((m) => ({ name: m.name, durationMs: m.duration }))
    .sort((a, b) => b.durationMs - a.durationMs);
  return {
    enabled: profiler.enabled,
    fps: profiler.currentFps ?? 0,
    metrics: profiler.metrics ?? {
      imageLoads: { count: 0, totalTime: 0 },
      draws: { count: 0, totalTime: 0 },
      previews: { count: 0, totalTime: 0 },
      domUpdates: { count: 0, totalTime: 0 },
    },
    memory: profiler.getMemoryUsage?.() ?? null,
    measures,
  };
}

async function renderCharacterMeasureCount(page: Page): Promise<number> {
  return page.evaluate(
    () => performance.getEntriesByName("renderCharacter", "measure").length,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const port = parsePort();
  const spawnedBase = `http://127.0.0.1:${port}/`;
  const base = opts.url ? opts.url.replace(/\/?$/, "/") : spawnedBase;

  let vite: ChildProcess | undefined;
  let browser: Browser | undefined;
  try {
    if (!opts.url) {
      vite = spawn(
        "npx",
        ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
        {
          cwd: REPO_ROOT,
          stdio: "ignore",
          shell: process.platform === "win32",
        },
      );
      await waitForHttpOk(spawnedBase, 120000);
    }

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    const firstUrl = profilePageUrl(base, opts.hash);
    await page.goto(firstUrl, { waitUntil: "load", timeout: 120000 });
    await waitForHomepageReady(page);

    const actions = [`load:${opts.hash}`];
    if (opts.hash2 && opts.hash2 !== opts.hash) {
      const before = await renderCharacterMeasureCount(page);
      await page.evaluate((h) => {
        window.location.hash = h;
      }, opts.hash2);
      await page.waitForFunction(
        (n) =>
          performance.getEntriesByName("renderCharacter", "measure").length > n,
        before,
        { timeout: 120000 },
      );
      await waitForHomepageReady(page);
      actions.push(`hash:${opts.hash2}`);
    }

    // FPS monitor updates every 2s once enabled.
    await new Promise((r) => setTimeout(r, 2100));

    const snapshot = await page.evaluate(collectSnapshotInPage);
    if (!snapshot.enabled) {
      throw new Error(
        "profiler.snapshot() reported enabled=false; expected ?debug=true on localhost",
      );
    }
    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      url: firstUrl,
      hash: opts.hash,
      hash2: opts.hash2 !== opts.hash ? opts.hash2 : null,
      actions,
      userAgent: await page.evaluate(() => navigator.userAgent),
      profiler: snapshot,
    };

    const json = JSON.stringify(payload, null, 2);
    mkdirSync(path.dirname(opts.outPath), { recursive: true });
    writeFileSync(opts.outPath, json, "utf8");
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, opts.outPath)}\n`);
    process.stdout.write(`${json}\n`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (vite) {
      vite.kill("SIGTERM");
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

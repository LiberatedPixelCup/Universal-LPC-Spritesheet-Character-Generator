/**
 * Drive the live app the way a human would and dump `window.profiler.snapshot()`.
 *
 * Starts Vite (unless `--url`), opens Chromium with `?debug=true`, waits for
 * catalog + first render, changes the hash once. Default `--recolor both`
 * does that twice: WebGL (Chromium default) and `?recolor=cpu`.
 *
 * Usage:
 *   node scripts/profile/app-profile.ts
 *   node scripts/profile/app-profile.ts --recolor cpu
 *   node scripts/profile/app-profile.ts --url http://127.0.0.1:5173
 *   node scripts/profile/app-profile.ts --hash 'sex=male&body=Body_Color_light'
 *   node scripts/profile/app-profile.ts --out custom/path.json
 *   node scripts/profile/app-profile.ts --headed --channel chrome
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
import {
  chromium,
  type Browser,
  type LaunchOptions,
  type Page,
} from "playwright";

import { ZIP_PROFILE_DEFAULT_HASH } from "../zip/zip-profile-default-hash.ts";
import { waitForHomepageReady } from "../../tests/visual/home-helpers.ts";
import type { ProfilerSnapshot } from "../../sources/performance-profiler.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

/** Same default outfit as ZIP profiling, minus layered gear — a typical deselect. */
const APP_PROFILE_SECOND_HASH =
  "sex=male&body=Body_Color_light&head=Human_Male_light&expression=Neutral_light";

const DEFAULT_PORT = 5178;

export type AppProfileRecolorMode = "webgl" | "cpu";
type RecolorChoice = AppProfileRecolorMode | "both";

export type AppProfileRenderer = {
  vendor: string | null;
  renderer: string | null;
  unmaskedVendor: string | null;
  unmaskedRenderer: string | null;
};

export type AppProfileModeResult = {
  requestedMode: AppProfileRecolorMode;
  activeMode: string;
  recolorStats: { webgl: number; cpu: number; fallback: number };
  profiler: ProfilerSnapshot;
};

export type AppProfileFile = {
  generatedAt: string;
  url: string;
  hash: string;
  hash2: string | null;
  actions: string[];
  userAgent: string;
  headed: boolean;
  channel: string | null;
  renderer: AppProfileRenderer;
  recolor: RecolorChoice;
  profiles: Partial<Record<AppProfileRecolorMode, AppProfileModeResult>>;
};

type AppProfileOpts = {
  outPath: string;
  url: string | null;
  hash: string;
  hash2: string;
  recolor: RecolorChoice;
  headed: boolean;
  channel: string | null;
};

type AppProfileWindow = Window & {
  profiler?: {
    enabled: boolean;
    snapshot?: () => ProfilerSnapshot;
    metrics?: ProfilerSnapshot["metrics"];
    currentFps?: number;
    getMemoryUsage?: () => ProfilerSnapshot["memory"];
    clear?: () => void;
  };
  getPaletteRecolorConfig?: () => {
    forceCPU: boolean;
    useWebGL: boolean;
    activeMode: string;
  };
  getPaletteRecolorStats?: () => {
    webgl: number;
    cpu: number;
    fallback: number;
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
      "Usage: node scripts/profile/app-profile.ts [--recolor webgl|cpu|both] [--url <origin>] [--hash <h>] [--hash2 <h>] [--out <path>] [--headed] [--channel chrome]\n",
    );
    process.exit(0);
  }
  let outPath: string | null = null;
  let url: string | null = null;
  let hash = ZIP_PROFILE_DEFAULT_HASH;
  let hash2 = APP_PROFILE_SECOND_HASH;
  let recolor: RecolorChoice = "both";
  let headed = false;
  let channel: string | null = null;
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
    } else if (a === "--recolor" && next) {
      if (next !== "webgl" && next !== "cpu" && next !== "both") {
        throw new Error("--recolor must be webgl, cpu, or both");
      }
      recolor = next;
      i++;
    } else if (a === "--headed") {
      headed = true;
    } else if (a === "--channel" && next && !next.startsWith("-")) {
      channel = next;
      i++;
    } else if (a === "--channel") {
      throw new Error("--channel requires a browser name (e.g. chrome)");
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return {
    outPath: outPath ?? path.join(REPO_ROOT, "tmp", "app-profile.json"),
    url,
    hash,
    hash2,
    recolor,
    headed,
    channel,
  };
}

function hardwareGpuArgs(): string[] {
  const args = ["--ignore-gpu-blocklist"];
  if (process.platform === "darwin") {
    args.push("--use-angle=metal");
  } else if (process.platform === "win32") {
    args.push("--use-angle=d3d11");
  }
  return args;
}

function buildLaunchOptions(opts: AppProfileOpts): LaunchOptions {
  const launch: LaunchOptions = { headless: !opts.headed };
  if (opts.channel) {
    launch.channel = opts.channel;
  }
  if (opts.headed || opts.channel) {
    launch.args = hardwareGpuArgs();
  }
  return launch;
}

function emptyRenderer(): AppProfileRenderer {
  return {
    vendor: null,
    renderer: null,
    unmaskedVendor: null,
    unmaskedRenderer: null,
  };
}

export function rendererLabel(info: AppProfileRenderer): string {
  return info.unmaskedRenderer ?? info.renderer ?? "(no WebGL)";
}

export function isSoftwareWebGLRenderer(info: AppProfileRenderer): boolean {
  const text = [info.unmaskedRenderer, info.renderer]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ")
    .toLowerCase();
  if (text === "") return true;
  return /swiftshader|llvmpipe|softpipe|microsoft basic render|software adapter/.test(
    text,
  );
}

function collectWebGLRendererInPage(): AppProfileRenderer {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    return {
      vendor: null,
      renderer: null,
      unmaskedVendor: null,
      unmaskedRenderer: null,
    };
  }
  const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    vendor: String(gl.getParameter(gl.VENDOR)),
    renderer: String(gl.getParameter(gl.RENDERER)),
    unmaskedVendor: debugExt
      ? String(gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL))
      : null,
    unmaskedRenderer: debugExt
      ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL))
      : null,
  };
}

function modesToRun(choice: RecolorChoice): AppProfileRecolorMode[] {
  return choice === "both" ? ["webgl", "cpu"] : [choice];
}

function profilePageUrl(
  base: string,
  hash: string,
  recolor: AppProfileRecolorMode,
): string {
  const u = new URL(base);
  u.searchParams.set("debug", "true");
  if (recolor === "cpu") u.searchParams.set("recolor", "cpu");
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
    renderCharacter: { calls: [] },
  };
}

async function renderCharacterMeasureCount(page: Page): Promise<number> {
  return page.evaluate(
    () => performance.getEntriesByName("renderCharacter", "measure").length,
  );
}

async function driveSelectionChange(
  page: Page,
  hash: string,
  hash2: string,
  actions: string[],
): Promise<void> {
  if (!hash2 || hash2 === hash) return;
  const before = await renderCharacterMeasureCount(page);
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash2);
  await page.waitForFunction(
    (n) =>
      performance.getEntriesByName("renderCharacter", "measure").length > n,
    before,
    { timeout: 120000 },
  );
  await waitForHomepageReady(page);
  actions.push(`hash:${hash2}`);
}

async function runOneMode(
  page: Page,
  base: string,
  hash: string,
  hash2: string,
  recolor: AppProfileRecolorMode,
): Promise<{
  firstUrl: string;
  actions: string[];
  userAgent: string;
  renderer: AppProfileRenderer;
  result: AppProfileModeResult;
}> {
  const firstUrl = profilePageUrl(base, hash, recolor);
  await page.goto(firstUrl, { waitUntil: "load", timeout: 120000 });
  await waitForHomepageReady(page);

  const actions = [`load:${hash}`];
  await driveSelectionChange(page, hash, hash2, actions);

  await new Promise((r) => setTimeout(r, 2100));

  const snapshot = await page.evaluate(collectSnapshotInPage);
  if (!snapshot.enabled) {
    throw new Error(
      "profiler.snapshot() reported enabled=false; expected ?debug=true on localhost",
    );
  }

  const config = await page.evaluate(() => {
    const w = window as AppProfileWindow;
    return w.getPaletteRecolorConfig?.() ?? null;
  });
  const stats = await page.evaluate(() => {
    const w = window as AppProfileWindow;
    return (
      w.getPaletteRecolorStats?.() ?? {
        webgl: 0,
        cpu: 0,
        fallback: 0,
      }
    );
  });

  const activeMode = config?.activeMode ?? "unknown";
  if (recolor === "cpu" && activeMode !== "cpu") {
    throw new Error(
      `Requested CPU recolor but activeMode is ${JSON.stringify(activeMode)}`,
    );
  }
  if (recolor === "cpu" && stats.cpu === 0 && stats.webgl > 0) {
    throw new Error(
      `Requested CPU recolor but stats are webgl=${stats.webgl} cpu=${stats.cpu}`,
    );
  }

  const renderer = await page.evaluate(collectWebGLRendererInPage);

  return {
    firstUrl,
    actions,
    userAgent: await page.evaluate(() => navigator.userAgent),
    renderer,
    result: {
      requestedMode: recolor,
      activeMode,
      recolorStats: stats,
      profiler: snapshot,
    },
  };
}

async function main(): Promise<void> {
  const sandboxCache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (sandboxCache?.includes("cursor-sandbox-cache")) {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  const opts = parseArgs(process.argv);
  const port = parsePort();
  const spawnedBase = `http://127.0.0.1:${port}/`;
  const base = opts.url ? opts.url.replace(/\/?$/, "/") : spawnedBase;
  const modes = modesToRun(opts.recolor);

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

    browser = await chromium.launch(buildLaunchOptions(opts));
    const pageErrors: string[] = [];
    let firstUrl = "";
    let actions: string[] = [];
    let userAgent = "";
    let renderer = emptyRenderer();
    const profiles: AppProfileFile["profiles"] = {};
    const wantsHardwareGpu = opts.headed || opts.channel !== null;

    for (const mode of modes) {
      const page = await browser.newPage();
      page.on("pageerror", (e) => pageErrors.push(`${mode}: ${String(e)}`));
      const ran = await runOneMode(page, base, opts.hash, opts.hash2, mode);
      firstUrl = ran.firstUrl;
      actions = ran.actions;
      userAgent = ran.userAgent;
      if (mode === "webgl" || renderer.unmaskedRenderer === null) {
        renderer = ran.renderer;
      }
      profiles[mode] = ran.result;
      await page.close();
    }

    if (wantsHardwareGpu && isSoftwareWebGLRenderer(renderer)) {
      throw new Error(
        `Requested a hardware GPU (--headed / --channel) but WebGL renderer is ${JSON.stringify(rendererLabel(renderer))}. Install Google Chrome, pass --channel chrome, and run outside a sandbox.`,
      );
    }

    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    }

    const payload: AppProfileFile = {
      generatedAt: new Date().toISOString(),
      url: firstUrl,
      hash: opts.hash,
      hash2: opts.hash2 !== opts.hash ? opts.hash2 : null,
      actions,
      userAgent,
      headed: opts.headed,
      channel: opts.channel,
      renderer,
      recolor: opts.recolor,
      profiles,
    };

    const json = JSON.stringify(payload, null, 2);
    mkdirSync(path.dirname(opts.outPath), { recursive: true });
    writeFileSync(opts.outPath, json, "utf8");
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, opts.outPath)}\n`);
    process.stderr.write(`WebGL renderer: ${rendererLabel(renderer)}\n`);
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

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

#!/usr/bin/env node
/**
 * Drive a production preview and report lab CLS at Lighthouse mobile plus
 * Argos tablet / medium desktop, with applied (devtools) throttling.
 *
 * Default: `vite build` then `vite preview` on 127.0.0.1 (not Vite serve).
 *
 * Usage:
 *   node scripts/profile/cls-profile.ts
 *   node scripts/profile/cls-profile.ts --preset mobile --url http://127.0.0.1:4173
 *   node scripts/profile/cls-profile.ts --check --repeat 3
 *   node scripts/profile/cls-profile.ts --preset tablet --delay-css-ms 3000
 *
 * Environment:
 *   CLS_PROFILE_PORT — preview (or CSS-delay proxy) port when this script starts the server (default 4179).
 *     With --delay-css-ms, vite preview binds this port + 1.
 *   CHROME_PATH — Chrome binary (CI).
 *
 * @see CLS.md
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http, { type Server, request as httpRequest } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Launcher, launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import {
  nonSimulatedSettingsOverrides,
  throttling,
  userAgents,
} from "lighthouse/core/config/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const DEFAULT_PORT = 4179;
const DEFAULT_REPEAT = 1;
const DEFAULT_OUT = path.join(REPO_ROOT, "tmp", "cls-profile.json");
const DEFAULT_BUDGETS = path.join(
  REPO_ROOT,
  "scripts",
  "profile",
  "cls-budgets.json",
);

export const CLS_PRESET_NAMES = ["mobile", "tablet", "mediumDesktop"] as const;
export type ClsPreset = (typeof CLS_PRESET_NAMES)[number];

/** Headless flags shared local and CI. Do not add --hide-scrollbars. */
export const CLS_CHROME_FLAGS = ["--headless=new", "--no-sandbox"] as const;

export const CLS_ONLY_AUDITS = [
  "cumulative-layout-shift",
  "layout-shifts",
] as const;

export type ScreenEmulationSettings = {
  mobile: boolean;
  width: number;
  height: number;
  deviceScaleFactor: number;
  disabled: boolean;
};

export type LighthousePresetSettings = {
  formFactor: "mobile" | "desktop";
  screenEmulation: ScreenEmulationSettings;
  throttlingMethod: "devtools";
  throttling:
    (typeof throttling)["mobileSlow4G"] | (typeof throttling)["desktopDense4G"];
  emulatedUserAgent: string;
  onlyAudits: readonly string[];
  pauseAfterFcpMs: number;
  pauseAfterLoadMs: number;
  networkQuietThresholdMs: number;
  cpuQuietThresholdMs: number;
};

export type ClsShiftNode = {
  selector: string;
  score: number | null;
  causes: string[];
};

export type ClsSample = {
  numericValue: number;
  score: number | null;
  nodes: ClsShiftNode[];
  lighthouseVersion: string;
  chromeFlags: readonly string[];
  throttlingMethod: "devtools";
  platform: NodeJS.Platform;
  preset: ClsPreset;
  width: number;
  height: number;
  userAgent: string;
};

export type LoadStats = {
  median: number;
  min: number;
  max: number;
  n: number;
};

export type ClsPresetResult = {
  preset: ClsPreset;
  width: number;
  height: number;
  samples: ClsSample[];
  summary: LoadStats;
};

export type ClsProfileFile = {
  generatedAt: string;
  url: string;
  repeat: number;
  delayCssMs: number;
  lighthouseVersion: string;
  chromePath: string;
  chromeFlags: readonly string[];
  throttlingMethod: "devtools";
  platform: NodeJS.Platform;
  presets: ClsPresetResult[];
};

export type BudgetViolation = {
  preset: string;
  actual: number;
  budget: number | null;
  reason: "over-budget" | "missing-result" | "missing-budget";
};

export type CliOpts = {
  outPath: string;
  url: string | null;
  repeat: number;
  check: boolean;
  presets: ClsPreset[];
  saveLhrPath: string | null;
  budgetsPath: string;
  delayCssMs: number;
};

export type ParsedCli = { help: true } | CliOpts;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function usage(): string {
  return [
    "Usage: node scripts/profile/cls-profile.ts [options]",
    "  --url <origin>     Attach to an already-running preview (skips vite build + preview)",
    "  --preset NAME      mobile | tablet | mediumDesktop (default: all three)",
    "  --repeat n         Fresh Lighthouse navigations per preset (default 1)",
    "  --out / --json     Write JSON (default: tmp/cls-profile.json)",
    "  --check            Fail if a preset median exceeds scripts/profile/cls-budgets.json",
    "  --save-lhr <path>  Write the raw LHR JSON (per-preset suffix when running more than one)",
    "  --delay-css-ms n   Delay production main / deferred CSS (assets/*.css) by n ms via a local proxy",
  ].join("\n");
}

export function isClsPreset(name: string): name is ClsPreset {
  return (CLS_PRESET_NAMES as readonly string[]).includes(name);
}

export function parseClsProfilePort(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.CLS_PROFILE_PORT;
  if (raw === undefined || raw === "") {
    return DEFAULT_PORT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `CLS_PROFILE_PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`,
    );
  }
  return n;
}

export function parseArgs(argv: readonly string[]): ParsedCli {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    return { help: true };
  }
  let outPath: string | null = null;
  let url: string | null = null;
  let repeat = DEFAULT_REPEAT;
  let check = false;
  let saveLhrPath: string | null = null;
  let delayCssMs = 0;
  const presets: ClsPreset[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if ((a === "--out" || a === "--json") && next && !next.startsWith("-")) {
      outPath = path.resolve(REPO_ROOT, next);
      i += 1;
    } else if (a === "--url" && next && !next.startsWith("-")) {
      url = next.replace(/\/?$/, "/");
      i += 1;
    } else if (a === "--preset" && next && !next.startsWith("-")) {
      if (!isClsPreset(next)) {
        throw new Error(
          `Unknown --preset ${JSON.stringify(next)} (not a profile:cls flag). ` +
            `Use mobile | tablet | mediumDesktop. lighthouseMobile is a compute-style dump preset.\n${usage()}`,
        );
      }
      if (presets.length > 0) {
        throw new Error(`Only one --preset is allowed\n${usage()}`);
      }
      presets.push(next);
      i += 1;
    } else if (a === "--repeat" && next && !next.startsWith("-")) {
      const n = Number.parseInt(next, 10);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--repeat must be an integer >= 1, got: ${next}`);
      }
      repeat = n;
      i += 1;
    } else if (a === "--save-lhr" && next && !next.startsWith("-")) {
      saveLhrPath = path.resolve(REPO_ROOT, next);
      i += 1;
    } else if (a === "--delay-css-ms" && next && !next.startsWith("-")) {
      const n = Number.parseInt(next, 10);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`--delay-css-ms must be an integer >= 1, got: ${next}`);
      }
      delayCssMs = n;
      i += 1;
    } else if (a === "--check") {
      check = true;
    } else if (
      a === "--out" ||
      a === "--json" ||
      a === "--url" ||
      a === "--preset" ||
      a === "--repeat" ||
      a === "--save-lhr" ||
      a === "--delay-css-ms"
    ) {
      throw new Error(`${a} requires a value\n${usage()}`);
    } else {
      throw new Error(`Unknown argument: ${a}\n${usage()}`);
    }
  }
  return {
    outPath: outPath ?? DEFAULT_OUT,
    url,
    repeat,
    check,
    presets: presets.length > 0 ? presets : [...CLS_PRESET_NAMES],
    saveLhrPath,
    budgetsPath: DEFAULT_BUDGETS,
    delayCssMs,
  };
}

export function lighthouseSettingsForPreset(
  preset: ClsPreset,
): LighthousePresetSettings {
  const pauses = nonSimulatedSettingsOverrides;
  const common = {
    throttlingMethod: "devtools" as const,
    onlyAudits: CLS_ONLY_AUDITS,
    pauseAfterFcpMs: pauses.pauseAfterFcpMs,
    pauseAfterLoadMs: pauses.pauseAfterLoadMs,
    networkQuietThresholdMs: pauses.networkQuietThresholdMs,
    cpuQuietThresholdMs: pauses.cpuQuietThresholdMs,
    screenEmulation: {
      disabled: false,
    },
  };
  if (preset === "mobile") {
    return {
      ...common,
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 1.75,
        disabled: false,
      },
      throttling: throttling.mobileSlow4G,
      emulatedUserAgent: userAgents.mobile,
    };
  }
  const desktop =
    preset === "tablet"
      ? { width: 834, height: 1112 }
      : { width: 1440, height: 900 };
  return {
    ...common,
    formFactor: "desktop",
    screenEmulation: {
      mobile: false,
      width: desktop.width,
      height: desktop.height,
      deviceScaleFactor: 1,
      disabled: false,
    },
    throttling: throttling.desktopDense4G,
    emulatedUserAgent: userAgents.desktop,
  };
}

function nodeSelector(node: unknown): string {
  if (!isRecord(node)) {
    return "";
  }
  if (typeof node.selector === "string" && node.selector !== "") {
    return node.selector;
  }
  if (typeof node.nodeLabel === "string" && node.nodeLabel !== "") {
    return node.nodeLabel;
  }
  if (typeof node.snippet === "string") {
    return node.snippet;
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  return "";
}

function causeText(cause: unknown): string {
  if (typeof cause === "string") {
    return cause;
  }
  if (isRecord(cause) && typeof cause.formattedDefault === "string") {
    return cause.formattedDefault;
  }
  if (isRecord(cause) && typeof cause.value === "string") {
    return cause.value;
  }
  return "";
}

function shiftNodesFromTableItems(items: unknown[]): ClsShiftNode[] {
  const nodes: ClsShiftNode[] = [];
  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const selector = nodeSelector(item.node);
    const score =
      typeof item.score === "number" && Number.isFinite(item.score)
        ? item.score
        : null;
    const causes: string[] = [];
    if (isRecord(item.subItems) && Array.isArray(item.subItems.items)) {
      for (const sub of item.subItems.items) {
        if (!isRecord(sub)) {
          continue;
        }
        const text = causeText(sub.cause);
        if (text) {
          causes.push(text);
        }
      }
    }
    if (selector !== "" || score !== null) {
      nodes.push({ selector, score, causes });
    }
  }
  return nodes;
}

function extractShiftNodes(details: unknown): ClsShiftNode[] {
  if (!isRecord(details)) {
    return [];
  }
  if (details.type === "table" && Array.isArray(details.items)) {
    return shiftNodesFromTableItems(details.items);
  }
  if (details.type === "list" && Array.isArray(details.items)) {
    const nodes: ClsShiftNode[] = [];
    for (const inner of details.items) {
      if (isRecord(inner) && Array.isArray(inner.items)) {
        nodes.push(...shiftNodesFromTableItems(inner.items));
      }
    }
    return nodes;
  }
  return [];
}

export type LhrLike = {
  lighthouseVersion?: string;
  userAgent?: string;
  runtimeError?: { code?: string; message?: string };
  environment?: { hostUserAgent?: string };
  audits?: Record<
    string,
    {
      numericValue?: number | null;
      score?: number | null;
      details?: unknown;
    }
  >;
};

function requireFiniteCls(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `cumulative-layout-shift.numericValue missing or not finite: ${String(value)}`,
    );
  }
  return value;
}

export function extractClsSample(
  lhr: LhrLike,
  preset: ClsPreset,
  settings: LighthousePresetSettings,
): ClsSample {
  if (lhr.runtimeError) {
    throw new Error(
      `Lighthouse runtimeError: ${lhr.runtimeError.message ?? lhr.runtimeError.code}`,
    );
  }
  const clsAudit = lhr.audits?.["cumulative-layout-shift"];
  if (!clsAudit) {
    throw new Error(
      "Lighthouse result is missing the cumulative-layout-shift audit",
    );
  }
  const numericValue = requireFiniteCls(clsAudit.numericValue);
  const layoutShifts = lhr.audits?.["layout-shifts"];
  const insight = lhr.audits?.["cls-culprits-insight"];
  let nodes: ClsShiftNode[] = [];
  if (layoutShifts?.details !== undefined) {
    nodes = extractShiftNodes(layoutShifts.details);
  } else if (insight?.details !== undefined) {
    nodes = extractShiftNodes(insight.details);
  }
  return {
    numericValue,
    score: typeof clsAudit.score === "number" ? clsAudit.score : null,
    nodes,
    lighthouseVersion: lhr.lighthouseVersion ?? "unknown",
    chromeFlags: CLS_CHROME_FLAGS,
    throttlingMethod: "devtools",
    platform: process.platform,
    preset,
    width: settings.screenEmulation.width,
    height: settings.screenEmulation.height,
    userAgent: lhr.userAgent ?? lhr.environment?.hostUserAgent ?? "",
  };
}

export function summarizeRepeats(values: number[]): LoadStats {
  if (values.length === 0) {
    throw new Error("summarizeRepeats of empty list");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]!
      : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return {
    median,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    n: values.length,
  };
}

export function parseBudgetsJson(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) {
    throw new Error("cls-budgets.json must be an object");
  }
  const unknownKeys = Object.keys(raw).filter((k) => !isClsPreset(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `cls-budgets.json has unknown preset key(s): ${unknownKeys.join(", ")}`,
    );
  }
  const out: Record<string, number> = {};
  for (const [name, v] of Object.entries(raw)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      throw new Error(
        `cls-budgets.json ${name} must be a finite number >= 0, got ${String(v)}`,
      );
    }
    out[name] = v;
  }
  return out;
}

export function checkClsAgainstBudgets(
  results: readonly Pick<ClsPresetResult, "preset" | "summary">[],
  budgets: Record<string, number>,
): BudgetViolation[] {
  const unknownKeys = Object.keys(budgets).filter((k) => !isClsPreset(k));
  if (unknownKeys.length > 0) {
    throw new Error(
      `cls-budgets.json has unknown preset key(s): ${unknownKeys.join(", ")}`,
    );
  }
  const violations: BudgetViolation[] = [];
  const byPreset = new Map(results.map((r) => [r.preset, r]));
  for (const name of CLS_PRESET_NAMES) {
    const budget = budgets[name];
    const result = byPreset.get(name);
    if (budget === undefined) {
      violations.push({
        preset: name,
        actual: result?.summary.median ?? NaN,
        budget: null,
        reason: "missing-budget",
      });
      continue;
    }
    if (!result) {
      violations.push({
        preset: name,
        actual: NaN,
        budget,
        reason: "missing-result",
      });
      continue;
    }
    if (result.summary.median > budget) {
      violations.push({
        preset: name,
        actual: result.summary.median,
        budget,
        reason: "over-budget",
      });
    }
  }
  return violations;
}

function loadPageUrl(base: string): string {
  const u = new URL(base);
  u.searchParams.set("debug", "false");
  u.hash = "";
  return u.href;
}

/** Production CSS linked from index.html or the deferred chunk filename pattern. */
export function shouldDelayStylesheetPath(pathname: string): boolean {
  return (
    /\/assets\/main-[^/]+\.css$/i.test(pathname) ||
    /\/assets\/load-deferred-styles-[^/]+\.css$/i.test(pathname)
  );
}

export function upstreamPortForProxy(publicPort: number): number {
  return publicPort + 1;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function startCssDelayProxy(options: {
  listenPort: number;
  upstreamOrigin: string;
  delayCssMs: number;
}): Promise<Server> {
  const upstream = new URL(options.upstreamOrigin);
  return new Promise((resolve, reject) => {
    const server = http.createServer((clientReq, clientRes) => {
      void (async () => {
        try {
          const reqPath = clientReq.url ?? "/";
          const reqUrl = new URL(reqPath, options.upstreamOrigin);
          if (shouldDelayStylesheetPath(reqUrl.pathname)) {
            await sleep(options.delayCssMs);
          }
          const proxyReq = httpRequest(
            {
              hostname: upstream.hostname,
              port:
                upstream.port || (upstream.protocol === "https:" ? 443 : 80),
              path: `${reqUrl.pathname}${reqUrl.search}`,
              method: clientReq.method,
              headers: clientReq.headers,
            },
            (proxyRes) => {
              clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
              proxyRes.pipe(clientRes);
            },
          );
          proxyReq.on("error", (err) => {
            if (!clientRes.headersSent) {
              clientRes.writeHead(502);
            }
            clientRes.end(String(err));
          });
          clientReq.pipe(proxyReq);
        } catch (err) {
          if (!clientRes.headersSent) {
            clientRes.writeHead(500);
          }
          clientRes.end(String(err));
        }
      })();
    });
    server.on("error", reject);
    server.listen(options.listenPort, "127.0.0.1", () => resolve(server));
  });
}

async function waitForHttpOk(url: string, maxMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for preview: ${url}`);
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

async function resolveChromePath(): Promise<string> {
  const env = process.env.CHROME_PATH;
  if (env !== undefined && env !== "") {
    return env;
  }
  const installed = Launcher.getFirstInstallation();
  if (installed) {
    return installed;
  }
  const { chromium } = await import("playwright");
  return chromium.executablePath();
}

function saveLhrPathForPreset(
  basePath: string,
  preset: ClsPreset,
  presetCount: number,
): string {
  if (presetCount === 1) {
    return basePath;
  }
  const ext = path.extname(basePath);
  const stem = ext ? basePath.slice(0, -ext.length) : basePath;
  return `${stem}-${preset}${ext || ".json"}`;
}

function formatClsTable(
  file: ClsProfileFile,
  budgets: Record<string, number> | null,
): string {
  const rows = file.presets.map((p) => {
    const budget = budgets?.[p.preset];
    const over =
      budget !== undefined && p.summary.median > budget ? "over" : "ok";
    return {
      preset: p.preset,
      median: p.summary.median.toFixed(3),
      min: p.summary.min.toFixed(3),
      max: p.summary.max.toFixed(3),
      budget: budget === undefined ? "—" : budget.toFixed(3),
      status: budget === undefined ? "" : over,
    };
  });
  const w = {
    preset: Math.max(8, ...rows.map((r) => r.preset.length)),
    median: 8,
    min: 8,
    max: 8,
    budget: 8,
    status: 6,
  };
  const pad = (s: string, n: number, right = false): string =>
    s.length >= n
      ? s
      : right
        ? " ".repeat(n - s.length) + s
        : s + " ".repeat(n - s.length);
  const header =
    budgets === null
      ? `  ${pad("preset", w.preset)}  ${pad("median", w.median, true)}  ${pad("min", w.min, true)}  ${pad("max", w.max, true)}`
      : `  ${pad("preset", w.preset)}  ${pad("median", w.median, true)}  ${pad("min", w.min, true)}  ${pad("max", w.max, true)}  ${pad("budget", w.budget, true)}  ${pad("status", w.status)}`;
  const sep =
    budgets === null
      ? `  ${"-".repeat(w.preset)}  ${"-".repeat(w.median)}  ${"-".repeat(w.min)}  ${"-".repeat(w.max)}`
      : `  ${"-".repeat(w.preset)}  ${"-".repeat(w.median)}  ${"-".repeat(w.min)}  ${"-".repeat(w.max)}  ${"-".repeat(w.budget)}  ${"-".repeat(w.status)}`;
  const body = rows.map((r) =>
    budgets === null
      ? `  ${pad(r.preset, w.preset)}  ${pad(r.median, w.median, true)}  ${pad(r.min, w.min, true)}  ${pad(r.max, w.max, true)}`
      : `  ${pad(r.preset, w.preset)}  ${pad(r.median, w.median, true)}  ${pad(r.min, w.min, true)}  ${pad(r.max, w.max, true)}  ${pad(r.budget, w.budget, true)}  ${pad(r.status, w.status)}`,
  );
  return [
    `CLS profile (devtools throttling, n=${file.repeat})`,
    header,
    sep,
    ...body,
  ].join("\n");
}

async function runLighthouseOnUrl(
  url: string,
  port: number,
  preset: ClsPreset,
): Promise<{ sample: ClsSample; lhr: LhrLike }> {
  const settings = lighthouseSettingsForPreset(preset);
  const result = await lighthouse(url, {
    port,
    logLevel: "error",
    output: "json",
    onlyAudits: [...settings.onlyAudits],
    formFactor: settings.formFactor,
    screenEmulation: settings.screenEmulation,
    throttlingMethod: settings.throttlingMethod,
    throttling: settings.throttling,
    emulatedUserAgent: settings.emulatedUserAgent,
    pauseAfterFcpMs: settings.pauseAfterFcpMs,
    pauseAfterLoadMs: settings.pauseAfterLoadMs,
    networkQuietThresholdMs: settings.networkQuietThresholdMs,
    cpuQuietThresholdMs: settings.cpuQuietThresholdMs,
  });
  if (result === undefined) {
    throw new Error(`Lighthouse returned no result for ${preset}`);
  }
  const lhr = result.lhr as LhrLike;
  return { sample: extractClsSample(lhr, preset, settings), lhr };
}

export async function main(
  argv: readonly string[] = process.argv,
): Promise<number> {
  const sandboxCache = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (sandboxCache?.includes("cursor-sandbox-cache")) {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }

  const parsed = parseArgs(argv);
  if ("help" in parsed) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const opts: CliOpts = parsed;
  const port = parseClsProfilePort();
  const proxyPort = port;
  const previewPort = opts.delayCssMs > 0 ? upstreamPortForProxy(port) : port;
  const upstreamBase = opts.url ?? `http://127.0.0.1:${previewPort}/`;
  const measuredBase =
    opts.delayCssMs > 0 ? `http://127.0.0.1:${proxyPort}/` : upstreamBase;
  const url = loadPageUrl(measuredBase);

  let preview: ChildProcess | undefined;
  let proxy: Server | undefined;
  let chrome: Awaited<ReturnType<typeof launch>> | undefined;
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
          String(previewPort),
          "--strictPort",
        ],
        {
          cwd: REPO_ROOT,
          stdio: "ignore",
          shell: process.platform === "win32",
        },
      );
      await waitForHttpOk(upstreamBase.replace(/\/?$/, "/"), 120000);
    }

    if (opts.delayCssMs > 0) {
      process.stderr.write(
        `CSS delay proxy: ${opts.delayCssMs} ms on main / deferred stylesheets → ${measuredBase}\n`,
      );
      proxy = await startCssDelayProxy({
        listenPort: proxyPort,
        upstreamOrigin: upstreamBase.replace(/\/?$/, "/"),
        delayCssMs: opts.delayCssMs,
      });
      await waitForHttpOk(measuredBase, 120000);
    }

    const chromePath = await resolveChromePath();
    process.stderr.write(`Chrome: ${chromePath}\n`);
    chrome = await launch({
      chromePath,
      chromeFlags: [...CLS_CHROME_FLAGS],
    });

    const presetResults: ClsPresetResult[] = [];
    let lighthouseVersion = "";
    for (const preset of opts.presets) {
      const samples: ClsSample[] = [];
      for (let i = 0; i < opts.repeat; i++) {
        process.stderr.write(`${preset} navigation ${i + 1}/${opts.repeat}…\n`);
        const { sample, lhr } = await runLighthouseOnUrl(
          url,
          chrome.port,
          preset,
        );
        samples.push(sample);
        if (!lighthouseVersion) {
          lighthouseVersion = sample.lighthouseVersion;
        }
        if (opts.saveLhrPath) {
          const out = saveLhrPathForPreset(
            opts.saveLhrPath,
            preset,
            opts.presets.length,
          );
          mkdirSync(path.dirname(out), { recursive: true });
          writeFileSync(out, `${JSON.stringify(lhr, null, 2)}\n`, "utf8");
          process.stderr.write(`Wrote LHR ${path.relative(REPO_ROOT, out)}\n`);
        }
      }
      const settings = lighthouseSettingsForPreset(preset);
      presetResults.push({
        preset,
        width: settings.screenEmulation.width,
        height: settings.screenEmulation.height,
        samples,
        summary: summarizeRepeats(samples.map((s) => s.numericValue)),
      });
    }

    const file: ClsProfileFile = {
      generatedAt: new Date().toISOString(),
      url,
      repeat: opts.repeat,
      delayCssMs: opts.delayCssMs,
      lighthouseVersion,
      chromePath,
      chromeFlags: CLS_CHROME_FLAGS,
      throttlingMethod: "devtools",
      platform: process.platform,
      presets: presetResults,
    };

    mkdirSync(path.dirname(opts.outPath), { recursive: true });
    writeFileSync(opts.outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, opts.outPath)}\n`);

    if (opts.check) {
      let budgets: Record<string, number>;
      try {
        budgets = parseBudgetsJson(
          JSON.parse(readFileSync(opts.budgetsPath, "utf8")) as unknown,
        );
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          err.code === "ENOENT"
        ) {
          throw new Error(
            `Missing ${path.relative(REPO_ROOT, opts.budgetsPath)} (needed for --check)`,
            { cause: err },
          );
        }
        throw err;
      }
      process.stdout.write(`${formatClsTable(file, budgets)}\n`);
      const violations = checkClsAgainstBudgets(presetResults, budgets);
      if (violations.length > 0) {
        for (const v of violations) {
          process.stderr.write(
            `${v.preset}: ${v.reason} actual=${v.actual} budget=${String(v.budget)}\n`,
          );
        }
        return 1;
      }
      process.stdout.write("CLS budgets ok.\n");
      return 0;
    }

    process.stdout.write(`${formatClsTable(file, null)}\n`);
    return 0;
  } finally {
    chrome?.kill();
    preview?.kill("SIGTERM");
    if (proxy) {
      await closeServer(proxy).catch(() => undefined);
    }
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().then(
    (code) => {
      if (code !== 0) {
        process.exit(code);
      }
    },
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    },
  );
}

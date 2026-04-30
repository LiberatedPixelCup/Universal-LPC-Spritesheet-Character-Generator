/**
 * Capture ZIP export phase timings (issue #382 fixture) without manual console copy/paste.
 *
 * Starts a static server, opens Chromium with the profile runner page, writes JSON
 * under `tmp/` by default, and prints the same JSON to stdout.
 *
 * Usage:
 *   node scripts/zip/zip-export-profile.js
 *   node scripts/zip/zip-export-profile.js --quick
 *   node scripts/zip/zip-export-profile.js --only splitAnimations
 *   node scripts/zip/zip-export-profile.js --out custom/path.json
 *
 * Environment:
 *   ZIP_PROFILE_PORT — TCP port for `npx serve` (default 9877).
 *
 * @see scripts/zip/zip-export-profile-runner.html
 * @see scripts/zip/zip-export-profile-runner.js
 */

/* eslint-disable no-undef -- Playwright page callbacks run in browser context */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { ZIP_PROFILE_DEFAULT_HASH } from "./zip-profile-default-hash.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const EXPORT_KINDS = new Set([
  "splitAnimations",
  "splitItemSheets",
  "splitItemAnimations",
  "individualFrames",
]);

const SERVE_PORT = (() => {
  const raw = process.env.ZIP_PROFILE_PORT;
  if (raw === undefined || raw === "") {
    return 9877;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `ZIP_PROFILE_PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`,
    );
  }
  return n;
})();

const BASE_URL = `http://127.0.0.1:${SERVE_PORT}`;

function parseArgs(argv) {
  const args = argv.slice(2);
  const quick = args.includes("--quick");
  let outPath = null;
  const outIdx = args.indexOf("--out");
  if (outIdx !== -1 && args[outIdx + 1]) {
    outPath = path.resolve(REPO_ROOT, args[outIdx + 1]);
  }
  let only = null;
  const onlyIdx = args.indexOf("--only");
  if (onlyIdx !== -1 && args[onlyIdx + 1]) {
    only = args[onlyIdx + 1];
    if (!EXPORT_KINDS.has(only)) {
      throw new Error(`--only must be one of: ${[...EXPORT_KINDS].join(", ")}`);
    }
  }
  const defaultOut = path.join(
    REPO_ROOT,
    "tmp",
    quick ? "zip-export-profile-quick.json" : "zip-export-profile.json",
  );
  if (!outPath) {
    outPath = defaultOut;
  }
  return { quick, outPath, only };
}

async function main() {
  const { quick, outPath, only } = parseArgs(process.argv);

  const serve = spawn("npx", ["serve", REPO_ROOT, "-l", String(SERVE_PORT)], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  let browser;
  try {
    await waitForHttpOk(`${BASE_URL}/`, 30000);

    const qs = new URLSearchParams();
    qs.set("debug", "true");
    if (quick) qs.set("quick", "1");
    if (only) qs.set("only", only);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    /**
     * `serve` redirects `…/runner.html?…` to a clean URL and drops the query
     * string, so URL params are unreliable. Inject CLI options before load.
     */
    await page.addInitScript(
      ({ quick: q, only: o, profileHash: ph }) => {
        window.__ZIP_PROFILE_OPTS__ = {
          quick: q,
          only: o,
          profileHash: ph,
        };
      },
      { quick, only: only ?? null, profileHash: ZIP_PROFILE_DEFAULT_HASH },
    );

    await page.goto(
      `${BASE_URL}/scripts/zip/zip-export-profile-runner.html?${qs.toString()}#${ZIP_PROFILE_DEFAULT_HASH}`,
      {
        waitUntil: "networkidle",
        timeout: 120000,
      },
    );

    await page.waitForFunction(() => window.__ZIP_PROFILE_READY__ === true, {
      timeout: 600000,
    });

    const errText = await page.evaluate(() => window.__ZIP_PROFILE_ERROR__);
    if (errText) {
      throw new Error(`Profile runner failed: ${errText}`);
    }

    const data = await page.evaluate(() => window.__ZIP_PROFILE_DATA__);
    if (!data) {
      throw new Error("Profile capture failed: no __ZIP_PROFILE_DATA__");
    }
    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      selectionLabel: data.selectionLabel,
      /** CLI `quick` mode uses fake JSZip; keep in sync with runner. */
      useRealJsZip: !quick,
      quickMode: quick,
      only: data.only,
      profiles: data.profiles,
    };

    const json = JSON.stringify(payload, null, 2);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, json, "utf8");
    process.stderr.write(`Wrote ${path.relative(REPO_ROOT, outPath)}\n`);
    process.stdout.write(`${json}\n`);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    serve.kill("SIGTERM");
  }
}

async function waitForHttpOk(url, maxMs) {
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
  throw new Error(`Timeout waiting for dev server: ${url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

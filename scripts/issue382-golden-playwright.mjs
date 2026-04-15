/**
 * Headless browser capture of sorted zip paths for issue #382 fixtures.
 * Invoked by scripts/fixture-builder.js after tests/fixtures/issue-382-itemdata.js
 * and issue-382-selections.js are written.
 *
 * Why Playwright
 * --------------
 * Zip layout depends on `renderCharacter`, canvas, `loadImage`, and `zip.js` — all
 * browser-oriented. This script runs the same modules as `tests/state/zip-issue-382_spec.js`
 * in Chromium and writes path snapshots. See `scripts/fixture-builder.js` for rationale.
 *
 * Snapshots vs bugs
 * -----------------
 * These files record **whatever paths the current code produces**. Regenerating after
 * a regression **bakes the regression into** `tests/fixtures/issue-382/issue-382-zip-paths-*.js`;
 * tests will still pass. Use code review when golden files change; combine with
 * non-snapshot tests for critical invariants (see fixture-builder.js header).
 *
 * @see scripts/fixture-builder.js
 * @see issue382-golden-runner.html
 *
 * Environment
 * -----------
 * - **ISSUE382_GOLDEN_PORT** — TCP port for `npx serve` (default `9876`). Change if the port is busy.
 */

/* eslint-disable no-undef -- page.evaluate / waitForFunction callbacks execute in the browser */
import { spawn } from "child_process";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const FIXTURES_DIR = path.join(REPO_ROOT, "tests", "fixtures", "issue-382");

const SERVE_PORT = (() => {
  const raw = process.env.ISSUE382_GOLDEN_PORT;
  if (raw === undefined || raw === "") {
    return 9876;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(
      `ISSUE382_GOLDEN_PORT must be an integer 1–65535, got: ${JSON.stringify(raw)}`,
    );
  }
  return n;
})();
const BASE_URL = `http://127.0.0.1:${SERVE_PORT}`;

function formatGoldenModule({ title, paths, inputRelativeToRepo }) {
  return `/**
 * ${title}
 *
 * Regenerate (writes this file and sibling issue-382 fixtures):
 *   node scripts/fixture-builder.js ${inputRelativeToRepo}
 *
 * Snapshot: encodes current export behavior — review diffs; do not regenerate blindly
 * after a suspected bug without verifying output (see scripts/fixture-builder.js).
 *
 * @see scripts/fixture-builder.js
 * @see scripts/issue382-golden-playwright.mjs
 * @see issue382-golden-runner.html
 */

/** Sorted zip entry paths for regression tests (issue #382). */
export const paths = ${JSON.stringify(paths, null, 2)};
`;
}

export async function generateIssue382GoldenZipFixtures(inputRelativeToRepo) {
  const serve = spawn("npx", ["serve", REPO_ROOT, "-l", String(SERVE_PORT)], {
    cwd: REPO_ROOT,
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  let browser;
  try {
    await waitForHttpOk(`${BASE_URL}/`, 30000);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));

    await page.goto(
      `${BASE_URL}/tests/fixtures/issue-382/issue382-golden-runner.html`,
      {
        waitUntil: "networkidle",
        timeout: 120000,
      },
    );

    await page.waitForFunction(
      () => window.__ISSUE382_GOLDEN_READY__ === true,
      undefined,
      { timeout: 180000 },
    );

    const errText = await page.evaluate(() => window.__ISSUE382_GOLDEN_ERROR__);
    if (errText) {
      throw new Error(`Golden runner failed: ${errText}`);
    }

    const goldens = await page.evaluate(() => window.__ISSUE382_GOLDEN__);
    if (!goldens) {
      throw new Error("Golden capture failed: no data");
    }
    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    }

    const files = [
      {
        title: "exportSplitAnimations — sorted zip paths",
        key: "splitAnimations",
        out: "issue-382-zip-paths-split-animations.js",
      },
      {
        title: "exportSplitItemSheets — sorted zip paths",
        key: "splitItemSheets",
        out: "issue-382-zip-paths-split-item-sheets.js",
      },
      {
        title: "exportSplitItemAnimations — sorted zip paths",
        key: "splitItemAnimations",
        out: "issue-382-zip-paths-split-item-animations.js",
      },
      {
        title: "exportIndividualFrames — sorted zip paths",
        key: "individualFrames",
        out: "issue-382-zip-paths-individual-frames.js",
      },
    ];

    for (const { title, key, out } of files) {
      const outPath = path.join(FIXTURES_DIR, out);
      writeFileSync(
        outPath,
        formatGoldenModule({
          title,
          paths: goldens[key],
          inputRelativeToRepo,
        }),
        "utf8",
      );
    }
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

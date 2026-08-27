import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";

import { VIEWPORT_PRESETS } from "../../../../scripts/computed-style/computed-style-dump-shared.ts";
import {
  CLS_CHROME_FLAGS,
  CLS_CI_DELAYED_PROFILE_PORT,
  CLS_CI_DELAY_CSS_MS,
  CLS_ONLY_AUDITS,
  CLS_PRESET_NAMES,
  assertDelayedStylesheetHits,
  assertSkipBuildDist,
  checkClsAgainstBudgets,
  cssDelayProxyListenPort,
  extractClsSample,
  hostHeaderForUpstream,
  lighthouseSettingsForPreset,
  loadBudgetsOrThrow,
  originPort,
  parseArgs,
  parseBudgetsJson,
  parseClsProfilePort,
  saveLhrPathForPreset,
  shouldDelayStylesheetPath,
  stopChildProcess,
  stopLaunchedChrome,
  summarizeRepeats,
  upstreamPortForProxy,
  waitForHttpOk,
  type ClsPresetResult,
  type LhrLike,
} from "../../../../scripts/profile/cls-profile.ts";

const FIXTURE = fileURLToPath(
  new URL("../../../fixtures/lighthouse/lhr-delayed.json", import.meta.url),
);

/**
 * Trimmed real LHR from a local `--delay-css-ms` run at `--preset tablet`.
 * Extraction is preset-independent, so the presets asserted below are the
 * extractor's input, not the dump's. Its CLS is neither a CI median nor a
 * budget reference.
 */
function readFixtureLhr(): LhrLike {
  return JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as LhrLike;
}

test("parseArgs defaults", () => {
  const opts = parseArgs(["node", "cls-profile.ts"]);
  assert.equal("help" in opts && opts.help, false);
  if ("help" in opts) {
    return;
  }
  assert.deepEqual(opts.presets, [...CLS_PRESET_NAMES]);
  assert.equal(opts.check, false);
  assert.equal(opts.repeat, 1);
  assert.equal(opts.url, null);
  assert.ok(opts.outPath.endsWith(`${path.sep}tmp${path.sep}cls-profile.json`));
  assert.equal(opts.saveLhrPath, null);
  assert.equal(opts.delayCssMs, 0);
  assert.equal(opts.skipBuild, false);
  assert.ok(
    opts.budgetsPath.endsWith(
      `${path.sep}scripts${path.sep}profile${path.sep}cls-budgets.json`,
    ),
  );
});

test("parseArgs --preset restricts to one viewport", () => {
  for (const name of CLS_PRESET_NAMES) {
    const opts = parseArgs(["node", "cls-profile.ts", "--preset", name]);
    assert.ok(!("help" in opts));
    if ("help" in opts) {
      return;
    }
    assert.deepEqual(opts.presets, [name]);
  }
});

test("parseArgs --check --preset tablet is a one-viewport check", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--check",
    "--preset",
    "tablet",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.check, true);
  assert.deepEqual(opts.presets, ["tablet"]);
});

test("parseArgs unknown --preset throws", () => {
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--preset", "hugeDesktop"]),
    /hugeDesktop/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--preset", "desktop"]),
    /desktop/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--preset", "lighthouseMobile"]),
    /lighthouseMobile/,
  );
});

test("parseArgs --url trailing slash, --out, --repeat, --check, --save-lhr", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--url",
    "http://127.0.0.1:4173",
    "--out",
    "tmp/custom.json",
    "--repeat",
    "3",
    "--check",
    "--save-lhr",
    "tmp/lhr.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.url, "http://127.0.0.1:4173/");
  assert.ok(opts.outPath.endsWith(`${path.sep}tmp${path.sep}custom.json`));
  assert.equal(opts.repeat, 3);
  assert.equal(opts.check, true);
  assert.ok(opts.saveLhrPath?.endsWith(`${path.sep}tmp${path.sep}lhr.json`));
});

test("parseArgs --json is an alias of --out", () => {
  const opts = parseArgs(["node", "cls-profile.ts", "--json", "tmp/a.json"]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.ok(opts.outPath.endsWith(`${path.sep}tmp${path.sep}a.json`));
});

test("parseArgs --delay-css-ms", () => {
  const opts = parseArgs(["node", "cls-profile.ts", "--delay-css-ms", "3000"]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.delayCssMs, 3000);
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--delay-css-ms", "0"]),
    /--delay-css-ms/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--delay-css-ms"]),
    /--delay-css-ms requires a value/,
  );
});

test("shouldDelayStylesheetPath matches any hashed /assets/*.css", () => {
  assert.equal(shouldDelayStylesheetPath("/assets/main-D4rbq9Ei.css"), true);
  assert.equal(
    shouldDelayStylesheetPath("/assets/load-deferred-styles-L0fhUdhH.css"),
    true,
  );
  assert.equal(
    shouldDelayStylesheetPath("/assets/critical-entry-AbCd1234.css"),
    true,
  );
  assert.equal(shouldDelayStylesheetPath("/assets/index-xyz.css"), true);
  assert.equal(shouldDelayStylesheetPath("/assets/vendor-D5qM2qLl.js"), false);
  assert.equal(
    shouldDelayStylesheetPath("/assets/main-D4rbq9Ei.css.map"),
    false,
  );
  assert.equal(shouldDelayStylesheetPath("/sources/styles/main.css"), false);
  assert.equal(shouldDelayStylesheetPath("/"), false);
  assert.equal(
    shouldDelayStylesheetPath("/assets/main-D4rbq9Ei.css?v=1"),
    false,
  );
});

test("assertDelayedStylesheetHits fails closed when delay matched nothing", () => {
  assertDelayedStylesheetHits(0, 0);
  assertDelayedStylesheetHits(3000, 2);
  assert.throws(
    () => assertDelayedStylesheetHits(3000, 0),
    /matched 0 stylesheets/,
  );
});

test("stopLaunchedChrome awaits kill and no-ops when undefined", async () => {
  await stopLaunchedChrome(undefined);
  let killed = false;
  await stopLaunchedChrome({
    kill: async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
      killed = true;
    },
  });
  assert.equal(killed, true);
});

test("upstreamPortForProxy is public port + 1", () => {
  assert.equal(upstreamPortForProxy(4179), 4180);
});

test("originPort reads explicit and default ports", () => {
  assert.equal(originPort("http://127.0.0.1:4173/"), 4173);
  assert.equal(originPort("http://127.0.0.1:4179/"), 4179);
  assert.equal(originPort("http://example.com/"), 80);
  assert.equal(originPort("not a url"), null);
});

test("cssDelayProxyListenPort avoids colliding with --url", () => {
  assert.equal(cssDelayProxyListenPort(4179, null), 4179);
  assert.equal(cssDelayProxyListenPort(4179, "http://127.0.0.1:4173/"), 4179);
  assert.equal(cssDelayProxyListenPort(4179, "http://127.0.0.1:4179/"), 4180);
});

test("hostHeaderForUpstream matches the preview port, not the proxy", () => {
  assert.equal(
    hostHeaderForUpstream("http://127.0.0.1:4180/"),
    "127.0.0.1:4180",
  );
  assert.equal(
    hostHeaderForUpstream("http://127.0.0.1:4173/"),
    "127.0.0.1:4173",
  );
  assert.equal(hostHeaderForUpstream("http://127.0.0.1/"), "127.0.0.1");
});

test("parseArgs --repeat 0 and non-integers throw", () => {
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--repeat", "0"]),
    /--repeat/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--repeat", "nope"]),
    /--repeat/,
  );
});

test("parseArgs --help does not exit", () => {
  const opts = parseArgs(["node", "cls-profile.ts", "--help"]);
  assert.deepEqual(opts, { help: true });
  const opts2 = parseArgs(["node", "cls-profile.ts", "-h"]);
  assert.deepEqual(opts2, { help: true });
});

test("saveLhrPathForPreset is unchanged for one preset", () => {
  assert.equal(
    saveLhrPathForPreset("/tmp/lhr.json", "mobile", 1),
    "/tmp/lhr.json",
  );
});

test("saveLhrPathForPreset suffixes the preset when running more than one", () => {
  assert.equal(
    saveLhrPathForPreset("/tmp/lhr.json", "mobile", 3),
    "/tmp/lhr-mobile.json",
  );
  assert.equal(
    saveLhrPathForPreset("/tmp/lhr.json", "tablet", 3),
    "/tmp/lhr-tablet.json",
  );
  assert.equal(
    saveLhrPathForPreset("/tmp/lhr", "mediumDesktop", 2),
    "/tmp/lhr-mediumDesktop.json",
  );
});

test("parseArgs unknown flag and missing values throw", () => {
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--nope"]),
    /Unknown argument/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--save-lhr"]),
    /requires a value/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--url"]),
    /requires a value/,
  );
  assert.throws(
    () => parseArgs(["node", "cls-profile.ts", "--budgets"]),
    /requires a value/,
  );
});

test("parseArgs --budgets with --check resolves under the repo root", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--check",
    "--budgets",
    "tmp/other-budgets.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.check, true);
  assert.equal(opts.delayCssMs, 0);
  assert.ok(
    opts.budgetsPath.endsWith(`${path.sep}tmp${path.sep}other-budgets.json`),
  );
});

test("parseArgs --budgets does not imply --check", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--budgets",
    "scripts/profile/cls-budgets.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.check, false);
  assert.ok(
    opts.budgetsPath.endsWith(
      `${path.sep}scripts${path.sep}profile${path.sep}cls-budgets.json`,
    ),
  );
});

test("CLS_CI_DELAY_CSS_MS is the delayed CI pin", () => {
  assert.equal(CLS_CI_DELAY_CSS_MS, 3000);
});

test("parseArgs delayed script shape matches profile:cls:delayed", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--delay-css-ms",
    String(CLS_CI_DELAY_CSS_MS),
    "--out",
    "tmp/cls-profile-delayed.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.delayCssMs, CLS_CI_DELAY_CSS_MS);
  assert.equal(opts.check, false);
  assert.ok(opts.outPath.endsWith(`${path.sep}cls-profile-delayed.json`));
  assert.ok(
    opts.budgetsPath.endsWith(
      `${path.sep}scripts${path.sep}profile${path.sep}cls-budgets.json`,
    ),
  );
});

test("parseArgs baseline delayed script shape", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--delay-css-ms",
    String(CLS_CI_DELAY_CSS_MS),
    "--out",
    "tmp/baseline-cls-profile-delayed.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.delayCssMs, CLS_CI_DELAY_CSS_MS);
  assert.ok(
    opts.outPath.endsWith(`${path.sep}baseline-cls-profile-delayed.json`),
  );
});

test("package.json delayed scripts match CLS_CI_DELAY_CSS_MS", () => {
  const pkgPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../package.json",
  );
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    scripts: Record<string, string>;
  };
  const delayFlag = `--delay-css-ms ${String(CLS_CI_DELAY_CSS_MS)}`;
  const delayed = pkg.scripts["profile:cls:delayed"];
  const baselineDelayed = pkg.scripts["profile:cls:baseline:delayed"];
  const checkDelayed = pkg.scripts["profile:cls:check:delayed"];
  assert.equal(typeof delayed, "string");
  assert.equal(typeof baselineDelayed, "string");
  assert.equal(typeof checkDelayed, "string");
  assert.ok(delayed.includes(delayFlag), delayed);
  assert.ok(baselineDelayed.includes(delayFlag), baselineDelayed);
  assert.ok(checkDelayed.includes(delayFlag), checkDelayed);
  assert.ok(
    checkDelayed.includes("--budgets scripts/profile/cls-budgets-delayed.json"),
    checkDelayed,
  );
  assert.ok(delayed.includes("--out tmp/cls-profile-delayed.json"), delayed);
  assert.ok(
    baselineDelayed.includes("--out tmp/baseline-cls-profile-delayed.json"),
    baselineDelayed,
  );
});

test("parseArgs check:delayed script shape", () => {
  const opts = parseArgs([
    "node",
    "cls-profile.ts",
    "--check",
    "--delay-css-ms",
    String(CLS_CI_DELAY_CSS_MS),
    "--out",
    "tmp/cls-profile-delayed.json",
    "--budgets",
    "scripts/profile/cls-budgets-delayed.json",
  ]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.check, true);
  assert.equal(opts.delayCssMs, CLS_CI_DELAY_CSS_MS);
  assert.ok(opts.outPath.endsWith(`${path.sep}cls-profile-delayed.json`));
  assert.ok(opts.budgetsPath.endsWith(`${path.sep}cls-budgets-delayed.json`));
});

test("delayed CI ports cannot collide with the un-delayed lab's preview", () => {
  assert.equal(CLS_CI_DELAYED_PROFILE_PORT, 4188);
  const undelayed = parseClsProfilePort({});
  const delayedPair = [
    CLS_CI_DELAYED_PROFILE_PORT,
    upstreamPortForProxy(CLS_CI_DELAYED_PROFILE_PORT),
  ];
  for (const port of delayedPair) {
    assert.notEqual(port, undelayed);
    assert.notEqual(port, upstreamPortForProxy(undelayed));
  }
  const yml = fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../.github/workflows/cls.yml",
    ),
    "utf8",
  );
  assert.match(yml, /CLS_PROFILE_PORT:\s*4188/);
  assert.doesNotMatch(yml, /CLS_PROFILE_PORT:\s*4189/);
  assert.match(yml, /name: Build production/);
  assert.match(yml, /npm run build/);
  assert.match(yml, /profile:cls:check -- --repeat 3 --skip-build/);
  assert.match(yml, /profile:cls:check:delayed -- --repeat 3 --skip-build/);
});

test("parseArgs --skip-build does not attach --url", () => {
  const opts = parseArgs(["node", "cls-profile.ts", "--skip-build"]);
  assert.ok(!("help" in opts));
  if ("help" in opts) {
    return;
  }
  assert.equal(opts.skipBuild, true);
  assert.equal(opts.url, null);
});

test("assertSkipBuildDist throws when dist/index.html is missing", () => {
  const missing = path.join(os.tmpdir(), "cls-no-dist", "index.html");
  assert.throws(
    () => assertSkipBuildDist(missing),
    /--skip-build requires dist/,
  );
});

test("waitForHttpOk probes with node:http", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  try {
    await waitForHttpOk(`http://127.0.0.1:${String(addr.port)}/`, 2000);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test("lighthouseSettingsForPreset mobile matches Lighthouse Moto G Power", () => {
  const s = lighthouseSettingsForPreset("mobile");
  assert.equal(s.screenEmulation.width, 412);
  assert.equal(s.screenEmulation.height, 823);
  assert.equal(s.screenEmulation.deviceScaleFactor, 1.75);
  assert.equal(s.formFactor, "mobile");
  assert.equal(s.screenEmulation.mobile, true);
  assert.equal(s.throttlingMethod, "devtools");
  assert.equal(s.screenEmulation.disabled, false);
  assert.ok(s.onlyAudits.includes("cumulative-layout-shift"));
  assert.ok(s.onlyAudits.includes("layout-shifts"));
  assert.ok(s.onlyAudits.includes("cls-culprits-insight"));
  assert.equal(s.throttling.cpuSlowdownMultiplier, 4);
  assert.match(s.emulatedUserAgent, /Mobile/i);
});

test("lighthouseSettingsForPreset tablet and mediumDesktop match Argos CSS pixels", () => {
  const tablet = lighthouseSettingsForPreset("tablet");
  assert.equal(tablet.screenEmulation.width, 834);
  assert.equal(tablet.screenEmulation.height, 1112);
  assert.equal(tablet.formFactor, "desktop");
  assert.equal(tablet.screenEmulation.mobile, false);
  assert.equal(tablet.throttling.cpuSlowdownMultiplier, 1);
  assert.doesNotMatch(tablet.emulatedUserAgent, /Mobile/);

  const md = lighthouseSettingsForPreset("mediumDesktop");
  assert.equal(md.screenEmulation.width, 1440);
  assert.equal(md.screenEmulation.height, 900);
  assert.equal(md.formFactor, "desktop");
  assert.equal(md.screenEmulation.mobile, false);
  assert.equal(md.throttlingMethod, "devtools");
  assert.equal(md.screenEmulation.disabled, false);
});

test("every preset onlyAudits includes the three CLS audits; chromeFlags omit hide-scrollbars", () => {
  for (const name of CLS_PRESET_NAMES) {
    const s = lighthouseSettingsForPreset(name);
    assert.deepEqual([...s.onlyAudits], [...CLS_ONLY_AUDITS]);
  }
  assert.equal(
    (CLS_CHROME_FLAGS as readonly string[]).includes("--hide-scrollbars"),
    false,
  );
});

test("dump lighthouseMobile is 412x823 and dump mobile stays Argos 390x844", () => {
  assert.deepEqual(VIEWPORT_PRESETS.lighthouseMobile, {
    width: 412,
    height: 823,
  });
  assert.deepEqual(VIEWPORT_PRESETS.mobile, { width: 390, height: 844 });
});

test("extractClsSample reads CLS and layout-shifts nodes from the fixture LHR", () => {
  const lhr = readFixtureLhr();
  const sample = extractClsSample(
    lhr,
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.equal(sample.numericValue, 0.102741778580851);
  assert.ok(sample.nodes.length >= 2);
  assert.equal(
    sample.nodes[0]?.selector,
    "div > div.box > div.collapsible-content > div.box",
  );
  for (const node of sample.nodes) {
    assert.equal(typeof node.selector, "string");
    assert.notEqual(node.selector, "");
    assert.equal(typeof node.score, "number");
    assert.ok(Number.isFinite(node.score));
    assert.ok(Array.isArray(node.causes));
  }
  assert.equal(sample.preset, "mobile");
  assert.equal(sample.width, 412);
  assert.equal(sample.height, 823);
  assert.equal(sample.throttlingMethod, "devtools");
  assert.equal(sample.lighthouseVersion, "13.4.1");
  assert.deepEqual([...sample.chromeFlags], [...CLS_CHROME_FLAGS]);
  assert.equal(sample.platform, process.platform);
});

test("extractClsSample keeps two distinct layout-shifts selectors", () => {
  const lhr: LhrLike = {
    lighthouseVersion: "13.4.1",
    audits: {
      "cumulative-layout-shift": { numericValue: 0.14, score: 0.72 },
      "layout-shifts": {
        details: {
          type: "table",
          items: [
            {
              node: { type: "node", selector: "div.box.loading-shell-filters" },
              score: 0.1,
            },
            {
              node: {
                type: "node",
                selector:
                  "div#mithril-spritesheet-preview > div.box > div.collapsible-content > div.preview-canvas-area",
              },
              score: 0.04,
            },
          ],
        },
      },
    },
  };
  const sample = extractClsSample(
    lhr,
    "mediumDesktop",
    lighthouseSettingsForPreset("mediumDesktop"),
  );
  assert.deepEqual(
    sample.nodes.map((n) => n.selector),
    [
      "div.box.loading-shell-filters",
      "div#mithril-spritesheet-preview > div.box > div.collapsible-content > div.preview-canvas-area",
    ],
  );
});

test("extractClsSample skips the cls-culprits-insight Total row", () => {
  const lhr: LhrLike = {
    lighthouseVersion: "13.4.1",
    audits: {
      "cumulative-layout-shift": { numericValue: 0.2, score: 0.6 },
      "cls-culprits-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                {
                  node: { type: "text", value: "Total" },
                  score: 0.2,
                },
                {
                  node: {
                    type: "node",
                    selector: "div.box.loading-shell-filters",
                  },
                  score: 0.12,
                },
              ],
            },
          ],
        },
      },
    },
  };
  const sample = extractClsSample(
    lhr,
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.equal(sample.nodes.length, 1);
  assert.equal(sample.nodes[0]?.selector, "div.box.loading-shell-filters");
  assert.equal(sample.nodes[0]?.score, 0.12);
  assert.equal(
    sample.nodes.some((n) => n.selector === "Total"),
    false,
  );
});

test("extractClsSample reads subItem causes in every cause shape", () => {
  const lhr: LhrLike = {
    lighthouseVersion: "13.4.1",
    audits: {
      "cumulative-layout-shift": { numericValue: 0.3, score: 0.5 },
      "layout-shifts": {
        details: {
          type: "table",
          items: [
            {
              node: { type: "node", selector: "#header-left" },
              score: 0.3,
              subItems: {
                type: "subitems",
                items: [
                  { cause: "Web font loaded" },
                  { cause: { formattedDefault: "Unsized image element" } },
                  { cause: { value: "Injected iframe" } },
                  { cause: { unrecognized: true } },
                  "not a record",
                ],
              },
            },
          ],
        },
      },
    },
  };
  const sample = extractClsSample(
    lhr,
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.equal(sample.nodes.length, 1);
  assert.deepEqual(sample.nodes[0]?.causes, [
    "Web font loaded",
    "Unsized image element",
    "Injected iframe",
  ]);
});

test("extractClsSample falls through to insight when layout-shifts details are empty", () => {
  const lhr: LhrLike = {
    lighthouseVersion: "13.4.1",
    audits: {
      "cumulative-layout-shift": { numericValue: 0.05, score: 1 },
      "layout-shifts": {
        details: { type: "table", items: [] },
      },
      "cls-culprits-insight": {
        details: {
          type: "list",
          items: [
            {
              type: "table",
              items: [
                {
                  node: { type: "node", selector: "#mithril-filters > div" },
                  score: 0.05,
                },
              ],
            },
          ],
        },
      },
    },
  };
  const sample = extractClsSample(
    lhr,
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.equal(sample.nodes.length, 1);
  assert.equal(sample.nodes[0]?.selector, "#mithril-filters > div");
  assert.equal(sample.nodes[0]?.score, 0.05);
});

test("extractClsSample falls back to cls-culprits-insight on the delayed fixture", () => {
  const lhr = readFixtureLhr();
  delete lhr.audits?.["layout-shifts"];
  const sample = extractClsSample(
    lhr,
    "tablet",
    lighthouseSettingsForPreset("tablet"),
  );
  assert.equal(sample.numericValue, 0.102741778580851);
  assert.ok(sample.nodes.length >= 2);
  assert.equal(
    sample.nodes.some((n) => n.selector === "Total"),
    false,
  );
  for (const node of sample.nodes) {
    assert.notEqual(node.selector, "");
    assert.equal(typeof node.score, "number");
    assert.ok(Number.isFinite(node.score));
  }
});

test("extractClsSample empty nodes when culprit audits absent", () => {
  const sample = extractClsSample(
    {
      audits: {
        "cumulative-layout-shift": { numericValue: 0, score: 1 },
      },
    },
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.deepEqual(sample.nodes, []);
});

test("extractClsSample throws when cumulative-layout-shift is missing", () => {
  assert.throws(
    () =>
      extractClsSample(
        { audits: {} },
        "mobile",
        lighthouseSettingsForPreset("mobile"),
      ),
    /cumulative-layout-shift/,
  );
});

test("extractClsSample throws on missing or non-finite numericValue", () => {
  assert.throws(
    () =>
      extractClsSample(
        { audits: { "cumulative-layout-shift": { score: 1 } } },
        "mobile",
        lighthouseSettingsForPreset("mobile"),
      ),
    /numericValue/,
  );
  assert.throws(
    () =>
      extractClsSample(
        { audits: { "cumulative-layout-shift": { numericValue: null } } },
        "mobile",
        lighthouseSettingsForPreset("mobile"),
      ),
    /numericValue/,
  );
  assert.throws(
    () =>
      extractClsSample(
        { audits: { "cumulative-layout-shift": { numericValue: Number.NaN } } },
        "mobile",
        lighthouseSettingsForPreset("mobile"),
      ),
    /numericValue/,
  );
});

test("extractClsSample throws on runtimeError even if CLS looks fine", () => {
  assert.throws(
    () =>
      extractClsSample(
        {
          runtimeError: { code: "NO_FCP", message: "NO_FCP" },
          audits: { "cumulative-layout-shift": { numericValue: 0, score: 1 } },
        },
        "mobile",
        lighthouseSettingsForPreset("mobile"),
      ),
    /runtimeError/,
  );
});

test("summarizeRepeats median min max", () => {
  const one = summarizeRepeats([0.12]);
  assert.deepEqual(one, { median: 0.12, min: 0.12, max: 0.12, n: 1 });
  const three = summarizeRepeats([0.2, 0.1, 0.3]);
  assert.equal(three.median, 0.2);
  assert.equal(three.min, 0.1);
  assert.equal(three.max, 0.3);
  assert.equal(three.n, 3);
  const even = summarizeRepeats([0.1, 0.3]);
  assert.equal(even.median, 0.2);
});

test("summarizeRepeats empty list throws", () => {
  assert.throws(() => summarizeRepeats([]), /empty/);
});

function result(
  preset: ClsPresetResult["preset"],
  median: number,
): ClsPresetResult {
  return {
    preset,
    width: 0,
    height: 0,
    samples: [],
    summary: { median, min: median, max: median, n: 1 },
  };
}

test("checkClsAgainstBudgets pass / over / missing", () => {
  const budgets = { mobile: 0.2, tablet: 0.3, mediumDesktop: 0.25 };
  assert.deepEqual(
    checkClsAgainstBudgets(
      [
        result("mobile", 0.2),
        result("tablet", 0.1),
        result("mediumDesktop", 0.25),
      ],
      budgets,
    ),
    [],
  );
  const oneOver = checkClsAgainstBudgets(
    [
      result("mobile", 0.21),
      result("tablet", 0.1),
      result("mediumDesktop", 0.1),
    ],
    budgets,
  );
  assert.equal(oneOver.length, 1);
  assert.equal(oneOver[0]?.preset, "mobile");
  assert.equal(oneOver[0]?.actual, 0.21);
  assert.equal(oneOver[0]?.budget, 0.2);

  const twoOver = checkClsAgainstBudgets(
    [
      result("mobile", 0.5),
      result("tablet", 0.4),
      result("mediumDesktop", 0.1),
    ],
    budgets,
  );
  assert.equal(twoOver.length, 2);

  const missingResult = checkClsAgainstBudgets(
    [result("mobile", 0.1)],
    budgets,
    [...CLS_PRESET_NAMES],
  );
  assert.ok(missingResult.some((v) => v.reason === "missing-result"));

  const onePreset = checkClsAgainstBudgets([result("tablet", 0.1)], budgets, [
    "tablet",
  ]);
  assert.deepEqual(onePreset, []);

  const missingBudget = checkClsAgainstBudgets(
    [
      result("mobile", 0.1),
      result("tablet", 0.1),
      result("mediumDesktop", 0.1),
    ],
    { mobile: 0.2, tablet: 0.3 },
  );
  assert.ok(missingBudget.some((v) => v.preset === "mediumDesktop"));
  assert.ok(missingBudget.some((v) => v.reason === "missing-budget"));
});

test("checkClsAgainstBudgets defaults to measured presets only", () => {
  const budgets = { mobile: 0.2, tablet: 0.3, mediumDesktop: 0.25 };
  assert.deepEqual(
    checkClsAgainstBudgets([result("tablet", 0.1)], budgets),
    [],
  );
  const over = checkClsAgainstBudgets([result("tablet", 0.4)], budgets);
  assert.equal(over.length, 1);
  assert.equal(over[0]?.preset, "tablet");
  assert.equal(over[0]?.reason, "over-budget");
});

test("checkClsAgainstBudgets unknown key throws", () => {
  assert.throws(
    () =>
      checkClsAgainstBudgets([result("mobile", 0.1)], {
        mobile: 0.2,
        hugeDesktop: 0.1,
      }),
    /budgets file has unknown preset/,
  );
});

test("parseBudgetsJson rejects unknown keys and bad values", () => {
  assert.throws(
    () => parseBudgetsJson({ mobile: 0.1, nope: 0.2 }),
    /budgets file has unknown preset/,
  );
  assert.throws(
    () =>
      parseBudgetsJson({ mobile: 0.1, nope: 0.2 }, "cls-budgets-delayed.json"),
    /cls-budgets-delayed.json has unknown preset/,
  );
  assert.throws(() => parseBudgetsJson({ mobile: -0.1 }), /finite number/);
  assert.throws(() => parseBudgetsJson({ mobile: "0.1" }), /finite number/);
  assert.deepEqual(parseBudgetsJson({ mobile: 0, tablet: 0.2 }), {
    mobile: 0,
    tablet: 0.2,
  });
});

test("loadBudgetsOrThrow reads the committed budgets file", () => {
  const budgetsPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../scripts/profile/cls-budgets.json",
  );
  const parsed = loadBudgetsOrThrow(budgetsPath);
  assert.deepEqual(Object.keys(parsed).sort(), [...CLS_PRESET_NAMES].sort());
});

test("loadBudgetsOrThrow missing path mentions --check", () => {
  const missing = path.join(os.tmpdir(), "cls-budgets-does-not-exist.json");
  assert.throws(() => loadBudgetsOrThrow(missing), /needed for --check/);
});

test("loadBudgetsOrThrow surfaces parseBudgetsJson errors", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cls-budgets-"));
  const badKeys = path.join(dir, "unknown.json");
  fs.writeFileSync(badKeys, `${JSON.stringify({ mobile: 0.1, nope: 0.2 })}\n`);
  assert.throws(
    () => loadBudgetsOrThrow(badKeys),
    /unknown.json has unknown preset/,
  );
  const malformed = path.join(dir, "malformed.json");
  fs.writeFileSync(malformed, "{");
  assert.throws(() => loadBudgetsOrThrow(malformed));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("stopChildProcess waits for SIGTERM then SIGKILL", async () => {
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  await stopChildProcess(child, 200);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});

test("stopChildProcess is a no-op after the child has already exited", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], {
    stdio: "ignore",
  });
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
  await stopChildProcess(child, 1000);
  assert.equal(child.exitCode, 0);
});

test("committed cls-budgets.json has exactly the three presets in 0–1", () => {
  const budgetsPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../scripts/profile/cls-budgets.json",
  );
  const parsed = parseBudgetsJson(
    JSON.parse(fs.readFileSync(budgetsPath, "utf8")) as unknown,
  );
  const keys = Object.keys(parsed).sort();
  const expected = [...CLS_PRESET_NAMES].sort();
  assert.deepEqual(keys, expected);
  for (const name of CLS_PRESET_NAMES) {
    const value = parsed[name];
    assert.equal(typeof value, "number");
    assert.ok(Number.isFinite(value));
    assert.ok(
      value !== undefined && value >= 0 && value <= 1,
      `${name}=${String(value)}`,
    );
  }
});

test("committed cls-budgets-delayed.json has exactly the three presets in 0–1", () => {
  const budgetsPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../scripts/profile/cls-budgets-delayed.json",
  );
  const parsed = parseBudgetsJson(
    JSON.parse(fs.readFileSync(budgetsPath, "utf8")) as unknown,
  );
  const keys = Object.keys(parsed).sort();
  const expected = [...CLS_PRESET_NAMES].sort();
  assert.deepEqual(keys, expected);
  for (const name of CLS_PRESET_NAMES) {
    const value = parsed[name];
    assert.equal(typeof value, "number");
    assert.ok(Number.isFinite(value));
    assert.ok(
      value !== undefined && value >= 0 && value <= 1,
      `${name}=${String(value)}`,
    );
  }
});

test("un-delayed and delayed budget files are not identical", () => {
  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../scripts/profile",
  );
  const undelayed = fs.readFileSync(path.join(dir, "cls-budgets.json"), "utf8");
  const delayed = fs.readFileSync(
    path.join(dir, "cls-budgets-delayed.json"),
    "utf8",
  );
  assert.notEqual(undelayed, delayed);
});

test("parseClsProfilePort", () => {
  assert.equal(parseClsProfilePort({}), 4179);
  assert.equal(parseClsProfilePort({ CLS_PROFILE_PORT: "" }), 4179);
  assert.equal(parseClsProfilePort({ CLS_PROFILE_PORT: "4180" }), 4180);
  assert.throws(
    () => parseClsProfilePort({ CLS_PROFILE_PORT: "0" }),
    /1–65535/,
  );
  assert.throws(
    () => parseClsProfilePort({ CLS_PROFILE_PORT: "nope" }),
    /1–65535/,
  );
});

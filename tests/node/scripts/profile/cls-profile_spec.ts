import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { VIEWPORT_PRESETS } from "../../../../scripts/computed-style/computed-style-dump-shared.ts";
import {
  CLS_CHROME_FLAGS,
  CLS_ONLY_AUDITS,
  CLS_PRESET_NAMES,
  checkClsAgainstBudgets,
  extractClsSample,
  lighthouseSettingsForPreset,
  parseArgs,
  parseBudgetsJson,
  parseClsProfilePort,
  shouldDelayStylesheetPath,
  summarizeRepeats,
  upstreamPortForProxy,
  type ClsPresetResult,
  type LhrLike,
} from "../../../../scripts/profile/cls-profile.ts";

const FIXTURE = fileURLToPath(
  new URL("../../../fixtures/lighthouse/lhr-mobile.json", import.meta.url),
);

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

test("shouldDelayStylesheetPath matches production CSS asset names", () => {
  assert.equal(shouldDelayStylesheetPath("/assets/main-D4rbq9Ei.css"), true);
  assert.equal(
    shouldDelayStylesheetPath("/assets/load-deferred-styles-L0fhUdhH.css"),
    true,
  );
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

test("upstreamPortForProxy is public port + 1", () => {
  assert.equal(upstreamPortForProxy(4179), 4180);
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

test("every preset onlyAudits includes both CLS audits; chromeFlags omit hide-scrollbars", () => {
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
  const lhr = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as LhrLike;
  const sample = extractClsSample(
    lhr,
    "mobile",
    lighthouseSettingsForPreset("mobile"),
  );
  assert.equal(sample.numericValue, 0.142);
  assert.equal(sample.score, 0.72);
  assert.equal(sample.nodes.length, 2);
  assert.equal(sample.nodes[0]?.selector, "div.box.loading-shell-filters");
  assert.equal(sample.nodes[0]?.score, 0.12);
  assert.deepEqual(sample.nodes[0]?.causes, ["Web font loaded"]);
  assert.equal(sample.preset, "mobile");
  assert.equal(sample.width, 412);
  assert.equal(sample.height, 823);
  assert.equal(sample.throttlingMethod, "devtools");
  assert.equal(sample.lighthouseVersion, "13.4.1");
  assert.deepEqual([...sample.chromeFlags], [...CLS_CHROME_FLAGS]);
  assert.equal(sample.platform, process.platform);
});

test("extractClsSample falls back to cls-culprits-insight", () => {
  const lhr: LhrLike = {
    lighthouseVersion: "13.4.1",
    audits: {
      "cumulative-layout-shift": { numericValue: 0.05, score: 1 },
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
    "tablet",
    lighthouseSettingsForPreset("tablet"),
  );
  assert.equal(sample.numericValue, 0.05);
  assert.equal(sample.nodes[0]?.selector, "#mithril-filters > div");
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
  );
  assert.ok(missingResult.some((v) => v.reason === "missing-result"));

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

test("checkClsAgainstBudgets unknown key throws", () => {
  assert.throws(
    () =>
      checkClsAgainstBudgets([result("mobile", 0.1)], {
        mobile: 0.2,
        hugeDesktop: 0.1,
      }),
    /unknown preset/,
  );
});

test("parseBudgetsJson rejects unknown keys and bad values", () => {
  assert.throws(
    () => parseBudgetsJson({ mobile: 0.1, nope: 0.2 }),
    /unknown preset/,
  );
  assert.throws(() => parseBudgetsJson({ mobile: -0.1 }), /finite number/);
  assert.throws(() => parseBudgetsJson({ mobile: "0.1" }), /finite number/);
  assert.deepEqual(parseBudgetsJson({ mobile: 0, tablet: 0.2 }), {
    mobile: 0,
    tablet: 0.2,
  });
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

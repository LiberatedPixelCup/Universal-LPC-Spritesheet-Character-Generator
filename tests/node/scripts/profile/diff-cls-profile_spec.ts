import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  ClsPresetResult,
  ClsProfileFile,
} from "../../../../scripts/profile/cls-profile.ts";
import {
  formatClsProfileDiff,
  hostUserAgentLabel,
  loadProfile,
  parseArgs,
} from "../../../../scripts/profile/diff-cls-profile.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");

function preset(
  name: ClsPresetResult["preset"],
  median: number,
): ClsPresetResult {
  return {
    preset: name,
    width: name === "mobile" ? 412 : name === "tablet" ? 834 : 1440,
    height: name === "mobile" ? 823 : name === "tablet" ? 1112 : 900,
    samples: [],
    summary: { median, min: median, max: median, n: 1 },
  };
}

function withHostUa(
  result: ClsPresetResult,
  hostUserAgent: string,
): ClsPresetResult {
  return {
    ...result,
    samples: [
      {
        numericValue: result.summary.median,
        score: null,
        nodes: [],
        lighthouseVersion: "13.4.1",
        chromeFlags: ["--headless=new", "--no-sandbox"],
        throttlingMethod: "devtools",
        platform: "linux",
        preset: result.preset,
        width: result.width,
        height: result.height,
        hostUserAgent,
        emulatedUserAgent: "",
      },
    ],
  };
}

function profile(overrides: Partial<ClsProfileFile> = {}): ClsProfileFile {
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    url: "http://127.0.0.1:4179/?debug=false",
    repeat: 3,
    delayCssMs: 0,
    delayedStylesheetHits: 0,
    lighthouseVersion: "13.4.1",
    chromePath: "/usr/bin/google-chrome",
    chromeFlags: ["--headless=new", "--no-sandbox"],
    throttlingMethod: "devtools",
    platform: "linux",
    presets: [preset("mobile", 0.1), preset("tablet", 0.05)],
    ...overrides,
  };
}

test("parseArgs positional paths resolve against repo root", () => {
  const opts = parseArgs([
    "node",
    "diff-cls-profile.ts",
    "tmp/a.json",
    "tmp/b.json",
  ]);
  assert.equal(opts.beforePath, path.join(REPO_ROOT, "tmp/a.json"));
  assert.equal(opts.afterPath, path.join(REPO_ROOT, "tmp/b.json"));
});

test("parseArgs --before / --after resolve against repo root", () => {
  const opts = parseArgs([
    "node",
    "diff-cls-profile.ts",
    "--before",
    "tmp/baseline-cls-profile.json",
    "--after",
    "tmp/cls-profile.json",
  ]);
  assert.equal(
    opts.beforePath,
    path.join(REPO_ROOT, "tmp/baseline-cls-profile.json"),
  );
  assert.equal(opts.afterPath, path.join(REPO_ROOT, "tmp/cls-profile.json"));
});

test("parseArgs missing args throw usage", () => {
  assert.throws(
    () => parseArgs(["node", "diff-cls-profile.ts"]),
    /Usage: diff-cls-profile/,
  );
  assert.throws(
    () => parseArgs(["node", "diff-cls-profile.ts", "--before", "a.json"]),
    /Usage: diff-cls-profile/,
  );
});

test("formatClsProfileDiff Δ is after.median − before.median to 3 decimals", () => {
  const before = profile({
    presets: [preset("mobile", 0.1), preset("tablet", 0.05)],
  });
  const after = profile({
    presets: [preset("mobile", 0.1234), preset("tablet", 0.04)],
  });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.match(text, /mobile/);
  assert.match(text, /\+0\.023/);
  assert.match(text, /-0\.010/);
  assert.match(text, /0\.123/);
  assert.match(text, /0\.040/);
});

test("formatClsProfileDiff reports a preset present on one side only", () => {
  const before = profile({
    presets: [preset("mobile", 0.1)],
  });
  const after = profile({
    presets: [preset("mobile", 0.1), preset("mediumDesktop", 0.02)],
  });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.match(text, /mediumDesktop/);
  assert.match(text, /n\/a/);
});

test("formatClsProfileDiff warns when lighthouseVersion or platform differ", () => {
  const before = profile({ lighthouseVersion: "13.4.1", platform: "darwin" });
  const after = profile({ lighthouseVersion: "13.5.0", platform: "linux" });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.match(text, /lighthouseVersion differs \(13\.4\.1 → 13\.5\.0\)/);
  assert.match(text, /platform differs \(darwin → linux\)/);
});

test("formatClsProfileDiff warns when delayCssMs differs", () => {
  const before = profile({ delayCssMs: 0 });
  const after = profile({ delayCssMs: 3000 });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.match(text, /delayCssMs differs \(0 → 3000\)/);
});

test("formatClsProfileDiff warns when hostUserAgent differs", () => {
  const before = profile({
    presets: [withHostUa(preset("mobile", 0.1), "HeadlessChrome/131.0.6778.0")],
  });
  const after = profile({
    presets: [
      withHostUa(preset("mobile", 0.12), "HeadlessChrome/132.0.6834.0"),
    ],
  });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.match(
    text,
    /hostUserAgent differs \(HeadlessChrome\/131\.0\.6778\.0 → HeadlessChrome\/132\.0\.6834\.0\)/,
  );
  assert.match(text, /CI Chrome floats independently of lighthouseVersion/);
});

test("formatClsProfileDiff does not warn when hostUserAgent is missing or equal", () => {
  const empty = formatClsProfileDiff(
    profile(),
    profile(),
    "/before.json",
    "/after.json",
  );
  assert.doesNotMatch(empty, /hostUserAgent differs/);

  const ua = "Mozilla/5.0 HeadlessChrome/131.0.6778.0";
  const before = profile({
    presets: [withHostUa(preset("mobile", 0.1), ua)],
  });
  const after = profile({
    presets: [withHostUa(preset("mobile", 0.12), ua)],
  });
  const text = formatClsProfileDiff(
    before,
    after,
    "/before.json",
    "/after.json",
  );
  assert.doesNotMatch(text, /hostUserAgent differs/);
});

test("hostUserAgentLabel skips blanks and dedupes", () => {
  assert.equal(hostUserAgentLabel(profile()), null);
  const labeled = profile({
    presets: [
      withHostUa(preset("mobile", 0.1), "HeadlessChrome/131.0.6778.0"),
      withHostUa(preset("tablet", 0.05), "HeadlessChrome/131.0.6778.0"),
    ],
  });
  assert.equal(hostUserAgentLabel(labeled), "HeadlessChrome/131.0.6778.0");
  const mixed = profile({
    presets: [
      withHostUa(preset("mobile", 0.1), ""),
      withHostUa(preset("tablet", 0.05), "HeadlessChrome/132.0.6834.0"),
    ],
  });
  assert.equal(hostUserAgentLabel(mixed), "HeadlessChrome/132.0.6834.0");
});

test("formatClsProfileDiff returns a string and does not throw", () => {
  const text = formatClsProfileDiff(
    profile(),
    profile(),
    "/before.json",
    "/after.json",
  );
  assert.equal(typeof text, "string");
  assert.ok(text.endsWith("\n"));
});

test("loadProfile reads JSON written to a temp file", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cls-diff-"));
  const p = path.join(dir, "cls.json");
  writeFileSync(p, JSON.stringify(profile()));
  const loaded = loadProfile(p);
  assert.equal(loaded.lighthouseVersion, "13.4.1");
  assert.equal(loaded.presets[0]?.summary.median, 0.1);
});

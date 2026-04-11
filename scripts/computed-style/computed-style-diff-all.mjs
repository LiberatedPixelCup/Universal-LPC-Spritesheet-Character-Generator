#!/usr/bin/env node
/**
 * Dump computed styles for both URLs at all Argos viewports (home.spec.js) and every Argos page
 * state (homepage, human-male-skintone, filters-search-arm), write raw dumps + unified diffs, and
 * a combined report.
 *
 * Typical workflow: master (Bulma 0.9.x, no bulma-overrides) vs update_bulma (Bulma 1.x +
 * styles/bulma-overrides.css). Defaults map to that: url-a http://127.0.0.1:4174 (master),
 * url-b http://127.0.0.1:4175 (branch). Unified diff lines are from a (baseline) vs b (branch);
 * goal is empty diff when overrides match master.
 *
 * For each viewport preset, dumps all three Argos-equivalent pages: homepage, human-male-skintone
 * (palette open), filters-search-arm (License + Animation + Advanced expanded, search "arm").
 * Output: 8 presets × 3 pages × 2 URLs = 48 .txt files; 8 × 3 unified .diff files + all.diff.
 *
 * Override with env COMPUTED_STYLE_URL_A / COMPUTED_STYLE_URL_B or --url-a / --url-b.
 *
 * Usage:
 *   node scripts/computed-style-diff-all.mjs
 *   node scripts/computed-style-diff-all.mjs --out-dir /tmp/cmp --url-a http://127.0.0.1:4174 --url-b http://127.0.0.1:4175
 *   node scripts/computed-style-diff-all.mjs --no-fail-on-diff   # exit 0 even when diffs exist
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  VIEWPORT_PRESETS,
  COMPUTED_STYLE_DUMP_PAGES,
  dumpComputedStylesForUrl,
} from "./computed-style-dump-shared.mjs";

const PRESET_ORDER = ["mobile", "tablet", "mediumDesktop", "hugeDesktop", "mobileLong", "tabletLong", "mediumDesktopLong", "hugeDesktopLong"];

function parseArgs(argv) {
  const out = {
    urlA: process.env.COMPUTED_STYLE_URL_A ?? "http://127.0.0.1:4174",
    urlB: process.env.COMPUTED_STYLE_URL_B ?? "http://127.0.0.1:4175",
    outDir: path.join(process.cwd(), "computed-style-diff-output"),
    failOnDiff: true,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--url-a" && argv[i + 1]) {
      out.urlA = argv[++i];
    } else if (a === "--url-b" && argv[i + 1]) {
      out.urlB = argv[++i];
    } else if (a === "--out-dir" && argv[i + 1]) {
      out.outDir = path.resolve(argv[++i]);
    } else if (a === "--no-fail-on-diff") {
      out.failOnDiff = false;
    }
  }
  return out;
}

function printHelp() {
  console.error(`Usage:
  node scripts/computed-style-diff-all.mjs [options]

Options:
  --url-a <url>     First site (default: $COMPUTED_STYLE_URL_A or http://127.0.0.1:4174)
  --url-b <url>     Second site (default: $COMPUTED_STYLE_URL_B or http://127.0.0.1:4175)
  --out-dir <dir>   Output directory (default: ./computed-style-diff-output)
  --no-fail-on-diff Exit 0 even when unified diffs are non-empty
  --help, -h

Writes per preset and page (${COMPUTED_STYLE_DUMP_PAGES.join(", ")}):
  <preset>-<page>-a.txt, <preset>-<page>-b.txt, <preset>-<page>.diff
  all.diff (concatenated), summary.txt
`);
}

function unifiedDiff(pathA, pathB) {
  try {
    return execFileSync("diff", ["-u", pathA, pathB], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (e) {
    if (e && typeof e === "object" && e.status === 1 && typeof e.stdout === "string") {
      return e.stdout;
    }
    throw e;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  fs.mkdirSync(args.outDir, { recursive: true });

  const combined = [];
  let anyDiff = false;

  for (const preset of PRESET_ORDER) {
    const vp = VIEWPORT_PRESETS[preset];
    if (!vp) {
      throw new Error(`Missing viewport preset: ${preset}`);
    }

    for (const dumpPage of COMPUTED_STYLE_DUMP_PAGES) {
      process.stderr.write(
        `Dumping ${preset} (${vp.width}x${vp.height}) page=${dumpPage}…\n`,
      );

      const dumpOpts = { page: dumpPage };
      const textA = await dumpComputedStylesForUrl(args.urlA, vp, dumpOpts);
      const textB = await dumpComputedStylesForUrl(args.urlB, vp, dumpOpts);

      const stem = `${preset}-${dumpPage}`;
      const pathA = path.join(args.outDir, `${stem}-a.txt`);
      const pathB = path.join(args.outDir, `${stem}-b.txt`);
      fs.writeFileSync(pathA, textA, "utf8");
      fs.writeFileSync(pathB, textB, "utf8");

      const diffText = unifiedDiff(pathA, pathB);
      const diffPath = path.join(args.outDir, `${stem}.diff`);
      fs.writeFileSync(diffPath, diffText || "(no differences)\n", "utf8");

      const sectionTitle = `${preset} (${vp.width}x${vp.height}) page=${dumpPage}`;
      if (diffText) {
        anyDiff = true;
        combined.push(
          `\n########## ${sectionTitle} ##########\n\n`,
          diffText,
          diffText.endsWith("\n") ? "" : "\n",
        );
      } else {
        combined.push(
          `\n########## ${sectionTitle} ##########\n(no differences)\n\n`,
        );
      }
    }
  }

  const allPath = path.join(args.outDir, "all.diff");
  fs.writeFileSync(allPath, combined.join(""), "utf8");

  const summary = [
    `url-a: ${args.urlA}`,
    `url-b: ${args.urlB}`,
    `pages: ${COMPUTED_STYLE_DUMP_PAGES.join(", ")}`,
    `presets: ${PRESET_ORDER.join(", ")}`,
    `any differences: ${anyDiff ? "yes" : "no"}`,
    `output: ${args.outDir}`,
  ].join("\n");
  fs.writeFileSync(path.join(args.outDir, "summary.txt"), summary + "\n", "utf8");

  process.stderr.write(`\nWrote ${args.outDir}\n`);
  process.stderr.write(summary + "\n");

  if (anyDiff && args.failOnDiff) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

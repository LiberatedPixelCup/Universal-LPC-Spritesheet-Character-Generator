#!/usr/bin/env node
/**
 * Dump selected computed CSS properties for stable text diffing between branches
 * (e.g. master vs update_bulma) served from two worktrees on different ports.
 *
 * Usage:
 *   node scripts/dump-computed-styles.mjs http://127.0.0.1:4173 > /tmp/master.txt
 *   node scripts/dump-computed-styles.mjs http://127.0.0.1:4174 > /tmp/branch.txt
 *   diff -u /tmp/master.txt /tmp/branch.txt
 *
 * Or with labels and an output directory:
 *   node scripts/dump-computed-styles.mjs --out-dir /tmp/cmp --label master http://127.0.0.1:4173
 *   node scripts/dump-computed-styles.mjs --out-dir /tmp/cmp --label branch http://127.0.0.1:4174
 *
 * Options:
 *   --viewport WxH        Explicit size (default 1440x900 = Argos medium desktop)
 *   --preset NAME         Shorthand: mobile | tablet | mediumDesktop | hugeDesktop (same as tests/visual/home.spec.js)
 *   --out <file>          Write to file instead of stdout
 *   --out-dir <dir>       Implies --label required; writes <dir>/<label>.txt
 *
 * Mobile / responsive debugging (e.g. full-width Download buttons):
 *   node scripts/dump-computed-styles.mjs --preset mobile http://127.0.0.1:4173 > /tmp/master-mobile.txt
 *   node scripts/dump-computed-styles.mjs --preset mobile http://127.0.0.1:4174 > /tmp/branch-mobile.txt
 *   diff -u /tmp/master-mobile.txt /tmp/branch-mobile.txt
 *
 * All presets + diffs at once:
 *   node scripts/computed-style-diff-all.mjs
 */

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_VIEWPORT,
  VIEWPORT_PRESETS,
  dumpComputedStylesForUrl,
} from "./computed-style-dump-shared.mjs";

function parseArgs(argv) {
  const out = {
    url: null,
    outFile: null,
    outDir: null,
    label: null,
    viewport: { ...DEFAULT_VIEWPORT },
    skipSkintoneModal: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--out" && argv[i + 1]) {
      out.outFile = argv[++i];
    } else if (a === "--out-dir" && argv[i + 1]) {
      out.outDir = argv[++i];
    } else if (a === "--label" && argv[i + 1]) {
      out.label = argv[++i];
    } else if (a === "--preset" && argv[i + 1]) {
      const name = argv[++i];
      const preset = VIEWPORT_PRESETS[name];
      if (!preset) {
        throw new Error(
          `--preset must be one of: ${Object.keys(VIEWPORT_PRESETS).join(", ")}`,
        );
      }
      out.viewport = { ...preset };
    } else if (a === "--viewport" && argv[i + 1]) {
      const m = /^(\d+)x(\d+)$/.exec(argv[++i]);
      if (!m) {
        throw new Error("--viewport expects WxH e.g. 1440x900");
      }
      out.viewport = { width: Number(m[1]), height: Number(m[2]) };
    } else if (a === "--no-skintone-modal") {
      out.skipSkintoneModal = true;
    } else if (!a.startsWith("-")) {
      out.url = a;
    }
  }
  return out;
}

function printHelp() {
  console.error(`Usage:
  node scripts/dump-computed-styles.mjs [options] <url>

Options:
  --out <file>           Write dump to file (default: stdout)
  --out-dir <dir>        Write <dir>/<label>.txt (requires --label)
  --label <name>         Filename stem when using --out-dir
  --viewport WxH         Default ${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}
  --preset NAME          mobile | tablet | mediumDesktop | hugeDesktop (Argos / home.spec.js)
  --no-skintone-modal    Match Argos first frame (homepage only; palette targets will be <no match>)
  --help, -h

Examples:
  node scripts/dump-computed-styles.mjs http://127.0.0.1:4173 > /tmp/master.txt
  node scripts/dump-computed-styles.mjs --preset mobile http://127.0.0.1:4173 > /tmp/master-mobile.txt
  node scripts/dump-computed-styles.mjs --out /tmp/branch.txt http://127.0.0.1:4174
  diff -u /tmp/master.txt /tmp/branch.txt

  node scripts/computed-style-diff-all.mjs   # all presets vs default ports
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (args.outDir && !args.label) {
    console.error("--out-dir requires --label <name> for the output filename");
    process.exit(1);
  }

  const text = await dumpComputedStylesForUrl(args.url, args.viewport, {
    skipSkintoneModal: args.skipSkintoneModal,
  });

  if (args.outDir) {
    fs.mkdirSync(args.outDir, { recursive: true });
    const safe = args.label.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const outPath = path.join(args.outDir, `${safe}.txt`);
    fs.writeFileSync(outPath, text, "utf8");
    console.error(`Wrote ${outPath}`);
  } else if (args.outFile) {
    fs.writeFileSync(args.outFile, text, "utf8");
    console.error(`Wrote ${args.outFile}`);
  } else {
    process.stdout.write(text);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

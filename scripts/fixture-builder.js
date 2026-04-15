/**
 * Build issue #382 regression fixtures from an exported selections JSON file.
 *
 * What it does
 * ------------
 * 1. **Item metadata** — Filters `item-metadata.js` to only `itemId` values referenced
 *    in the JSON (walks all `"itemId"` keys). Writes a small ES module with
 *    `export default { ... }` so tests can import it.
 * 2. **Selections** — Writes `tests/fixtures/issue-382-selections.js` (`export default`
 *    the parsed JSON) for the browser golden runner and tests.
 * 3. **Golden zip paths** — Unless `--no-golden` is passed, starts a static server and
 *    runs `scripts/issue382-golden-playwright.mjs` (Playwright + Chromium) against
 *    `issue382-golden-runner.html` at the repo root (same URL base as `tests_run.html`
 *    so `spritesheets/...` paths resolve). The runner mirrors `tests/state/zip-issue-382_spec.js`
 *    and records sorted zip entry paths for all
 *    four export functions. Writes these files under `tests/fixtures/issue-382/`:
 *    - `issue-382-zip-paths-split-animations.js`
 *    - `issue-382-zip-paths-split-item-sheets.js`
 *    - `issue-382-zip-paths-split-item-animations.js`
 *    - `issue-382-zip-paths-individual-frames.js`
 *
 * Prerequisites for golden generation
 * -----------------------------------
 * - `npx playwright install chromium` (or full `playwright install`) so headless
 *   Chromium is available.
 * - Network allowed for `npx serve` and the first-run browser download if needed.
 * - **CDN scripts:** `issue382-golden-runner.html` loads Mithril, JSZip, and related
 *   libraries from public CDNs. Golden generation needs those URLs to load (or a warmed
 *   browser cache); offline or locked-down environments may fail until assets resolve.
 * - **Port:** `scripts/issue382-golden-playwright.mjs` serves the repo on port **9876** by
 *   default. If that port is in use, set **`ISSUE382_GOLDEN_PORT`** to another free port
 *   before running this script (same variable is read when `fixture-builder` invokes Playwright).
 *
 * Usage (from repo root)
 * ----------------------
 *   npm run fixture:issue382 -- path/to/selections.json
 *   node scripts/fixture-builder.js path/to/selections.json
 *   node scripts/fixture-builder.js path/to/selections.json --no-golden
 *
 * Outputs
 * -------
 * - `<same-dir-as-input>/<stem>-output.js` — filtered item metadata (ES module).
 * - `tests/fixtures/issue-382-itemdata.js` — copy for tests (same content).
 * - `tests/fixtures/issue-382-selections.js` — selections snapshot.
 * - Four `tests/fixtures/issue-382/issue-382-zip-paths-*.js` files — unless `--no-golden`.
 *
 * Golden zip paths — what they do and do not guarantee
 * -----------------------------------------------------
 * The `issue-382-zip-paths-*.js` files are **snapshots** of sorted zip entry paths
 * produced by the **current** client code when this script runs. They are not a
 * separate specification of correct behavior.
 *
 * - If someone changes export code **without** regenerating these files, CI should
 *   fail until the team **intentionally** updates the goldens (or reverts the change).
 * - If someone introduces a bug and **then** runs this script and commits the new
 *   goldens, the snapshot tests will still pass — the fixtures now encode the bug.
 *   **Review PR diffs** when golden files change; do not regenerate automatically on
 *   every edit without checking output.
 * - Pair snapshot tests with **property** or **unit** tests (e.g. invariants on folder
 *   structure) where you want failures that are harder to “fix” by updating blobs.
 *
 * @see scripts/issue382-golden-playwright.mjs
 * @see issue382-golden-runner.html
 * @see issue382-golden-runner.mjs
 * @see tests/state/zip-issue-382_spec.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");
const { debugLog } = require("./utils/debug.js");

const REPO_ROOT = path.join(__dirname, "..");
const ITEM_METADATA_PATH = path.join(REPO_ROOT, "item-metadata.js");
const TESTS_FIXTURES = path.join(REPO_ROOT, "tests", "fixtures", "issue-382");

/**
 * Collect every string value for keys named "itemId" (selections, layers, nested).
 */
function collectItemIdsFromExport(obj, out = new Set()) {
  if (obj === null || typeof obj !== "object") {
    return out;
  }
  if (Array.isArray(obj)) {
    for (const el of obj) {
      collectItemIdsFromExport(el, out);
    }
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k === "itemId" && typeof v === "string" && v.length > 0) {
      out.add(v);
    } else {
      collectItemIdsFromExport(v, out);
    }
  }
  return out;
}

function loadFullItemMetadata() {
  const code = fs.readFileSync(ITEM_METADATA_PATH, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const meta = sandbox.window.itemMetadata;
  if (!meta || typeof meta !== "object") {
    throw new Error(
      "item-metadata.js did not set window.itemMetadata to an object",
    );
  }
  return meta;
}

function writeItemdataModule(
  filePath,
  filtered,
  sourceSelectionsLabel,
  itemCount,
) {
  const header = `// Auto-generated by scripts/fixture-builder.js — do not edit by hand.
// Source selections: ${sourceSelectionsLabel}
// Item count: ${itemCount}
`;
  const body = `export default ${JSON.stringify(filtered, null, 2)};\n`;
  fs.writeFileSync(filePath, header + body, "utf8");
}

function writeSelectionsModule(filePath, data, sourceSelectionsLabel) {
  const header = `// Auto-generated by scripts/fixture-builder.js — do not edit by hand.
// Source: ${sourceSelectionsLabel}
// Used by tests/state/zip-issue-382_spec.js and issue382-golden-runner.mjs (repo root)
`;
  const body = `export default ${JSON.stringify(data, null, 2)};\n`;
  fs.writeFileSync(filePath, header + body, "utf8");
}

async function main() {
  const argv = process.argv.slice(2);
  const skipGolden = argv.includes("--no-golden");
  const posArgs = argv.filter((a) => a !== "--no-golden");

  const inputArg = posArgs[0];
  if (!inputArg) {
    console.error(
      "Usage: node scripts/fixture-builder.js <path-to-selections.json> [--no-golden]",
    );
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const stem = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(path.dirname(inputPath), `${stem}-output.js`);

  const raw = fs.readFileSync(inputPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`Invalid JSON in ${inputPath}:`, e.message);
    process.exit(1);
  }

  const wanted = collectItemIdsFromExport(data);
  if (wanted.size === 0) {
    // eslint-disable-next-line no-console -- always visible (not gated on DEBUG)
    console.warn("No itemId values found in input JSON; output will be empty.");
  }

  const sortedWanted = Array.from(wanted).sort();

  debugLog(`Loading ${ITEM_METADATA_PATH} …`);
  const full = loadFullItemMetadata();

  const filtered = {};
  const missing = [];
  for (const id of sortedWanted) {
    if (Object.prototype.hasOwnProperty.call(full, id)) {
      filtered[id] = full[id];
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console -- missing itemIds should always be visible
    console.warn(
      "itemId(s) not found in item-metadata.js (skipped):",
      missing.join(", "),
    );
  }

  const sourceLabel = path.relative(REPO_ROOT, inputPath) || inputPath;
  const itemCount = Object.keys(filtered).length;

  fs.mkdirSync(TESTS_FIXTURES, { recursive: true });

  writeItemdataModule(outPath, filtered, sourceLabel, itemCount);
  // eslint-disable-next-line no-console -- success path should always print
  console.log(
    `Wrote ${path.relative(REPO_ROOT, outPath)} (${itemCount} items)`,
  );

  const testsItemdata = path.join(TESTS_FIXTURES, "issue-382-itemdata.js");
  writeItemdataModule(testsItemdata, filtered, sourceLabel, itemCount);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${path.relative(REPO_ROOT, testsItemdata)}`);

  const testsSelections = path.join(TESTS_FIXTURES, "issue-382-selections.js");
  writeSelectionsModule(testsSelections, data, sourceLabel);
  // eslint-disable-next-line no-console
  console.log(`Wrote ${path.relative(REPO_ROOT, testsSelections)}`);

  if (!skipGolden) {
    const rel = path.relative(REPO_ROOT, inputPath).replace(/\\/g, "/");
    const modUrl = pathToFileURL(
      path.join(__dirname, "issue382-golden-playwright.mjs"),
    ).href;
    const { generateIssue382GoldenZipFixtures } = await import(modUrl);
    debugLog("Generating golden zip path fixtures (Playwright)…");
    await generateIssue382GoldenZipFixtures(rel);
    // eslint-disable-next-line no-console
    console.log(
      "Wrote tests/fixtures/issue-382/issue-382-zip-paths-*.js (four files)",
    );
  } else {
    debugLog("Skipped golden zip path generation (--no-golden).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Recursively collect Node specs under `dir`.
 * Accepts `*_spec.js` and `*_spec.ts` while the suite is mid-migration.
 * @param {string} dir
 * @param {string[]} acc
 * @returns {string[]}
 */
function collectSpecFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSpecFiles(full, acc);
    } else if (
      entry.name.endsWith("_spec.js") ||
      entry.name.endsWith("_spec.ts")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

const specs = collectSpecFiles(path.join("tests", "node")).sort();
const args = ["--test", ...specs];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);

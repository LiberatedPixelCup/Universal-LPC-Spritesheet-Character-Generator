import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readDirTree } from "./state.js";

/**
 * SHA-256 of all file contents under `sheet_definitions` and `palette_definitions` (repo-relative roots).
 * @param {{ root?: string, readFileSync?: typeof fs.readFileSync }} [deps]
 * @returns {string} Hex digest
 */
export function computeSourceInputsFingerprint(deps) {
  const { root = process.cwd(), readFileSync = fs.readFileSync } = deps ?? {};
  const h = createHash("sha256");
  const relRoots = ["sheet_definitions", "palette_definitions"].sort((a, b) =>
    a.localeCompare(b, ["en"]),
  );

  for (const name of relRoots) {
    const abs = path.join(root, name);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const entries = readDirTree(abs);
    for (const ent of entries) {
      if (ent.isDirectory()) {
        continue;
      }
      const full = path.join(ent.parentPath, ent.name);
      h.update(path.relative(root, full));
      h.update("\0");
      h.update(readFileSync(full));
      h.update("\0");
    }
  }
  return h.digest("hex");
}

export function getSourceInputsCachePath(cwd) {
  return path.join(path.resolve(cwd), ".cache", "lpc-source-inputs.sha256");
}

export function readStoredSourceInputsFingerprint(
  cachePath,
  readFileSync = fs.readFileSync,
) {
  try {
    return readFileSync(cachePath, "utf8").trim();
  } catch {
    return null;
  }
}

export function writeStoredSourceInputsFingerprint(
  cachePath,
  hex,
  { mkdirSync = fs.mkdirSync, writeFileSync = fs.writeFileSync } = {},
) {
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${hex}\n`, "utf8");
}

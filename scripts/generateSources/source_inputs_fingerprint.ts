import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readDirTree } from "./state.ts";

export type SourceInputsFingerprintDeps = {
  root?: string;
  readFileSync?: (filePath: string) => string | NodeJS.ArrayBufferView;
};

/**
 * SHA-256 of all file contents under `sheet_definitions` and `palette_definitions` (repo-relative roots).
 */
export function computeSourceInputsFingerprint(
  deps?: SourceInputsFingerprintDeps,
): string {
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

export function getSourceInputsCachePath(cwd: string): string {
  return path.join(path.resolve(cwd), ".cache", "lpc-source-inputs.sha256");
}

export function readStoredSourceInputsFingerprint(
  cachePath: string,
  readFileSync: (
    filePath: string,
    encoding: BufferEncoding,
  ) => string = fs.readFileSync,
): string | null {
  try {
    return readFileSync(cachePath, "utf8").trim();
  } catch {
    return null;
  }
}

export function writeStoredSourceInputsFingerprint(
  cachePath: string,
  hex: string,
  {
    mkdirSync = fs.mkdirSync,
    writeFileSync = fs.writeFileSync,
  }: {
    mkdirSync?: (dirPath: string, options: { recursive: boolean }) => void;
    writeFileSync?: (
      filePath: string,
      data: string,
      encoding?: BufferEncoding,
    ) => void;
  } = {},
): void {
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, `${hex}\n`, "utf8");
}

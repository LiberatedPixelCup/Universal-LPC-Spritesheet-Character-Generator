import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  computeSourceInputsFingerprint,
  getSourceInputsCachePath,
  readStoredSourceInputsFingerprint,
  writeStoredSourceInputsFingerprint,
} from "../../../../scripts/generateSources/source_inputs_fingerprint.ts";

function writeTree(root: string) {
  fs.mkdirSync(path.join(root, "sheet_definitions"), { recursive: true });
  fs.mkdirSync(path.join(root, "palette_definitions"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "sheet_definitions", "body.json"),
    '{"name":"body"}',
  );
  fs.writeFileSync(
    path.join(root, "palette_definitions", "skin.json"),
    '{"name":"skin"}',
  );
}

test("computeSourceInputsFingerprint is stable for the same tree and changes when a file changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-"));
  writeTree(root);

  const first = computeSourceInputsFingerprint({ root });
  const second = computeSourceInputsFingerprint({ root });
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);

  fs.writeFileSync(
    path.join(root, "sheet_definitions", "body.json"),
    '{"name":"body","changed":true}',
  );
  const third = computeSourceInputsFingerprint({ root });
  assert.notEqual(third, first);
});

test("getSourceInputsCachePath, writeStored, and readStored round-trip", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-cache-"));
  const cachePath = getSourceInputsCachePath(cwd);
  assert.equal(
    cachePath,
    path.join(path.resolve(cwd), ".cache", "lpc-source-inputs.sha256"),
  );

  assert.equal(readStoredSourceInputsFingerprint(cachePath), null);

  const writes: Array<{ outPath: string; contents: string }> = [];
  writeStoredSourceInputsFingerprint("ignored/cache", "abc123", {
    mkdirSync: () => {},
    writeFileSync: (outPath: string, contents: string) => {
      writes.push({ outPath, contents });
    },
  });
  assert.deepEqual(writes, [
    { outPath: "ignored/cache", contents: "abc123\n" },
  ]);

  assert.equal(
    readStoredSourceInputsFingerprint("missing", () => {
      throw new Error("enoent");
    }),
    null,
  );
  assert.equal(
    readStoredSourceInputsFingerprint("present", () => "  deadbeef  \n"),
    "deadbeef",
  );
});

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
  fs.mkdirSync(path.join(root, "scripts", "generateSources"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, "sheet_definitions", "body.json"),
    '{"name":"body"}',
  );
  fs.writeFileSync(
    path.join(root, "palette_definitions", "skin.json"),
    '{"name":"skin"}',
  );
  fs.writeFileSync(
    path.join(root, "scripts", "generateSources", "state.ts"),
    "export {}\n",
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

test("computeSourceInputsFingerprint changes when generateSources changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-"));
  writeTree(root);

  const first = computeSourceInputsFingerprint({ root });
  const second = computeSourceInputsFingerprint({ root });
  assert.equal(first, second);

  fs.writeFileSync(
    path.join(root, "scripts", "generateSources", "state.ts"),
    "export const changed = 1;\n",
  );
  const third = computeSourceInputsFingerprint({ root });
  assert.notEqual(third, first);
});

test("Body PNG names invalidate metadata on addition, rename and removal", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-body-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const body = path.join(root, "spritesheets", "body", "bodies", "male");
  fs.mkdirSync(body, { recursive: true });
  const empty = computeSourceInputsFingerprint({ root });
  const run = path.join(body, "run.png");
  const renamed = path.join(body, "renamed.png");
  fs.writeFileSync(run, "initial content");
  const added = computeSourceInputsFingerprint({ root });
  assert.notEqual(added, empty);
  fs.writeFileSync(run, "changed content");
  fs.writeFileSync(path.join(body, "license.txt"), "ignored");
  assert.equal(computeSourceInputsFingerprint({ root }), added);
  fs.renameSync(run, renamed);
  assert.notEqual(computeSourceInputsFingerprint({ root }), added);
  fs.unlinkSync(renamed);
  assert.equal(computeSourceInputsFingerprint({ root }), empty);
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

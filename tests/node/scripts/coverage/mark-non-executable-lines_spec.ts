import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyNonExecutableHits,
  nonExecutableLineNumbers,
} from "../../../../scripts/coverage/mark-non-executable-lines.js";

test("nonExecutableLineNumbers includes JSDoc and blank lines but not code with trailing comments", () => {
  const text = `/**
 * Runtime guard preserved: main.ts attaches this to \`window\`
 */
export function setPaletteRecolorMode() {}
const x = 1; // keep this line executable
`;

  const lines = nonExecutableLineNumbers(text);

  assert.ok(lines.has(1));
  assert.ok(lines.has(2));
  assert.ok(lines.has(3));
  assert.equal(lines.has(4), false);
  assert.equal(lines.has(5), false);
});

test("applyNonExecutableHits marks missing JSDoc lines covered and leaves executable misses", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lcov-comments-"));
  const sourceRel = path.join("src", "example.ts");
  const sourceAbs = path.join(root, sourceRel);
  fs.mkdirSync(path.dirname(sourceAbs));
  fs.writeFileSync(
    sourceAbs,
    `/**
 * docs
 */
export function f() {
  return 1;
}
`,
  );

  const lcov = `TN:
SF:${sourceRel}
DA:4,1
DA:5,0
LF:2
LH:1
end_of_record
`;

  const updated = applyNonExecutableHits(lcov, root);

  assert.match(updated, /^DA:1,1$/m);
  assert.match(updated, /^DA:2,1$/m);
  assert.match(updated, /^DA:3,1$/m);
  assert.match(updated, /^DA:4,1$/m);
  assert.match(updated, /^DA:5,0$/m);
  assert.match(updated, /^LF:6$/m);
  assert.match(updated, /^LH:5$/m);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectPatchMisses,
  formatPatchMissTable,
  parseCodecovIgnore,
  parseUnifiedDiff,
  resolveBaseRef,
} from "../../../../scripts/coverage/report-patch-misses.ts";

const SCRIPT = fileURLToPath(
  new URL(
    "../../../../scripts/coverage/report-patch-misses.ts",
    import.meta.url,
  ),
);

function writeSource(root: string, rel: string, text: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}

function collect(options: {
  root: string;
  files: Record<string, string>;
  lcov: string;
  changedLines: Record<string, number[]>;
  roots?: string[];
  ignore?: string[];
}) {
  for (const [rel, text] of Object.entries(options.files)) {
    writeSource(options.root, rel, text);
  }
  const changedLines = new Map<string, Set<number>>();
  for (const [rel, lines] of Object.entries(options.changedLines)) {
    changedLines.set(rel, new Set(lines));
  }
  return collectPatchMisses({
    lcov: options.lcov,
    changedLines,
    roots: options.roots ?? ["sources"],
    ignore: options.ignore ?? [],
    sourceRoot: options.root,
  });
}

test("prints path, line, and trimmed source text; exit 1", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/example.ts": "export function f() {\n  hit();\n  miss();\n}\n",
    },
    lcov: `TN:
SF:sources/example.ts
DA:3,0
end_of_record
`,
    changedLines: { "sources/example.ts": [3] },
  });

  assert.equal(misses.length, 1);
  assert.equal(misses[0]?.path, "sources/example.ts");
  assert.equal(misses[0]?.line, 3);
  assert.equal(misses[0]?.source, "miss();");
  assert.match(
    formatPatchMissTable(misses),
    /sources\/example\.ts:3\tmiss\(\);/,
  );
});

test("exit 0 and no rows when every patched gated line is DA>0", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/example.ts": "export function f() {\n  hit();\n}\n",
    },
    lcov: `TN:
SF:sources/example.ts
DA:2,1
end_of_record
`,
    changedLines: { "sources/example.ts": [2] },
  });

  assert.deepEqual(misses, []);
  assert.equal(formatPatchMissTable(misses), "");
});

test("skips codecov.yml ignore: paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const ignore = parseCodecovIgnore(`
ignore:
  - scripts/coverage/**
  - sources/utils/debug.ts
`);
  const misses = collect({
    root,
    files: {
      "scripts/coverage/foo.ts": "export const x = 1;\n",
      "sources/utils/debug.ts": "export const y = 2;\n",
    },
    lcov: `TN:
SF:scripts/coverage/foo.ts
DA:1,0
end_of_record
TN:
SF:sources/utils/debug.ts
DA:1,0
end_of_record
`,
    changedLines: {
      "scripts/coverage/foo.ts": [1],
      "sources/utils/debug.ts": [1],
    },
    roots: ["scripts", "sources"],
    ignore,
  });

  assert.deepEqual(misses, []);
});

test("skips paths outside the flag roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const files = {
    "scripts/gen.ts": "export const a = 1;\n",
    "sources/app.ts": "export const b = 2;\n",
  };
  const lcov = `TN:
SF:scripts/gen.ts
DA:1,0
end_of_record
TN:
SF:sources/app.ts
DA:1,0
end_of_record
`;
  const changedLines = {
    "scripts/gen.ts": [1],
    "sources/app.ts": [1],
  };

  const browser = collect({
    root,
    files,
    lcov,
    changedLines,
    roots: ["sources"],
  });
  assert.equal(browser.length, 1);
  assert.equal(browser[0]?.path, "sources/app.ts");

  const node = collect({
    root,
    files,
    lcov,
    changedLines,
    roots: ["scripts"],
  });
  assert.equal(node.length, 1);
  assert.equal(node[0]?.path, "scripts/gen.ts");
});

test("skips DA:0 on lines that are not in the patch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/example.ts": "a();\nb();\nc();\nd();\n",
    },
    lcov: `TN:
SF:sources/example.ts
DA:4,1
DA:10,0
end_of_record
`,
    changedLines: { "sources/example.ts": [4] },
  });

  assert.deepEqual(misses, []);
});

test("skips DA:n,1 on patched lines", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/example.ts": "one();\ntwo();\nthree();\nfour();\n",
    },
    lcov: `TN:
SF:sources/example.ts
DA:4,1
end_of_record
`,
    changedLines: { "sources/example.ts": [4] },
  });

  assert.deepEqual(misses, []);
});

test("does not treat a patched line with no DA row as a miss", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/example.ts":
        "one();\ntwo();\nthree();\nfour();\nfive();\nsix();\nseven();\neight();\n",
    },
    lcov: `TN:
SF:sources/example.ts
DA:1,1
end_of_record
`,
    changedLines: { "sources/example.ts": [8] },
  });

  assert.deepEqual(misses, []);
});

test("sorts rows by path then line", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-"));
  const misses = collect({
    root,
    files: {
      "sources/z.ts": "a();\nb();\n",
      "sources/a.ts": "c();\nd();\n",
    },
    lcov: `TN:
SF:sources/z.ts
DA:1,0
DA:2,0
end_of_record
TN:
SF:sources/a.ts
DA:2,0
end_of_record
`,
    changedLines: {
      "sources/z.ts": [2, 1],
      "sources/a.ts": [2],
    },
  });

  assert.deepEqual(
    misses.map((miss) => `${miss.path}:${String(miss.line)}`),
    ["sources/a.ts:2", "sources/z.ts:1", "sources/z.ts:2"],
  );
});

test("resolveBaseRef prefers --base over GITHUB_BASE_REF", () => {
  assert.equal(resolveBaseRef("HEAD~1", "master"), "HEAD~1");
  assert.equal(resolveBaseRef(undefined, "master"), "origin/master");
  assert.equal(resolveBaseRef(undefined, undefined), "origin/master");
});

test("parseUnifiedDiff reads added lines from -U0 hunks", () => {
  const changed =
    parseUnifiedDiff(`diff --git a/sources/example.ts b/sources/example.ts
--- a/sources/example.ts
+++ b/sources/example.ts
@@ -10,0 +11,2 @@
+line1
+line2
`);
  assert.deepEqual(
    [...(changed.get("sources/example.ts") ?? [])].sort(),
    [11, 12],
  );
});

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_AUTHOR_NAME: "patch-miss-test",
  GIT_AUTHOR_EMAIL: "patch-miss-test@example.com",
  GIT_COMMITTER_NAME: "patch-miss-test",
  GIT_COMMITTER_EMAIL: "patch-miss-test@example.com",
};

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" });
}

test("CLI --base diffs that ref and exits 1 when the table is non-empty", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-cli-"));
  git(["init", "-b", "main"], root);
  git(
    ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "base"],
    root,
  );
  writeSource(
    root,
    "sources/example.ts",
    "export function f() {\n  hit();\n  miss();\n}\n",
  );
  git(["add", "sources/example.ts"], root);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "head"], root);
  const lcovPath = path.join(root, "lcov.info");
  fs.writeFileSync(
    lcovPath,
    `TN:
SF:sources/example.ts
DA:3,0
end_of_record
`,
  );

  let status = 0;
  let output = "";
  try {
    execFileSync(
      process.execPath,
      [
        SCRIPT,
        "--base",
        "HEAD~1",
        "--lcov",
        lcovPath,
        "--roots",
        "sources",
        "--root",
        root,
      ],
      { cwd: root, encoding: "utf8" },
    );
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    status = err.status ?? 1;
    output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }

  assert.equal(status, 1);
  assert.match(output, /sources\/example\.ts:3\tmiss\(\);/);
});

test("CLI --no-fail prints the table and exits 0", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "patch-miss-nofail-"));
  git(["init", "-b", "main"], root);
  git(
    ["-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "base"],
    root,
  );
  writeSource(
    root,
    "sources/example.ts",
    "export function f() {\n  hit();\n  miss();\n}\n",
  );
  git(["add", "sources/example.ts"], root);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "head"], root);
  const lcovPath = path.join(root, "lcov.info");
  fs.writeFileSync(
    lcovPath,
    `TN:
SF:sources/example.ts
DA:3,0
end_of_record
`,
  );

  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      "--no-fail",
      "--base",
      "HEAD~1",
      "--lcov",
      lcovPath,
      "--roots",
      "sources",
      "--root",
      root,
    ],
    { cwd: root, encoding: "utf8" },
  );

  assert.equal(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /sources\/example\.ts:3\tmiss\(\);/,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultRepoRoot,
  formatLinkError,
  isDirectExecution,
  linkAgentSkills,
  main,
  parseRootArg,
  posixRelativeSkillTarget,
  runIfDirect,
} from "../../../scripts/link-agent-skills.ts";

function makeSkillRoot(skillName = "catalog"): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "link-skills-"));
  fs.mkdirSync(path.join(root, ".agents", "skills", skillName), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(root, ".agents", "skills", skillName, "SKILL.md"),
    "---\nname: catalog\n---\n",
  );
  return root;
}

function claudeDest(root: string, name = "catalog"): string {
  return path.join(root, ".claude", "skills", name);
}

test("posixRelativeSkillTarget is a repo-relative POSIX path", () => {
  assert.equal(
    posixRelativeSkillTarget("catalog"),
    "../../.agents/skills/catalog",
  );
});

test("formatLinkError uses Error.message or String(error)", () => {
  assert.equal(formatLinkError(new Error("boom")), "boom");
  assert.equal(formatLinkError("plain"), "plain");
});

test("parseRootArg reads --root and rejects a missing value", () => {
  assert.equal(parseRootArg(["--other"]), undefined);
  assert.equal(parseRootArg(["--root", "/tmp/skills"]), "/tmp/skills");
  assert.throws(() => parseRootArg(["--root"]), /Missing value for --root/);
  assert.throws(() => parseRootArg(["--root", ""]), /Missing value for --root/);
});

test("isDirectExecution compares argv1 to this module", () => {
  const scriptPath = fileURLToPath(
    new URL("../../../scripts/link-agent-skills.ts", import.meta.url),
  );
  assert.equal(isDirectExecution(undefined), false);
  assert.equal(isDirectExecution(""), false);
  assert.equal(isDirectExecution(scriptPath), true);
  assert.equal(isDirectExecution("/tmp/other.ts"), false);
});

test("defaultRepoRoot is the repository root", () => {
  assert.ok(fs.existsSync(path.join(defaultRepoRoot(), "package.json")));
});

test("linkAgentSkills creates a POSIX symlink and is a no-op on the second run", () => {
  const root = makeSkillRoot();
  linkAgentSkills({ root });
  const dest = claudeDest(root);
  assert.ok(fs.lstatSync(dest).isSymbolicLink());
  assert.equal(fs.readlinkSync(dest), posixRelativeSkillTarget("catalog"));
  assert.ok(
    fs.existsSync(path.join(dest, "SKILL.md")),
    "link should resolve to the canonical SKILL.md",
  );

  linkAgentSkills({
    root,
    symlink() {
      throw new Error("should not create");
    },
  });
});

test("linkAgentSkills skips directories without SKILL.md and non-directories", () => {
  const root = makeSkillRoot();
  fs.mkdirSync(path.join(root, ".agents", "skills", "notes"));
  fs.writeFileSync(path.join(root, ".agents", "skills", "README.md"), "x");
  linkAgentSkills({ root });
  assert.equal(fs.existsSync(claudeDest(root, "notes")), false);
  assert.equal(fs.existsSync(claudeDest(root, "README.md")), false);
});

test("linkAgentSkills replaces a leftover regular file", () => {
  const root = makeSkillRoot();
  const dest = claudeDest(root);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, posixRelativeSkillTarget("catalog"));
  linkAgentSkills({ root });
  assert.ok(fs.lstatSync(dest).isSymbolicLink());
  assert.equal(fs.readlinkSync(dest), posixRelativeSkillTarget("catalog"));
});

test("linkAgentSkills replaces a symlink that points at the wrong target", () => {
  const root = makeSkillRoot();
  const dest = claudeDest(root);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.symlinkSync("/tmp/other-skill", dest);
  linkAgentSkills({ root });
  assert.equal(fs.readlinkSync(dest), posixRelativeSkillTarget("catalog"));
});

test("linkAgentSkills refuses a real non-link directory", () => {
  const root = makeSkillRoot();
  const dest = claudeDest(root);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, "SKILL.md"), "nope");
  assert.throws(
    () => linkAgentSkills({ root }),
    /\.claude\/skills\/catalog is a directory, not a link/,
  );
});

test("linkAgentSkills throws when .agents/skills is missing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "link-skills-missing-"));
  assert.throws(() => linkAgentSkills({ root }), /Missing \.agents\/skills/);
});

test("linkAgentSkills uses a Windows junction with an absolute target", () => {
  const root = makeSkillRoot();
  const calls: { target: string; dest: string; type?: string }[] = [];
  linkAgentSkills({
    root,
    platform: "win32",
    symlink(target, dest, type) {
      calls.push({ target, dest, type });
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, "junction");
  assert.ok(path.isAbsolute(calls[0].target));
  assert.equal(
    calls[0].target,
    path.resolve(root, ".agents", "skills", "catalog"),
  );
  assert.equal(calls[0].dest, claudeDest(root));
});

test("linkAgentSkills rethrows unexpected lstat errors", () => {
  const root = makeSkillRoot();
  assert.throws(
    () =>
      linkAgentSkills({
        root,
        lstatSync: () => {
          throw Object.assign(new Error("denied"), { code: "EACCES" });
        },
      }),
    { message: "denied" },
  );
});

test("linkAgentSkills replaces a symlink when readlink fails", () => {
  const root = makeSkillRoot();
  linkAgentSkills({ root });
  let replaced = false;
  linkAgentSkills({
    root,
    readlinkSync: () => {
      throw new Error("unreadable");
    },
    symlink() {
      replaced = true;
    },
  });
  assert.equal(replaced, true);
});

test("main with no args uses the repository root", () => {
  const previous = process.exitCode;
  process.exitCode = 0;
  main([]);
  assert.equal(process.exitCode, 0);
  const dest = path.join(defaultRepoRoot(), ".claude", "skills", "catalog");
  assert.ok(fs.lstatSync(dest).isSymbolicLink());
  process.exitCode = previous;
});

test("main --root links the fixture and failure sets exitCode", () => {
  const root = makeSkillRoot();
  const previous = process.exitCode;
  process.exitCode = 0;
  main(["--root", root]);
  assert.equal(process.exitCode, 0);
  assert.ok(fs.lstatSync(claudeDest(root)).isSymbolicLink());

  main(["--root"]);
  assert.equal(process.exitCode, 1);
  process.exitCode = previous;
});

test("runIfDirect runs only when argv1 is this module", () => {
  const scriptPath = fileURLToPath(
    new URL("../../../scripts/link-agent-skills.ts", import.meta.url),
  );
  let ran = 0;
  runIfDirect(undefined, () => {
    ran += 1;
  });
  runIfDirect(scriptPath, () => {
    ran += 1;
  });
  assert.equal(ran, 1);
});

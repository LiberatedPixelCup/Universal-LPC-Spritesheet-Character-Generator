import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_SKILLS = ".agents/skills";
const CLAUDE_SKILLS = ".claude/skills";
const SKILL_FILE = "SKILL.md";

export type SymlinkFn = (
  target: string,
  dest: string,
  type?: "dir" | "file" | "junction",
) => void;

export type LinkAgentSkillsOptions = {
  root: string;
  platform?: string;
  symlink?: SymlinkFn;
  mkdirSync?: typeof fs.mkdirSync;
  readdirSync?: typeof fs.readdirSync;
  existsSync?: typeof fs.existsSync;
  lstatSync?: typeof fs.lstatSync;
  readlinkSync?: (dest: string) => string;
  rmSync?: typeof fs.rmSync;
};

type DestKind = "missing" | "symlink" | "file" | "directory";

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function posixRelativeSkillTarget(name: string): string {
  return `../../.agents/skills/${name}`;
}

export function formatLinkError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseRootArg(argv: readonly string[]): string | undefined {
  const index = argv.indexOf("--root");
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value === "") {
    throw new Error("Missing value for --root");
  }
  return value;
}

export function defaultRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function isDirectExecution(
  argv1: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
): boolean {
  if (!argv1) return false;
  return fileURLToPath(moduleUrl) === path.resolve(argv1);
}

function destKind(dest: string, lstatSync: typeof fs.lstatSync): DestKind {
  try {
    const stat = lstatSync(dest);
    if (stat.isSymbolicLink()) return "symlink";
    if (stat.isDirectory()) return "directory";
    return "file";
  } catch (error) {
    if (isEnoent(error)) return "missing";
    throw error;
  }
}

function linkResolvesTo(
  dest: string,
  expectedAbs: string,
  readlinkSync: (dest: string) => string,
): boolean {
  try {
    const raw = readlinkSync(dest);
    const resolved = path.isAbsolute(raw)
      ? path.resolve(raw)
      : path.resolve(path.dirname(dest), raw);
    return resolved === path.resolve(expectedAbs);
  } catch {
    return false;
  }
}

export function linkAgentSkills(options: LinkAgentSkillsOptions): void {
  const {
    root,
    platform = process.platform,
    symlink = fs.symlinkSync,
    mkdirSync = fs.mkdirSync,
    readdirSync = fs.readdirSync,
    existsSync = fs.existsSync,
    lstatSync = fs.lstatSync,
    readlinkSync = fs.readlinkSync,
    rmSync = fs.rmSync,
  } = options;

  const agentsDir = path.join(root, AGENTS_SKILLS);
  const claudeDir = path.join(root, CLAUDE_SKILLS);

  if (!existsSync(agentsDir)) {
    throw new Error(`Missing ${AGENTS_SKILLS} under ${root}`);
  }

  mkdirSync(claudeDir, { recursive: true });

  const names = readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(agentsDir, name, SKILL_FILE)));

  for (const name of names) {
    const dest = path.join(claudeDir, name);
    const targetAbs = path.resolve(agentsDir, name);
    const targetRel = posixRelativeSkillTarget(name);
    const kind = destKind(dest, lstatSync);

    if (kind === "directory") {
      throw new Error(
        `${path.join(CLAUDE_SKILLS, name)} is a directory, not a link. Remove it and run npm run skills:link.`,
      );
    }

    if (kind === "symlink" && linkResolvesTo(dest, targetAbs, readlinkSync)) {
      continue;
    }

    if (kind === "file" || kind === "symlink") {
      rmSync(dest, { recursive: true, force: true });
    }

    if (platform === "win32") {
      symlink(targetAbs, dest, "junction");
    } else {
      symlink(targetRel, dest);
    }
  }
}

export function main(argv: readonly string[] = process.argv.slice(2)): void {
  try {
    const root = parseRootArg(argv) ?? defaultRepoRoot();
    linkAgentSkills({ root });
  } catch (error) {
    console.error(formatLinkError(error));
    process.exitCode = 1;
  }
}

export function runIfDirect(
  argv1: string | undefined = process.argv[1],
  run: () => void = main,
): void {
  if (!isDirectExecution(argv1)) return;
  run();
}

runIfDirect();

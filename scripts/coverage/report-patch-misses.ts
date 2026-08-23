import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PatchMiss = {
  path: string;
  line: number;
  source: string;
};

export type CollectPatchMissesOptions = {
  lcov: string;
  changedLines: Map<string, Set<number>>;
  roots: string[];
  ignore: string[];
  sourceRoot: string;
};

export function isDirectExecution(
  argv1: string | undefined = process.argv[1],
  moduleUrl: string = import.meta.url,
): boolean {
  if (!argv1) return false;
  return fileURLToPath(moduleUrl) === path.resolve(argv1);
}

export function resolveBaseRef(
  base?: string,
  githubBaseRef: string | undefined = process.env.GITHUB_BASE_REF,
): string {
  if (base) return base;
  if (githubBaseRef) return `origin/${githubBaseRef}`;
  return "origin/master";
}

export function parseArgValue(
  argv: readonly string[],
  flag: string,
): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value === "") {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

export function parseArgValues(
  argv: readonly string[],
  flag: string,
): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== flag) continue;
    const value = argv[i + 1];
    if (value === undefined || value === "") {
      throw new Error(`Missing value for ${flag}`);
    }
    values.push(value);
    i += 1;
  }
  return values;
}

/**
 * Codecov `ignore:` is a flat list. Quoted values keep their inner text.
 */
export function parseCodecovIgnore(yaml: string): string[] {
  const result: string[] = [];
  let inIgnore = false;
  for (const line of yaml.split("\n")) {
    if (/^ignore:\s*$/.test(line)) {
      inIgnore = true;
      continue;
    }
    if (!inIgnore) continue;
    const item = /^\s+-\s+(.+)$/.exec(line);
    if (item) {
      result.push(item[1].replace(/^["']|["']$/g, ""));
      continue;
    }
    if (/^\S/.test(line) && line.trim() !== "") break;
  }
  return result;
}

export function globToRegExp(pattern: string): RegExp {
  let i = 0;
  let out = "^";
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) {
      out += "(?:.*/)?";
      i += 3;
      continue;
    }
    if (pattern.startsWith("**", i)) {
      out += ".*";
      i += 2;
      continue;
    }
    const ch = pattern[i] ?? "";
    if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else if (".+^${}()|[]\\".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
    i += 1;
  }
  return new RegExp(`${out}$`);
}

export function matchesIgnore(filePath: string, patterns: string[]): boolean {
  const normalized = posixPath(filePath);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

export function parseUnifiedDiff(diff: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let currentPath: string | undefined;
  for (const line of diff.split("\n")) {
    const git = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (git) {
      currentPath = git[2];
      continue;
    }
    const plus = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plus) {
      currentPath = plus[1];
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !currentPath) continue;
    const newStart = Number(hunk[1]);
    const newCount = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (newCount === 0) continue;
    let lines = result.get(currentPath);
    if (!lines) {
      lines = new Set();
      result.set(currentPath, lines);
    }
    for (let n = 0; n < newCount; n++) {
      lines.add(newStart + n);
    }
  }
  return result;
}

export function parseLcovDa(lcov: string): Map<string, Map<number, number>> {
  const files = new Map<string, Map<number, number>>();
  for (const record of lcov.split("end_of_record")) {
    const sfMatch = /^SF:(.+)$/m.exec(record);
    if (!sfMatch) continue;
    const da = new Map<number, number>();
    for (const line of record.split("\n")) {
      const row = /^DA:(\d+),(-?\d+)/.exec(line);
      if (!row) continue;
      da.set(Number(row[1]), Number(row[2]));
    }
    files.set(posixPath(sfMatch[1].trim()), da);
  }
  return files;
}

export function formatPatchMissTable(misses: PatchMiss[]): string {
  if (misses.length === 0) return "";
  const rows = misses.map(
    (miss) => `${miss.path}:${miss.line}\t${miss.source}`,
  );
  return `Patch coverage misses (${String(misses.length)}):\n${rows.join("\n")}\n`;
}

export function collectPatchMisses(
  options: CollectPatchMissesOptions,
): PatchMiss[] {
  const { lcov, changedLines, roots, ignore, sourceRoot } = options;
  const daByFile = parseLcovDa(lcov);
  const misses: PatchMiss[] = [];
  for (const [filePath, lines] of changedLines) {
    const rel = normalizeToRepoPath(filePath, sourceRoot);
    if (!pathIsUnderRoots(rel, roots)) continue;
    if (matchesIgnore(rel, ignore)) continue;
    const da = findDaMap(daByFile, rel, sourceRoot);
    if (!da) continue;
    for (const line of lines) {
      if (!da.has(line)) continue;
      if (da.get(line) !== 0) continue;
      misses.push({
        path: rel,
        line,
        source: readSourceLine(sourceRoot, rel, line),
      });
    }
  }
  misses.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  return misses;
}

export function changedLinesFromGit(options: {
  cwd: string;
  base: string;
}): Map<string, Set<number>> {
  const diff = execFileSync("git", ["diff", "-U0", options.base], {
    cwd: options.cwd,
    encoding: "utf8",
  });
  return parseUnifiedDiff(diff);
}

export function loadCodecovIgnore(sourceRoot: string): string[] {
  const yamlPath = path.join(sourceRoot, "codecov.yml");
  if (!fs.existsSync(yamlPath)) return [];
  return parseCodecovIgnore(fs.readFileSync(yamlPath, "utf8"));
}

export function reportPatchMissesFromLcov(options: {
  lcovPath: string;
  roots: string[];
  sourceRoot?: string;
  base?: string;
  changedLines?: Map<string, Set<number>>;
  ignore?: string[];
  write?: (text: string) => void;
  failOnMiss?: boolean;
}): { misses: PatchMiss[]; exitCode: number } {
  const sourceRoot = options.sourceRoot ?? process.cwd();
  const write = options.write ?? ((text) => console.error(text));
  const failOnMiss = options.failOnMiss ?? true;
  const lcov = fs.readFileSync(options.lcovPath, "utf8");
  const ignore = options.ignore ?? loadCodecovIgnore(sourceRoot);
  let changedLines = options.changedLines;
  if (!changedLines) {
    const base = resolveBaseRef(options.base);
    try {
      changedLines = changedLinesFromGit({ cwd: sourceRoot, base });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      write(
        `Could not diff against ${base}. Pass --base or fetch the PR base.\n${message}\n`,
      );
      return { misses: [], exitCode: failOnMiss ? 1 : 0 };
    }
  }
  const misses = collectPatchMisses({
    lcov,
    changedLines,
    roots: options.roots,
    ignore,
    sourceRoot,
  });
  const table = formatPatchMissTable(misses);
  if (table) write(table);
  return {
    misses,
    exitCode: failOnMiss && misses.length > 0 ? 1 : 0,
  };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const sourceRoot = parseArgValue(argv, "--root") ?? process.cwd();
  const base = parseArgValue(argv, "--base");
  const failOnMiss = !argv.includes("--no-fail");
  const explicitLcov = parseArgValues(argv, "--lcov");
  const explicitRoots = parseArgValues(argv, "--roots").flatMap((value) =>
    value.split(","),
  );
  const jobs =
    explicitLcov.length > 0
      ? explicitLcov.map((lcovPath, index) => ({
          lcovPath,
          roots: explicitRoots.length > 0 ? explicitRoots : defaultRoots(index),
        }))
      : defaultCoverageJobs(sourceRoot);

  if (jobs.length === 0) {
    console.error("No lcov.info found. Run a coverage command first.");
    return 1;
  }

  let exitCode = 0;
  for (const job of jobs) {
    const result = reportPatchMissesFromLcov({
      lcovPath: job.lcovPath,
      roots: job.roots,
      sourceRoot,
      base,
      failOnMiss,
    });
    if (result.exitCode !== 0) exitCode = 1;
  }
  return exitCode;
}

function defaultRoots(index: number): string[] {
  return index === 0 ? ["scripts"] : ["sources"];
}

function defaultCoverageJobs(
  sourceRoot: string,
): Array<{ lcovPath: string; roots: string[] }> {
  const jobs: Array<{ lcovPath: string; roots: string[] }> = [];
  const nodeLcov = path.join(sourceRoot, "coverage", "node", "lcov.info");
  const browserLcov = path.join(sourceRoot, "coverage", "browser", "lcov.info");
  if (fs.existsSync(nodeLcov)) {
    jobs.push({ lcovPath: nodeLcov, roots: ["scripts"] });
  }
  if (fs.existsSync(browserLcov)) {
    jobs.push({ lcovPath: browserLcov, roots: ["sources"] });
  }
  return jobs;
}

function posixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function normalizeToRepoPath(filePath: string, sourceRoot: string): string {
  const abs = path.resolve(sourceRoot, filePath);
  const root = path.resolve(sourceRoot);
  if (abs === root) return "";
  if (abs.startsWith(root + path.sep) || abs.startsWith(`${root}/`)) {
    return posixPath(path.relative(root, abs));
  }
  return posixPath(filePath);
}

function pathIsUnderRoots(rel: string, roots: string[]): boolean {
  return roots.some((root) => {
    const prefix = posixPath(root).replace(/\/+$/, "");
    return rel === prefix || rel.startsWith(`${prefix}/`);
  });
}

function findDaMap(
  daByFile: Map<string, Map<number, number>>,
  rel: string,
  sourceRoot: string,
): Map<number, number> | undefined {
  const direct = daByFile.get(rel);
  if (direct) return direct;
  const abs = posixPath(path.resolve(sourceRoot, rel));
  const byAbs = daByFile.get(abs);
  if (byAbs) return byAbs;
  for (const [sf, da] of daByFile) {
    if (normalizeToRepoPath(sf, sourceRoot) === rel) return da;
  }
  return undefined;
}

function readSourceLine(sourceRoot: string, rel: string, line: number): string {
  const abs = path.resolve(sourceRoot, rel);
  if (!fs.existsSync(abs)) return "";
  const lines = fs.readFileSync(abs, "utf8").split("\n");
  return (lines[line - 1] ?? "").trim();
}

if (isDirectExecution()) {
  process.exitCode = main();
}

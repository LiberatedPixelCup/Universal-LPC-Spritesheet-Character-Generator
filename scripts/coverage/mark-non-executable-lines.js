import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

/**
 * 1-based line numbers that contain no executable tokens (blank lines and
 * comments, including JSDoc). Trailing comments on a code line do not qualify.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
export function nonExecutableLineNumbers(text) {
  const lineCount = text.length === 0 ? 0 : text.split("\n").length;
  const hasCode = new Array(lineCount + 1).fill(false);

  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    text,
  );

  let kind = scanner.scan();
  while (kind !== ts.SyntaxKind.EndOfFileToken) {
    const isComment =
      kind === ts.SyntaxKind.SingleLineCommentTrivia ||
      kind === ts.SyntaxKind.MultiLineCommentTrivia;
    const isWhitespace =
      kind === ts.SyntaxKind.WhitespaceTrivia ||
      kind === ts.SyntaxKind.NewLineTrivia;
    if (!isComment && !isWhitespace) {
      const start = scanner.getTokenPos();
      const end = scanner.getTextPos();
      const startLine = lineOfOffset(text, start);
      const endLine = lineOfOffset(text, Math.max(start, end - 1));
      for (let line = startLine; line <= endLine; line++) {
        hasCode[line] = true;
      }
    }
    kind = scanner.scan();
  }

  const result = new Set();
  for (let line = 1; line <= lineCount; line++) {
    if (!hasCode[line]) result.add(line);
  }
  return result;
}

/**
 * Marks comment and blank lines as hit in an lcov.info file so Codecov patch
 * does not fail on documentation-only diffs.
 *
 * @param {string} lcovPath
 * @param {{ root?: string }} [options]
 * @returns {string} Updated lcov contents
 */
export function markNonExecutableLinesInLcov(lcovPath, options = {}) {
  const root = options.root ?? process.cwd();
  const original = fs.readFileSync(lcovPath, "utf8");
  const updated = applyNonExecutableHits(original, root);
  fs.writeFileSync(lcovPath, updated);
  return updated;
}

/**
 * @param {string} lcov
 * @param {string} root
 * @returns {string}
 */
export function applyNonExecutableHits(lcov, root) {
  const records = lcov.split("end_of_record\n");
  const last = records.pop() ?? "";
  const rewritten = records.map(
    (record) => processRecord(record, root) + "end_of_record\n",
  );
  return rewritten.join("") + last;
}

/**
 * @param {string} record
 * @param {string} root
 * @returns {string}
 */
function processRecord(record, root) {
  const sfMatch = record.match(/^SF:(.+)$/m);
  if (!sfMatch) return record;

  const sourcePath = path.resolve(root, sfMatch[1].trim());
  if (!fs.existsSync(sourcePath)) return record;

  const text = fs.readFileSync(sourcePath, "utf8");
  const nonExec = nonExecutableLineNumbers(text);
  if (nonExec.size === 0) return record;

  /** @type {Map<number, number>} */
  const daHits = new Map();
  const otherLines = [];
  for (const line of record.split("\n")) {
    const da = /^DA:(\d+),(-?\d+)/.exec(line);
    if (da) {
      daHits.set(Number(da[1]), Number(da[2]));
      continue;
    }
    if (/^LF:/.test(line) || /^LH:/.test(line)) continue;
    otherLines.push(line);
  }

  for (const line of nonExec) {
    const prev = daHits.get(line);
    if (prev == null || prev <= 0) daHits.set(line, 1);
  }

  const daLines = [...daHits.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([line, hits]) => `DA:${line},${hits}`);
  const lf = daHits.size;
  const lh = [...daHits.values()].filter((hits) => hits > 0).length;

  const body = otherLines.filter(
    (line, i) => !(i === otherLines.length - 1 && line === ""),
  );
  return [...body, ...daLines, `LF:${lf}`, `LH:${lh}`, ""].join("\n");
}

/**
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function lineOfOffset(text, offset) {
  let line = 1;
  const limit = Math.min(offset, text.length);
  for (let i = 0; i < limit; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

const thisFile = fileURLToPath(import.meta.url);
const invokedAsMain =
  process.argv[1] != null && path.resolve(process.argv[1]) === thisFile;

if (invokedAsMain) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error(
      "Usage: node scripts/coverage/mark-non-executable-lines.js <lcov.info>...",
    );
    process.exit(1);
  }
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      console.error(`No lcov file at ${target}`);
      process.exit(1);
    }
    markNonExecutableLinesInLcov(target);
  }
}

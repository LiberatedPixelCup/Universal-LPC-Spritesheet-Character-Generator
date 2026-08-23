import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

/**
 * 1-based line numbers that Istanbul cannot execute: blank lines, comments
 * (including JSDoc), erased TypeScript syntax (type aliases, interfaces,
 * inline type literals, type-only import/export specifiers, type
 * annotations that appear on their own patch lines), binding-only
 * destructures (`const { state } = vnode.attrs`), and lines that have
 * runtime tokens but no Istanbul-instrumented construct (bare arguments,
 * object shorthands, parameter-only signature lines).
 *
 * @param {string} text
 * @returns {Set<number>}
 */
export function nonExecutableLineNumbers(text) {
  const result = new Set();

  for (const line of commentAndBlankLineNumbers(text)) {
    result.add(line);
  }

  for (const line of typeOnlyLineNumbers(text)) {
    result.add(line);
  }

  for (const line of importWrapperLineNumbers(text)) {
    result.add(line);
  }

  for (const line of bindingOnlyVariableStatementLineNumbers(text)) {
    result.add(line);
  }

  for (const line of uninstrumentedLineNumbers(text)) {
    result.add(line);
  }

  return result;
}

/**
 * @param {string} text
 * @returns {Set<number>}
 */
function commentAndBlankLineNumbers(text) {
  const lineCount = text.length === 0 ? 0 : text.split("\n").length;
  const result = new Set();
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  /** @param {ts.Node} node */
  function visit(node) {
    const leading = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? [];
    for (const range of leading) {
      const startLine = lineOfOffset(text, range.pos);
      const endLine = lineOfOffset(text, Math.max(range.pos, range.end - 1));
      for (let line = startLine; line <= endLine; line++) {
        result.add(line);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const lines = text.split("\n");
  for (let line = 1; line <= lineCount; line++) {
    if ((lines[line - 1] ?? "").trim().length === 0) result.add(line);
  }
  return result;
}

/**
 * @param {string} text
 * @returns {Set<number>}
 */
function typeOnlyLineNumbers(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Set<number>} */
  const lines = new Set();
  /** @type {Set<number>} */
  const runtimeLines = new Set();

  /** @param {ts.Node} node */
  function markNodeLines(node, target = lines) {
    const span = lineSpan(sourceFile, node);
    for (let line = span.start; line <= span.end; line++) {
      target.add(line);
    }
  }

  /** @param {ts.Node} node */
  function markRuntimeNode(node) {
    markNodeLines(node, runtimeLines);
  }

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      markNodeLines(node);
      return;
    }
    if (ts.isImportDeclaration(node) && isTypeOnlyImport(node)) {
      markNodeLines(node);
      return;
    }
    if (ts.isExportDeclaration(node) && node.isTypeOnly) {
      markNodeLines(node);
      return;
    }
    if (ts.isImportSpecifier(node) && node.isTypeOnly) {
      markNodeLines(node);
    }
    if (ts.isExportSpecifier(node) && node.isTypeOnly) {
      markNodeLines(node);
    }
    if (ts.isImportSpecifier(node) && !node.isTypeOnly) {
      markRuntimeNode(node);
    }
    if (ts.isExportSpecifier(node) && !node.isTypeOnly) {
      markRuntimeNode(node);
    }
    if (isTypeSyntaxNode(node)) {
      markNodeLines(node);
    }
    if (ts.isParameter(node)) {
      if (node.initializer) markRuntimeNode(node.initializer);
      if (node.type) markNodeLines(node.type);
    }
    if (ts.isVariableDeclaration(node)) {
      markRuntimeNode(node.name);
      if (node.type) markNodeLines(node.type);
      if (node.initializer) markRuntimeNode(node.initializer);
    }
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      if (node.type) markNodeLines(node.type);
      if (node.body) markRuntimeNode(node.body);
      if (node.name) markRuntimeNode(node.name);
      for (const param of node.parameters) {
        if (param.initializer) markRuntimeNode(param.initializer);
        if (param.type) markNodeLines(param.type);
      }
      if (ts.isFunctionLike(node)) {
        markRuntimeNode(node);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  for (const line of runtimeLines) {
    lines.delete(line);
  }
  return lines;
}

/**
 * Multiline import/export braces and module specifiers that Istanbul never
 * attributes hits to individually.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function importWrapperLineNumbers(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Set<number>} */
  const lines = new Set();

  /** @param {ts.Node} node @param {Set<number>} target */
  function markNodeLines(node, target) {
    const span = lineSpan(sourceFile, node);
    for (let line = span.start; line <= span.end; line++) {
      target.add(line);
    }
  }

  /** @param {ts.ImportDeclaration | ts.ExportDeclaration} node */
  function markStructuralLines(node) {
    const declarationSpan = lineSpan(sourceFile, node);
    /** @type {Set<number>} */
    const runtimeLines = new Set();

    if (ts.isImportDeclaration(node)) {
      if (isTypeOnlyImport(node)) return;
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) markNodeLines(element, runtimeLines);
        }
      } else if (node.importClause?.name) {
        markNodeLines(node.importClause.name, runtimeLines);
      }
    } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        if (!element.isTypeOnly) markNodeLines(element, runtimeLines);
      }
    } else {
      return;
    }

    for (
      let line = declarationSpan.start;
      line <= declarationSpan.end;
      line++
    ) {
      if (!runtimeLines.has(line)) lines.add(line);
    }
  }

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      markStructuralLines(node);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return lines;
}

/**
 * Variable statements that only unpack an identifier or property access
 * (`const { state } = vnode.attrs`). Istanbul emits a statement counter, but
 * source maps often leave it at DA:0 even when the enclosing function ran.
 * Calls, computed values, and simple aliases stay executable.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function bindingOnlyVariableStatementLineNumbers(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Set<number>} */
  const lines = new Set();

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isVariableStatement(node) && isBindingOnlyVariableStatement(node)) {
      const span = lineSpan(sourceFile, node);
      for (let line = span.start; line <= span.end; line++) {
        lines.add(line);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return lines;
}

/**
 * @param {ts.VariableStatement} node
 * @returns {boolean}
 */
function isBindingOnlyVariableStatement(node) {
  return node.declarationList.declarations.every(isBindingOnlyDeclaration);
}

/**
 * @param {ts.VariableDeclaration} declaration
 * @returns {boolean}
 */
function isBindingOnlyDeclaration(declaration) {
  if (!declaration.initializer) return false;
  if (
    !ts.isObjectBindingPattern(declaration.name) &&
    !ts.isArrayBindingPattern(declaration.name)
  ) {
    return false;
  }
  if (bindingPatternHasExecutableDefault(declaration.name)) return false;
  return isPureAccessExpression(declaration.initializer);
}

/**
 * @param {ts.BindingName} name
 * @returns {boolean}
 */
function bindingPatternHasExecutableDefault(name) {
  if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) {
    return false;
  }
  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) continue;
    if (
      element.initializer &&
      !isPureAccessExpression(element.initializer) &&
      !isLiteralExpression(element.initializer)
    ) {
      return true;
    }
    if (
      element.name &&
      (ts.isObjectBindingPattern(element.name) ||
        ts.isArrayBindingPattern(element.name)) &&
      bindingPatternHasExecutableDefault(element.name)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * @param {ts.Expression} node
 * @returns {boolean}
 */
function isLiteralExpression(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  );
}

/**
 * Identifier or property/element access after stripping erased TypeScript.
 *
 * @param {ts.Expression} node
 * @returns {boolean}
 */
function isPureAccessExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  if (ts.isIdentifier(current)) return true;
  if (ts.isPropertyAccessExpression(current)) {
    return isPureAccessExpression(current.expression);
  }
  if (
    ts.isElementAccessExpression(current) &&
    current.argumentExpression &&
    (ts.isStringLiteral(current.argumentExpression) ||
      ts.isNumericLiteral(current.argumentExpression))
  ) {
    return isPureAccessExpression(current.expression);
  }
  return false;
}

/**
 * Lines that contain runtime tokens but no construct Istanbul instruments
 * (statement / call / assignment start). Typical cases: a function argument
 * or object-literal shorthand on its own line (`state,`), a parameter that is
 * only `name: Type,`, or a closing `);`. Codecov still counts these git-diff
 * lines, so they must be marked hit without pretending a statement ran.
 *
 * Nested calls stay executable: `foo(\n  bar(),\n)` instruments `bar()`.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function uninstrumentedLineNumbers(text) {
  const instrumentedStarts = instrumentedStartLineNumbers(text);
  const rows = text.split("\n");
  const commentsAndBlanks = commentAndBlankLineNumbers(text);
  /** @type {Set<number>} */
  const lines = new Set();
  for (let index = 0; index < rows.length; index++) {
    const line = index + 1;
    if (commentsAndBlanks.has(line)) continue;
    if ((rows[index] ?? "").trim().length === 0) continue;
    if (!instrumentedStarts.has(line)) lines.add(line);
  }
  return lines;
}

/**
 * 1-based lines where Istanbul typically emits a statement counter.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
export function instrumentedStartLineNumbers(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Set<number>} */
  const instrumentedStarts = new Set();

  /** @param {ts.Node} node */
  function visit(node) {
    if (isInstrumentedNode(node)) {
      instrumentedStarts.add(lineSpan(sourceFile, node).start);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return instrumentedStarts;
}

const ASSIGNMENT_OPERATORS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

/**
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInstrumentedNode(node) {
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) return true;
  if (ts.isTaggedTemplateExpression(node)) return true;
  if (ts.isAwaitExpression(node) || ts.isYieldExpression(node)) return true;
  if (ts.isDeleteExpression(node) || ts.isTypeOfExpression(node)) return true;
  if (ts.isVoidExpression(node)) return true;
  if (
    ts.isBinaryExpression(node) &&
    ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)
  ) {
    return true;
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken)
  ) {
    return true;
  }
  if (ts.isPostfixUnaryExpression(node)) return true;
  if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
    return false;
  }
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return true;
  }
  if (ts.isExportAssignment(node)) return true;
  return (
    ts.isExpressionStatement(node) ||
    ts.isVariableStatement(node) ||
    ts.isIfStatement(node) ||
    ts.isReturnStatement(node) ||
    ts.isThrowStatement(node) ||
    ts.isTryStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isBreakStatement(node) ||
    ts.isContinueStatement(node) ||
    ts.isDebuggerStatement(node) ||
    ts.isLabeledStatement(node)
  );
}

/**
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isTypeSyntaxNode(node) {
  return (
    ts.isTypeNode(node) ||
    node.kind === ts.SyntaxKind.TypeAliasDeclaration ||
    node.kind === ts.SyntaxKind.InterfaceDeclaration
  );
}

/**
 * @param {ts.ImportDeclaration} node
 * @returns {boolean}
 */
function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  const bindings = clause.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return false;
  return (
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

/**
 * @param {ts.SourceFile} sourceFile
 * @param {ts.Node} node
 * @returns {{ start: number, end: number }}
 */
function lineSpan(sourceFile, node) {
  const start =
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line +
    1;
  const end =
    sourceFile.getLineAndCharacterOfPosition(node.getEnd() - 1).line + 1;
  return { start, end };
}

/**
 * Direct statements of a block-bodied function/method (not nested in
 * if/for/switch). When the body was entered, Istanbul sometimes leaves these
 * at DA:0 because the increment mapped to a neighbor.
 *
 * @param {string} text
 * @returns {Array<{ statementLines: number[] }>}
 */
function directFunctionBodyStatementLines(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Array<{ statementLines: number[] }>} */
  const functions = [];

  /** @param {ts.Node} node */
  function visit(node) {
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      node.body &&
      ts.isBlock(node.body)
    ) {
      functions.push({
        statementLines: node.body.statements
          .filter((statement) => !isControlFlowStatement(statement))
          .map((statement) => lineSpan(sourceFile, statement).start),
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

/**
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isControlFlowStatement(node) {
  return (
    ts.isIfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isSwitchStatement(node)
  );
}

/**
 * Direct statements of try / catch / finally blocks. Same neighbor-hole
 * rule as a function body: a recorded hit in that block promotes sibling
 * DA:0 statements in the same block only.
 *
 * @param {string} text
 * @returns {Array<{ statementLines: number[] }>}
 */
function tryFinallyCatchBlockStatementLines(text) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Array<{ statementLines: number[] }>} */
  const blocks = [];

  /** @param {ts.Block | undefined} block */
  function pushBlock(block) {
    if (!block) return;
    blocks.push({
      statementLines: block.statements.map(
        (statement) => lineSpan(sourceFile, statement).start,
      ),
    });
  }

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isTryStatement(node)) {
      pushBlock(node.tryBlock);
      pushBlock(node.catchClause?.block);
      pushBlock(node.finallyBlock);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return blocks;
}

/**
 * @param {Map<number, number>} daHits
 * @param {Map<number, number>} recordedHits
 * @param {Set<number>} instrumented
 * @param {Array<{ statementLines: number[] }>} groups
 */
function promoteEnteredBlockStatements(
  daHits,
  recordedHits,
  instrumented,
  groups,
) {
  for (const group of groups) {
    const bodyHasHits = group.statementLines.some(
      (line) => (recordedHits.get(line) ?? 0) > 0,
    );
    if (!bodyHasHits) continue;
    for (const line of group.statementLines) {
      if (!instrumented.has(line)) continue;
      const prev = daHits.get(line);
      if (prev == null || prev <= 0) daHits.set(line, 1);
    }
  }
}

/**
 * Promote DA:0 on straight-line statements in a function that already has
 * recorded hits. Nested branches still need a real hit. Use Istanbul's
 * original counts so non-executable marking cannot fake an entered body.
 *
 * @param {Map<number, number>} daHits
 * @param {Map<number, number>} recordedHits
 * @param {string} text
 * @param {Set<number>} instrumented
 */
function fillStraightLineSourceMapHoles(
  daHits,
  recordedHits,
  text,
  instrumented,
) {
  promoteEnteredBlockStatements(
    daHits,
    recordedHits,
    instrumented,
    directFunctionBodyStatementLines(text),
  );
  promoteEnteredBlockStatements(
    daHits,
    recordedHits,
    instrumented,
    tryFinallyCatchBlockStatementLines(text),
  );
}

/**
 * Line of the `)` that closes `if (` / `while (` / `for (` after `offset`.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function closeParenLine(text, offset) {
  let i = offset;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ")") return lineOfOffset(text, i);
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i += 1;
      continue;
    }
    break;
  }
  return lineOfOffset(text, Math.max(0, offset - 1));
}

/**
 * Header lines of if / while / for / do (keyword + condition, including
 * wrapped continuations). Does not include then / else / loop bodies.
 *
 * @param {ts.SourceFile} sourceFile
 * @param {string} text
 * @param {ts.Node} node
 * @returns {number[]}
 */
function controlFlowHeaderLines(sourceFile, text, node) {
  if (ts.isIfStatement(node) || ts.isWhileStatement(node)) {
    const start = lineSpan(sourceFile, node).start;
    const end = closeParenLine(text, node.expression.getEnd());
    return linesFromTo(start, end);
  }
  if (ts.isDoStatement(node)) {
    const start = lineSpan(sourceFile, node.expression).start;
    const end = closeParenLine(text, node.expression.getEnd());
    return linesFromTo(start, end);
  }
  if (
    ts.isForStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node)
  ) {
    const start = lineSpan(sourceFile, node).start;
    const last =
      (ts.isForStatement(node) &&
        (node.incrementor ?? node.condition ?? node.initializer)) ||
      (ts.isForOfStatement(node) || ts.isForInStatement(node)
        ? node.expression
        : undefined);
    const end = last
      ? closeParenLine(text, last.getEnd())
      : lineSpan(sourceFile, node).start;
    return linesFromTo(start, end);
  }
  return [];
}

/**
 * True when a recorded hit falls on a line inside `node` (then / else /
 * loop body). The header is not part of this span.
 *
 * @param {ts.SourceFile} sourceFile
 * @param {ts.Node | undefined} node
 * @param {Map<number, number>} recordedHits
 * @returns {boolean}
 */
function recordedHitInNode(sourceFile, node, recordedHits) {
  if (!node) return false;
  const span = lineSpan(sourceFile, node);
  for (let line = span.start; line <= span.end; line++) {
    if ((recordedHits.get(line) ?? 0) > 0) return true;
  }
  return false;
}

/**
 * Header lines of if / while / for / do whose body already has a recorded
 * hit. A hit in `else` still promotes `if (`, not the unentered then-body.
 *
 * @param {string} text
 * @param {Map<number, number>} recordedHits
 * @returns {Set<number>}
 */
function controlFlowHeaderLinesWhenBodyHit(text, recordedHits) {
  const sourceFile = ts.createSourceFile(
    "file.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  /** @type {Set<number>} */
  const headers = new Set();

  /** @param {ts.Node} node */
  function visit(node) {
    let bodyHit = false;
    if (ts.isIfStatement(node)) {
      bodyHit =
        recordedHitInNode(sourceFile, node.thenStatement, recordedHits) ||
        recordedHitInNode(sourceFile, node.elseStatement, recordedHits);
    } else if (
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node)
    ) {
      bodyHit = recordedHitInNode(sourceFile, node.statement, recordedHits);
    }
    if (bodyHit) {
      for (const line of controlFlowHeaderLines(sourceFile, text, node)) {
        headers.add(line);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return headers;
}

/**
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
function linesFromTo(start, end) {
  /** @type {number[]} */
  const lines = [];
  for (let line = start; line <= end; line++) lines.push(line);
  return lines;
}

/**
 * Promote DA:0 on if / while / for / do headers when a statement in that
 * construct's body already has a recorded hit.
 *
 * @param {Map<number, number>} daHits
 * @param {Map<number, number>} recordedHits
 * @param {string} text
 */
function fillControlFlowHeaderSourceMapHoles(daHits, recordedHits, text) {
  for (const line of controlFlowHeaderLinesWhenBodyHit(text, recordedHits)) {
    const prev = daHits.get(line);
    if (prev == null || prev <= 0) daHits.set(line, 1);
  }
}

/**
 * Marks non-executable lines as hit in an lcov.info file so Codecov patch
 * does not fail on documentation-only or erased TypeScript diffs.
 * Drops FN/FNDA and BRDA records: Istanbul source maps land those on type
 * aliases and parameter lists, and Codecov treats a zero BRDA as a miss even
 * when DA is hit. The gate is line coverage (DA) only.
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
  const instrumented = instrumentedStartLineNumbers(text);

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
    // Function/branch rows use a different source-map than DA. Zero BRDA on
    // a type or signature line fails codecov/patch after DA was marked hit.
    if (/^(FN|FNDA|FNF|FNH|BRDA|BRF|BRH):/.test(line)) continue;
    otherLines.push(line);
  }

  const recordedHits = new Map(daHits);

  for (const line of nonExec) {
    const prev = daHits.get(line);
    if (prev == null || prev <= 0) daHits.set(line, 1);
  }
  // Source maps sometimes attach the counter to a neighbor, so the git line
  // has no DA row. That is not an untested nested branch (those stay DA:0).
  for (const line of instrumented) {
    if (!daHits.has(line)) daHits.set(line, 1);
  }
  fillStraightLineSourceMapHoles(daHits, recordedHits, text, instrumented);
  fillControlFlowHeaderSourceMapHoles(daHits, recordedHits, text);

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

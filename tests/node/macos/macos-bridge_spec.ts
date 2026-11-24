import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { stripTypeScriptTypes } from "node:module";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

describe("macos packaging and Electron bridge contracts", () => {
  it("strips macos/main.ts and transpiles macos/preload.ts cleanly", () => {
    const mainSource = fs.readFileSync(
      path.join(repoRoot, "macos/main.ts"),
      "utf8",
    );
    const strippedMain = stripTypeScriptTypes(mainSource);
    assert.ok(strippedMain.length > 0);
    assert.ok(strippedMain.includes("Content-Security-Policy"));
    assert.ok(strippedMain.includes("realpath"));

    const preloadSource = fs.readFileSync(
      path.join(repoRoot, "macos/preload.ts"),
      "utf8",
    );
    const transpiled = ts.transpileModule(preloadSource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    });
    assert.equal(transpiled.diagnostics?.length ?? 0, 0);
    assert.ok(transpiled.outputText.includes("contextBridge"));
  });

  it("keeps menu actions synchronized across macos/main.ts, macos/preload.ts, and sources/components/App.ts", () => {
    const mainSource = fs.readFileSync(
      path.join(repoRoot, "macos/main.ts"),
      "utf8",
    );
    const preloadSource = fs.readFileSync(
      path.join(repoRoot, "macos/preload.ts"),
      "utf8",
    );
    const appSource = fs.readFileSync(
      path.join(repoRoot, "sources/components/App.ts"),
      "utf8",
    );

    const mainActions = new Set(
      [...mainSource.matchAll(/sendMenuAction\("([^"]+)"\)/g)].map((m) => m[1]),
    );
    const preloadBlock = preloadSource.match(
      /VALID_MENU_ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/,
    );
    assert.ok(preloadBlock, "VALID_MENU_ACTIONS set must exist in preload.ts");
    const preloadActions = new Set(
      [...preloadBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]),
    );
    const appActions = new Set(
      [...appSource.matchAll(/action === "([^"]+)"/g)].map((m) => m[1]),
    );

    assert.deepEqual([...mainActions].sort(), [...preloadActions].sort());
    assert.deepEqual([...mainActions].sort(), [...appActions].sort());
  });

  it("enables glob expansion in package.json prebuild rimraf command", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const prebuild = pkg.scripts?.prebuild ?? "";
    assert.match(prebuild, /rimraf\s+(--glob|-g)\s+/);
    assert.ok(prebuild.includes("!(spritesheets)"));
  });
});

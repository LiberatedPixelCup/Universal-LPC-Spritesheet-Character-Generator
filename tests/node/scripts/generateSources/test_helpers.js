import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  readDirTree,
  resetGeneratorState,
} from "../../../../scripts/generateSources/state.mjs";
import { loadPaletteMetadata } from "../../../../scripts/generateSources/palettes.mjs";
import { parseTree } from "../../../../scripts/generateSources/tree.mjs";
import { parseItem } from "../../../../scripts/generateSources/items.mjs";
import { processItemCredits } from "../../../../scripts/generateSources/credits.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const generatorModuleUrl = pathToFileURL(
  projectPath("scripts", "generate_sources.mjs"),
).href;

let moduleLoadCounter = 0;

export function projectPath(...segments) {
  return path.join(projectRoot, ...segments);
}

export function buildPath(buildName, kind) {
  return projectPath("tests", "node", "scripts", buildName, kind);
}

export function resetTestState() {
  resetGeneratorState();
}

function extractTopLevelConstJson(outputText, constName) {
  const marker = `const ${constName} = `;
  const start = outputText.indexOf(marker);
  assert.ok(start >= 0, `Expected const ${constName} in generated metadata`);
  let i = start + marker.length;
  while (/\s/.test(outputText[i])) i += 1;
  assert.equal(
    outputText[i],
    "{",
    `const ${constName} should be an object literal`,
  );
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let j = i; j < outputText.length; j++) {
    const c = outputText[j];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(outputText.slice(i, j + 1));
      }
    }
  }
  throw new Error(`Unclosed object for const ${constName}`);
}

export function extractGlobalObjects(metadataJS) {
  return {
    itemMetadata: extractTopLevelConstJson(metadataJS, "itemMetadata"),
    aliasMetadata: extractTopLevelConstJson(metadataJS, "aliasMetadata"),
    categoryTree: extractTopLevelConstJson(metadataJS, "categoryTree"),
    paletteMetadata: extractTopLevelConstJson(metadataJS, "paletteMetadata"),
  };
}

export async function loadGeneratorModule() {
  moduleLoadCounter += 1;
  return import(`${generatorModuleUrl}?test=${moduleLoadCounter}`);
}

export async function runBuild(buildName, palettesBuildName = buildName) {
  const { generateSources } = await loadGeneratorModule();
  resetTestState();
  const writes = new Map();

  generateSources({
    writeMetadata: true,
    readDirTreeFn: () => readDirTree(buildPath(buildName, "sheets")),
    parseTreeFn: (filePath, fileName) =>
      parseTree(filePath, fileName, {
        sheetsDir: buildPath(buildName, "sheets"),
      }),
    parseItemFn: (filePath, fileName) =>
      parseItem(filePath, fileName, {
        sheetsDir: buildPath(buildName, "sheets"),
      }),
    processItemCreditsFn: (item, filePath, definition) =>
      processItemCredits(
        item,
        filePath,
        definition,
        buildPath(buildName, "sheets"),
      ),
    writeFileSync: (filePath, contents) => {
      writes.set(path.basename(filePath), String(contents));
    },
    loadPaletteMetadataFn: () =>
      loadPaletteMetadata({
        palettesDir: buildPath(palettesBuildName, "palettes"),
      }),
  });

  const csvGenerated = writes.get("CREDITS.csv") || "";
  const metadataJS = writes.get("item-metadata.js") || "";
  const globals = extractGlobalObjects(metadataJS);

  return {
    csvGenerated,
    metadataJS,
    globals,
  };
}

export async function withCapturedConsoleError(callback) {
  const original = console.error;
  const errors = [];
  console.error = (...args) => {
    errors.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const result = await callback();
    return { result, errors };
  } finally {
    console.error = original;
  }
}

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  METADATA_MODULE_BASENAMES,
  readDirTree,
  resetGeneratorState,
} from "../../../../scripts/generateSources/state.js";
import { loadPaletteMetadata } from "../../../../scripts/generateSources/palettes.js";
import {
  expandInternedItemLite,
  expandMetadataIndexesWithInternedArrays,
} from "../../../../sources/state/resolve-hash-param.ts";
import { parseTree } from "../../../../scripts/generateSources/tree.js";
import { parseItem } from "../../../../scripts/generateSources/items.js";
import { processItemCredits } from "../../../../scripts/generateSources/credits.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..", "..", "..");
const generatorModuleUrl = pathToFileURL(
  projectPath("scripts", "generate_sources.js"),
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

/**
 * Parses `const name =` followed by a JSON object or array (balanced `{` `[` with strings).
 * @param {string} outputText
 * @param {string} constName
 * @returns {object|Array}
 */
function extractTopLevelJsonLiteral(outputText, constName) {
  const marker = `const ${constName} = `;
  const start = outputText.indexOf(marker);
  assert.ok(start >= 0, `Expected const ${constName} in generated metadata`);
  let i = start + marker.length;
  while (/\s/.test(outputText[i])) i += 1;
  assert.ok(
    outputText[i] === "{" || outputText[i] === "[",
    `const ${constName} should be an object or array literal`,
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
    if (c === "{" || c === "[") depth += 1;
    else if (c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(outputText.slice(i, j + 1));
      }
    }
  }
  throw new Error(`Unclosed JSON for const ${constName}`);
}

function extractTopLevelConstJson(outputText, constName) {
  return extractTopLevelJsonLiteral(outputText, constName);
}

/**
 * Rebuilds full per-item metadata (lite + layers + credits) from captured generator writes.
 * @param {Map<string, string>} writes basename → file contents from generateSources
 */
export function mergeMetadataForTests(writes) {
  const indexSrc = writes.get("index-metadata.js") ?? "";
  const rawLite = extractTopLevelConstJson(
    writes.get("item-metadata.js") ?? "",
    "itemMetadata",
  );
  let lite = rawLite;
  if (indexSrc.includes("const variantArrays = ")) {
    const variantArrays = /** @type {string[][]} */ (
      extractTopLevelJsonLiteral(indexSrc, "variantArrays")
    );
    const recolorVariantArrays = /** @type {string[][]} */ (
      extractTopLevelJsonLiteral(indexSrc, "recolorVariantArrays")
    );
    lite = {};
    for (const id of Object.keys(rawLite)) {
      lite[id] = expandInternedItemLite(
        rawLite[id],
        variantArrays,
        recolorVariantArrays,
      );
    }
  }
  const layers = extractTopLevelConstJson(
    writes.get("layers-metadata.js") ?? "",
    "itemLayers",
  );
  const credits = extractTopLevelConstJson(
    writes.get("credits-metadata.js") ?? "",
    "itemCredits",
  );
  const itemMetadata = {};
  for (const id of Object.keys(lite)) {
    itemMetadata[id] = {
      ...lite[id],
      layers: layers[id] ?? {},
      credits: credits[id] ?? [],
    };
  }
  return itemMetadata;
}

/**
 * Parses all emitted metadata modules in `writes` into the same shapes the app used when
 * everything lived in one `item-metadata.js` file, plus `metadataIndexes` from `index-metadata.js`.
 * @param {Map<string, string>} writes basename → file contents from generateSources
 */
export function extractMetadataGlobalsFromWrites(writes) {
  const indexSrc = writes.get("index-metadata.js") ?? "";
  const byTypeName = /** @type {Record<string, object[]>} */ (
    extractTopLevelJsonLiteral(indexSrc, "byTypeName")
  );
  const metadataIndexes = indexSrc.includes("const variantArrays = ")
    ? expandMetadataIndexesWithInternedArrays({
        variantArrays: /** @type {string[][]} */ (
          extractTopLevelJsonLiteral(indexSrc, "variantArrays")
        ),
        recolorVariantArrays: /** @type {string[][]} */ (
          extractTopLevelJsonLiteral(indexSrc, "recolorVariantArrays")
        ),
        byTypeName,
        hashMatch: { itemsByTypeName: byTypeName },
      })
    : {
        byTypeName,
        hashMatch: { itemsByTypeName: byTypeName },
      };
  return {
    itemMetadata: mergeMetadataForTests(writes),
    aliasMetadata: extractTopLevelConstJson(indexSrc, "aliasMetadata"),
    categoryTree: extractTopLevelConstJson(indexSrc, "categoryTree"),
    paletteMetadata: extractTopLevelConstJson(
      writes.get("palette-metadata.js") ?? "",
      "paletteMetadata",
    ),
    metadataIndexes,
  };
}

export async function loadGeneratorModule() {
  moduleLoadCounter += 1;
  return import(`${generatorModuleUrl}?test=${moduleLoadCounter}`);
}

/**
 * @param {string} buildName Fixture under tests/node/scripts/{buildName}/sheets
 * @param {string} [palettesBuildName] Palette fixture dir (default same as buildName)
 * @param {{ env?: "development"|"production" }} [options] Passed to generateSources as deps.env
 */
export async function runBuild(
  buildName,
  palettesBuildName = buildName,
  options = {},
) {
  const { generateSources } = await loadGeneratorModule();
  resetTestState();
  const writes = new Map();
  const { env } = options;

  generateSources({
    writeMetadata: true,
    ...(env !== undefined ? { env } : {}),
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

  for (const basename of METADATA_MODULE_BASENAMES) {
    assert.ok(
      writes.has(basename),
      `expected generateSources to write ${basename}`,
    );
  }

  const csvGenerated = writes.get("CREDITS.csv") || "";
  const metadataJS = writes.get("item-metadata.js") || "";
  const globals = extractMetadataGlobalsFromWrites(writes);

  return {
    csvGenerated,
    metadataJS,
    globals,
    writes,
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

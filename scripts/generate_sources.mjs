import fs from "fs";
import path from "path";
import { fork } from "child_process";
import { fileURLToPath } from "url";
import {
  CREDITS_OUTPUT,
  generateCreditsCsv,
  processItemCredits,
} from "./generateSources/credits.mjs";
import { loadPaletteMetadata } from "./generateSources/palettes.mjs";
import { parseItem } from "./generateSources/items.mjs";
import {
  parseTree,
  populateAndSortCategoryTree,
} from "./generateSources/tree.mjs";
import {
  buildMetadataJs,
  METADATA_OUTPUT,
  onlyIfTemplate,
  resetGeneratorState,
  SHEETS_DIR,
  readDirTree,
} from "./generateSources/state.mjs";

export function generateSources(deps = {}) {
  const writeFileSyncFn = deps.writeFileSync ?? fs.writeFileSync;
  const parseTreeFn = deps.parseTreeFn ?? parseTree;
  const parseItemFn = deps.parseItemFn ?? parseItem;
  const processItemCreditsFn = deps.processItemCreditsFn ?? processItemCredits;
  const loadPaletteMetadataFn = deps.loadPaletteMetadataFn ?? loadPaletteMetadata;
  const readDirTreeFn = deps.readDirTreeFn ?? readDirTree;
  const writeMetadata = deps.writeMetadata ?? false;
  const metadataOutputPath = deps.metadataOutputPath ?? METADATA_OUTPUT;

  resetGeneratorState();

  loadPaletteMetadataFn();

  // Read sheet_definitions/*.json line by line
  const files = readDirTreeFn(SHEETS_DIR);

  files.forEach((file) => {
    if (file.isDirectory()) {
      return;
    }

    if (file.name.startsWith("meta_")) {
      parseTreeFn(file.parentPath, file.name);
      return;
    }

    try {
      const { itemId, definition } = parseItemFn(file.parentPath, file.name);
      processItemCreditsFn(itemId, file.parentPath, definition);
    } catch (e) {
      const fullPath = path.join(file.parentPath, file.name);
      if (!onlyIfTemplate)
        console.error(`Error parsing sheet file json data: ${fullPath}`, e);
    }
  });

  // Build and sort category tree for runtime metadata output.
  populateAndSortCategoryTree();

  // Write Credits CSV Output
  const csvGenerated = generateCreditsCsv();
  try {
    writeFileSyncFn(CREDITS_OUTPUT, csvGenerated);
    process.stdout.write("CSV Updated!\n");
  } catch (err) {
    console.error(err);
  }

  // Build and write item-metadata.js (optional: CLI / tests skip; Vite plugin enables)
  if (writeMetadata) {
    const metadataJS = buildMetadataJs();
    try {
      writeFileSyncFn(metadataOutputPath, metadataJS);
      process.stdout.write("Item Metadata JS Updated!\n");
    } catch (err) {
      console.error(err);
    }
  }
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isDirectExecution()) {
  fork("scripts/zPositioning/parse_zpos.js");
  generateSources({ writeMetadata: false });
}

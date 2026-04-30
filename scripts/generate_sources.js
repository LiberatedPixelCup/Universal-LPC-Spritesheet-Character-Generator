import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREDITS_OUTPUT,
  generateCreditsCsv,
  processItemCredits,
} from "./generateSources/credits.js";
import { loadPaletteMetadata } from "./generateSources/palettes.js";
import { parseItem } from "./generateSources/items.js";
import {
  parseTree,
  populateAndSortCategoryTree,
} from "./generateSources/tree.js";
import {
  buildAllMetadataModules,
  METADATA_OUTPUT,
  onlyIfTemplate,
  resetGeneratorState,
  SHEETS_DIR,
  readDirTree,
} from "./generateSources/state.js";

export function generateSources(deps = {}, legacyEnv) {
  const env = deps.env ?? legacyEnv ?? "production";
  const writeFileSyncFn = deps.writeFileSync ?? fs.writeFileSync;
  const parseTreeFn = deps.parseTreeFn ?? parseTree;
  const parseItemFn = deps.parseItemFn ?? parseItem;
  const processItemCreditsFn = deps.processItemCreditsFn ?? processItemCredits;
  const loadPaletteMetadataFn =
    deps.loadPaletteMetadataFn ?? loadPaletteMetadata;
  const readDirTreeFn = deps.readDirTreeFn ?? readDirTree;
  const writeMetadata = deps.writeMetadata ?? false;
  const writeCredits = deps.writeCredits ?? true;
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
  if (writeCredits) {
    const csvGenerated = generateCreditsCsv();
    try {
      writeFileSyncFn(CREDITS_OUTPUT, csvGenerated);
      process.stdout.write("CSV Updated!\n");
    } catch (err) {
      console.error(err);
    }
  }

  // Build and write five metadata ES modules (optional: CLI / tests skip; Vite plugin enables)
  if (writeMetadata) {
    const outDir = path.dirname(metadataOutputPath);
    const modules = buildAllMetadataModules(env);
    try {
      for (const [basename, source] of modules) {
        writeFileSyncFn(path.join(outDir, basename), source);
      }
      process.stdout.write("Metadata JS modules updated!\n");
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
  process.stderr.write(
    "This file is a library entry. To regenerate CREDITS.csv and z_positions.csv, run:\n  npm run validate-site-sources\n",
  );
  process.exit(1);
}

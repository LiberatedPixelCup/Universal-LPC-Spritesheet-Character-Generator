import fs from "node:fs";
import path from "node:path";
import { generateSources } from "../scripts/generate_sources.mjs";

/**
 * @param {string} filePath
 * @param {string} dirPath
 * @returns {boolean}
 */
function isPathInside(filePath, dirPath) {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dirPath);
  return (
    resolvedFile === resolvedDir ||
    resolvedFile.startsWith(resolvedDir + path.sep)
  );
}

/**
 * Vite plugin: generates `dist/item-metadata.js` from `sheet_definitions/` and
 * `palette_definitions/` before bundling. Does not fork z-position tooling (CLI only).
 * Skips writing `CREDITS.csv` so dev/build do not dirty the repo.
 *
 * @returns {import("vite").Plugin}
 */
export function vitePluginItemMetadata() {
  let root = process.cwd();
  let debounceTimer = null;

  function runGenerate() {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    const metadataOutputPath = path.join(root, "dist", "item-metadata.js");
    generateSources({
      writeMetadata: true,
      metadataOutputPath,
      writeFileSync: (filePath, contents) => {
        if (path.basename(filePath) === "CREDITS.csv") {
          return;
        }
        fs.writeFileSync(filePath, contents);
      },
    });
  }

  function scheduleRegenerate() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runGenerate();
    }, 150);
  }

  return {
    name: "vite-plugin-item-metadata",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      runGenerate();
    },
    configureServer(server) {
      const sheetDefinitions = path.join(root, "sheet_definitions");
      const paletteDefinitions = path.join(root, "palette_definitions");
      server.watcher.add(sheetDefinitions);
      server.watcher.add(paletteDefinitions);

      const onFsEvent = (filePath) => {
        if (
          isPathInside(filePath, sheetDefinitions) ||
          isPathInside(filePath, paletteDefinitions)
        ) {
          scheduleRegenerate();
        }
      };

      server.watcher.on("change", onFsEvent);
      server.watcher.on("add", onFsEvent);
      server.watcher.on("unlink", onFsEvent);
    },
  };
}

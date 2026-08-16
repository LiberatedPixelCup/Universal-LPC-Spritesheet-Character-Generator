import fs from "node:fs";
import path from "node:path";
import { generateSources } from "../scripts/generate_sources.ts";
import {
  computeSourceInputsFingerprint,
  getSourceInputsCachePath,
  readStoredSourceInputsFingerprint,
  writeStoredSourceInputsFingerprint,
} from "../scripts/generateSources/source_inputs_fingerprint.js";
import { writeZPositionsFromSheetsSync } from "../scripts/zPositioning/write_z_positions_from_sheets.ts";

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
 * @param {string} root
 */
function hasRepoLayout(root) {
  return (
    fs.existsSync(path.join(root, "sheet_definitions")) &&
    fs.existsSync(path.join(root, "palette_definitions"))
  );
}

/**
 * @param {string} root
 */
function distMetadataExists(root) {
  return fs.existsSync(path.join(root, "dist", "index-metadata.js"));
}

function shouldForceRegenerateFromEnv() {
  const v = process.env.VITE_REGENERATE_SOURCES;
  return v === "1" || v === "true";
}

/**
 * Vite plugin: generates five metadata ES modules under `dist/`, and when `sheet_definitions/`
 * + `palette_definitions/` inputs are unchanged, skips re-running. When inputs are new, changed,
 * or `dist` metadata is missing, also runs `z_positions` + `CREDITS.csv` (same as `validate-site-sources`).
 * Use `VITE_REGENERATE_SOURCES=1` to always run the full pipeline.
 *
 * @param {"development"|"production"} [env="production"] Passed through to
 *   `generateSources` / `JSON.stringify` indent: development pretty-prints embedded JSON;
 *   production emits compact JSON.
 * @param {{ generateSources?: typeof generateSources }} [pluginOptions] Optional overrides
 *   (used by Node tests to stub `generateSources`).
 * @returns {import("vite").Plugin}
 */
export function vitePluginItemMetadata(env = "production", pluginOptions = {}) {
  const generateSourcesFn = pluginOptions.generateSources ?? generateSources;
  let root = process.cwd();
  let debounceTimer = null;

  function runMetadataOnly() {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    const metadataOutputPath = path.join(root, "dist", "item-metadata.js");
    generateSourcesFn({
      writeMetadata: true,
      writeCredits: false,
      metadataOutputPath,
      env,
      writeFileSync: fs.writeFileSync,
    });
  }

  function runFullSourcePipeline() {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    const metadataOutputPath = path.join(root, "dist", "item-metadata.js");
    writeZPositionsFromSheetsSync({ root });
    generateSourcesFn({
      writeMetadata: true,
      writeCredits: true,
      metadataOutputPath,
      env,
      writeFileSync: fs.writeFileSync,
    });
    const fp = computeSourceInputsFingerprint({ root });
    writeStoredSourceInputsFingerprint(getSourceInputsCachePath(root), fp);
  }

  function shouldSkipByFingerprint() {
    if (shouldForceRegenerateFromEnv()) {
      return false;
    }
    if (!distMetadataExists(root)) {
      return false;
    }
    const current = computeSourceInputsFingerprint({ root });
    const previous = readStoredSourceInputsFingerprint(
      getSourceInputsCachePath(root),
    );
    return previous !== null && previous === current;
  }

  function maybeRegenerate() {
    if (!hasRepoLayout(root)) {
      runMetadataOnly();
      return;
    }
    if (shouldSkipByFingerprint()) {
      return;
    }
    runFullSourcePipeline();
  }

  function scheduleRegenerate() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (hasRepoLayout(root)) {
        runFullSourcePipeline();
      } else {
        runMetadataOnly();
      }
    }, 150);
  }

  return {
    name: "vite-plugin-item-metadata",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    buildStart() {
      maybeRegenerate();
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

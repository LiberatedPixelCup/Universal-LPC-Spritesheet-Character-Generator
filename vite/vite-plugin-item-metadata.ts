import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  generateSources,
  type GenerateSourcesDeps,
} from "../scripts/generate_sources.ts";
import {
  BODY_SPRITE_DIR,
  listBodySpritePaths,
  type MetadataEnv,
} from "../scripts/generateSources/state.ts";
import {
  computeSourceInputsFingerprint,
  getSourceInputsCachePath,
  readStoredSourceInputsFingerprint,
  writeStoredSourceInputsFingerprint,
} from "../scripts/generateSources/source_inputs_fingerprint.ts";
import { writeZPositionsFromSheetsSync } from "../scripts/zPositioning/write_z_positions_from_sheets.ts";

export type VitePluginItemMetadataOptions = {
  generateSources?: (deps?: GenerateSourcesDeps) => void;
};

function isPathInside(filePath: string, dirPath: string): boolean {
  const resolvedFile = path.resolve(filePath);
  const resolvedDir = path.resolve(dirPath);
  return (
    resolvedFile === resolvedDir ||
    resolvedFile.startsWith(resolvedDir + path.sep)
  );
}

function hasRepoLayout(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "sheet_definitions")) &&
    fs.existsSync(path.join(root, "palette_definitions"))
  );
}

function distMetadataExists(root: string): boolean {
  return fs.existsSync(path.join(root, "dist", "index-metadata.js"));
}

function shouldForceRegenerateFromEnv(): boolean {
  const v = process.env.VITE_REGENERATE_SOURCES;
  return v === "1" || v === "true";
}

/**
 * Vite plugin: generates five metadata ES modules under `dist/`, and when
 * definition, generator and Body PNG path inputs are unchanged, skips re-running. When inputs are new, changed, or
 * `dist` metadata is missing, also runs `z_positions` + `CREDITS.csv` (same as
 * `validate-site-sources`). Use `VITE_REGENERATE_SOURCES=1` to always run the
 * full pipeline.
 */
export function vitePluginItemMetadata(
  env: MetadataEnv = "production",
  pluginOptions: VitePluginItemMetadataOptions = {},
): Plugin {
  const generateSourcesFn = pluginOptions.generateSources ?? generateSources;
  let root = process.cwd();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function runMetadataOnly() {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    const metadataOutputPath = path.join(root, "dist", "item-metadata.js");
    generateSourcesFn({
      writeMetadata: true,
      writeCredits: false,
      metadataOutputPath,
      bodySpritePaths: listBodySpritePaths(root),
      env,
      writeFileSync: fs.writeFileSync,
    });
  }

  function runFullSourcePipeline(bodySpritePaths = listBodySpritePaths(root)) {
    fs.mkdirSync(path.join(root, "dist"), { recursive: true });
    const metadataOutputPath = path.join(root, "dist", "item-metadata.js");
    writeZPositionsFromSheetsSync({ root });
    generateSourcesFn({
      writeMetadata: true,
      writeCredits: true,
      metadataOutputPath,
      bodySpritePaths,
      env,
      writeFileSync: fs.writeFileSync,
    });
    const fp = computeSourceInputsFingerprint({ root, bodySpritePaths });
    writeStoredSourceInputsFingerprint(getSourceInputsCachePath(root), fp);
  }

  function shouldSkipByFingerprint(bodySpritePaths: readonly string[]) {
    if (shouldForceRegenerateFromEnv()) {
      return false;
    }
    if (!distMetadataExists(root)) {
      return false;
    }
    const current = computeSourceInputsFingerprint({ root, bodySpritePaths });
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
    const bodySpritePaths = listBodySpritePaths(root);
    if (shouldSkipByFingerprint(bodySpritePaths)) {
      return;
    }
    runFullSourcePipeline(bodySpritePaths);
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
      const bodySprites = path.join(root, BODY_SPRITE_DIR);
      server.watcher.add(sheetDefinitions);
      server.watcher.add(paletteDefinitions);
      server.watcher.add(bodySprites);

      const onFsEvent = (filePath: string) => {
        if (
          isPathInside(filePath, sheetDefinitions) ||
          isPathInside(filePath, paletteDefinitions)
        ) {
          scheduleRegenerate();
        }
      };

      const onPathChange = (filePath: string) => {
        if (
          isPathInside(filePath, bodySprites) &&
          path.extname(filePath) === ".png"
        ) {
          scheduleRegenerate();
        } else {
          onFsEvent(filePath);
        }
      };

      server.watcher.on("change", onFsEvent);
      server.watcher.on("add", onPathChange);
      server.watcher.on("unlink", onPathChange);
    },
  };
}

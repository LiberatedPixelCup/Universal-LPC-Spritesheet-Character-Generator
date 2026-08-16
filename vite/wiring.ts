import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Alias, Plugin } from "vite";
import {
  METADATA_MODULE_BASENAMES,
  type MetadataEnv,
} from "../scripts/generateSources/state.ts";
import {
  vitePluginItemMetadata,
  type VitePluginItemMetadataOptions,
} from "./vite-plugin-item-metadata.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

export type ItemMetadataCodeSplittingGroup = {
  name: string;
  test: RegExp;
  priority: number;
  minSize: number;
  maxSize: number;
  maxModuleSize: number;
};

function distMetadata(basename: string): string {
  return path.resolve(projectRoot, "dist", basename);
}

function escapeForRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `resolve.alias` entries so the app and browser tests resolve generated metadata from `dist/`.
 * Uses a regexp because root-level `*.js` metadata entry points are removed; Rolldown still needs to
 * rewrite `../item-metadata.js` (and similar) to `dist/` without an on-disk target at the alias key.
 * Basenames come from [`METADATA_MODULE_BASENAMES`](../scripts/generateSources/state.ts) (Commit 4).
 */
export function itemMetadataResolveAliases(): Alias[] {
  return METADATA_MODULE_BASENAMES.map((basename) => ({
    find: new RegExp(`^(.+[\\\\/])?${escapeForRegExp(basename)}$`),
    replacement: distMetadata(basename),
  }));
}

/**
 * Rolldown `codeSplitting.groups` entries (excluding `vendor`) for each generated metadata chunk.
 */
export function itemMetadataCodeSplittingGroups(): ItemMetadataCodeSplittingGroup[] {
  return METADATA_MODULE_BASENAMES.map((basename) => ({
    name: basename.replace(/\.js$/, ""),
    test: new RegExp(`[\\\\/]${escapeForRegExp(basename)}$`),
    priority: 100,
    minSize: 0,
    maxSize: 10_000_000,
    maxModuleSize: 10_000_000,
  }));
}

/**
 * Maps Vite CLI `command` to the `env` value passed into metadata generation (PR #432 indent).
 */
export function metadataEnvForViteCommand(
  command: "build" | "serve",
): MetadataEnv {
  return command === "build" ? "production" : "development";
}

/**
 * Plugins for item-metadata generation (`enforce: "pre"` is set on the plugin).
 * Runs on **serve** and **build** (no `apply` filter).
 */
export function itemMetadataPlugins(
  command: "build" | "serve",
  pluginOptions?: VitePluginItemMetadataOptions,
): Plugin[] {
  const env = metadataEnvForViteCommand(command);
  return [vitePluginItemMetadata(env, pluginOptions)];
}

export { METADATA_MODULE_BASENAMES };

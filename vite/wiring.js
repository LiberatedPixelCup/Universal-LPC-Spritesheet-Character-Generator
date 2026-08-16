import path from "node:path";
import { fileURLToPath } from "node:url";
import { METADATA_MODULE_BASENAMES } from "../scripts/generateSources/state.ts";
import { vitePluginItemMetadata } from "./vite-plugin-item-metadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const distMetadata = (basename) => path.resolve(projectRoot, "dist", basename);

function escapeForRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `resolve.alias` entries so the app and browser tests resolve generated metadata from `dist/`.
 * Uses a regexp because root-level `*.js` metadata entry points are removed; Rolldown still needs to
 * rewrite `../item-metadata.js` (and similar) to `dist/` without an on-disk target at the alias key.
 * Basenames come from [`METADATA_MODULE_BASENAMES`](../scripts/generateSources/state.ts) (Commit 4).
 * @returns {import("vite").AliasOptions[]}
 */
export function itemMetadataResolveAliases() {
  return METADATA_MODULE_BASENAMES.map((basename) => ({
    find: new RegExp(`^(.+[\\\\/])?${escapeForRegExp(basename)}$`),
    replacement: distMetadata(basename),
  }));
}

/**
 * Rolldown `codeSplitting.groups` entries (excluding `vendor`) for each generated metadata chunk.
 * @returns {object[]}
 */
export function itemMetadataCodeSplittingGroups() {
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
 * @param {"build"|"serve"|string} command
 * @returns {"development"|"production"}
 */
export function metadataEnvForViteCommand(command) {
  return command === "build" ? "production" : "development";
}

/**
 * Plugins for item-metadata generation (`enforce: "pre"` is set on the plugin).
 * Runs on **serve** and **build** (no `apply` filter).
 * @param {"build"|"serve"|string} command
 * @param {Parameters<typeof vitePluginItemMetadata>[1]} [pluginOptions] Optional; forwarded to
 *   `vitePluginItemMetadata` (e.g. stub `generateSources` in Node tests).
 * @returns {import("vite").Plugin[]}
 */
export function itemMetadataPlugins(command, pluginOptions) {
  const env = metadataEnvForViteCommand(command);
  return [vitePluginItemMetadata(env, pluginOptions)];
}

export { METADATA_MODULE_BASENAMES };

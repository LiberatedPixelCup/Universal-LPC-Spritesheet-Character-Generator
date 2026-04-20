import path from "node:path";
import { fileURLToPath } from "node:url";
import { vitePluginItemMetadata } from "./vite-plugin-item-metadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const itemMetadataDist = path.resolve(projectRoot, "dist", "item-metadata.js");

/**
 * `resolve.alias` entries so the app and browser tests resolve generated metadata from `dist/`.
 * Uses a regexp because the root `item-metadata.js` file is removed; Rolldown still needs to
 * rewrite `../item-metadata.js` (and similar) to `dist/` without an on-disk target at the alias key.
 * @returns {import("vite").AliasOptions[]}
 */
export function itemMetadataResolveAliases() {
  return [
    {
      find: /^(.+[\\/])?item-metadata\.js$/,
      replacement: itemMetadataDist,
    },
  ];
}

/**
 * Plugins for item-metadata generation (`enforce: "pre"` is set on the plugin).
 * Runs on **serve** and **build** (no `apply` filter).
 * @returns {import("vite").Plugin[]}
 */
export function itemMetadataPlugins() {
  return [vitePluginItemMetadata()];
}

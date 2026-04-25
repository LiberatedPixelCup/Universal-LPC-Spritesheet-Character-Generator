import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { getSpritesheetsPlugin } from "./vite/get-spritesheets-plugin.js";
import { vitePluginPreviewServeDistSpritesheets } from "./vite/vite-plugin-preview-serve-dist-spritesheets.js";
import { vitePluginBundledCssAfterBulma } from "./vite/vite-plugin-bundled-css-after-bulma.js";
import { vitePluginPurgeCriticalCss } from "./vite/vite-plugin-purge-critical-css.js";
import { vitePluginMetadataModulePreload } from "./vite/vite-plugin-metadata-modulepreload.js";
import {
  itemMetadataCodeSplittingGroups,
  itemMetadataPlugins,
  itemMetadataResolveAliases,
} from "./vite/wiring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Item-metadata pipeline (Commit 4): `vite/wiring.js` registers the pre-plugin,
 * `resolve.alias`, and Rolldown chunk groups for generated metadata modules. Testem’s Vite
 * middleware loads this file via `configFile` so browser tests get the same behavior. Other
 * plugins stay below.
 */

export default defineConfig(({ command }) => ({
  base: "./",
  publicDir: false,
  logLevel: "info",
  resolve: {
    alias: [
      {
        find: "mocha-globals",
        replacement: path.resolve(__dirname, "tests/bdd-globals.js"),
      },
      ...itemMetadataResolveAliases(),
    ],
  },
  build: {
    rolldownOptions: {
      input: {
        main: "index.html",
      },
      output: {
        codeSplitting: {
          minSize: 20000,
          maxSize: 200000,
          minModuleSize: 20000,
          maxModuleSize: 200000,
          groups: [
            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
            },
            ...itemMetadataCodeSplittingGroups(),
          ],
        },
      },
    },
    target: "esnext",
    emptyOutDir: false, // see npm run prebuild
  },
  css: {
    target: false,
    preprocessorOptions: {
      scss: { quietDeps: true },
      sass: { quietDeps: true },
    },
  },
  plugins: [
    vitePluginPreviewServeDistSpritesheets(),
    ...itemMetadataPlugins(command),
    vitePluginMetadataModulePreload(),
    vitePluginBundledCssAfterBulma(),
    getSpritesheetsPlugin(command),
    vitePluginPurgeCriticalCss(),
  ],
}));

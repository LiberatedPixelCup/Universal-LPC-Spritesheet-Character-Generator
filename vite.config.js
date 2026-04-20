import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { getSpritesheetsPlugin } from "./vite/get-spritesheets-plugin.js";
import { vitePluginBundledCssAfterBulma } from "./vite/vite-plugin-bundled-css-after-bulma.js";
import {
  itemMetadataPlugins,
  itemMetadataResolveAliases,
} from "./vite/wiring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Item-metadata pipeline (plan step 4): `vite/wiring.js` registers the pre-plugin and
 * `resolve.alias` for both **serve** and **build**. Testem’s Vite middleware loads this file
 * via `configFile` so browser tests get the same behavior. Other plugins stay below.
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
            {
              name: "item-metadata",
              test: /[/\\]item-metadata\.js$/,
              priority: 100,
              minSize: 0,
              maxSize: 10_000_000,
              maxModuleSize: 10_000_000,
            },
          ],
        },
      },
    },
    target: "esnext",
    emptyOutDir: false, // see npm run prebuild
  },
  css: {
    target: false,
  },
  plugins: [
    ...itemMetadataPlugins(),
    vitePluginBundledCssAfterBulma(),
    getSpritesheetsPlugin(command),
  ],
}));

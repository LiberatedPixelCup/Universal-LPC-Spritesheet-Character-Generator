import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { getSpritesheetsPlugin } from "./vite/get-spritesheets-plugin.ts";
import { vitePluginPreviewServeDistSpritesheets } from "./vite/vite-plugin-preview-serve-dist-spritesheets.ts";
import { vitePluginBundledCssAfterBulma } from "./vite/vite-plugin-bundled-css-after-bulma.ts";
import { vitePluginPurgeCriticalCss } from "./vite/vite-plugin-purge-critical-css.ts";
import { vitePluginMetadataModulePreload } from "./vite/vite-plugin-metadata-modulepreload.ts";
import {
  itemMetadataCodeSplittingGroups,
  itemMetadataPlugins,
  itemMetadataResolveAliases,
} from "./vite/wiring.ts";
import istanbul from "vite-plugin-istanbul";
import { vitePluginCoverageCollect } from "./vite/vite-plugin-coverage-collect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coverageEnabled = process.env.VITE_COVERAGE === "true";

/**
 * Item-metadata pipeline (Commit 4): `vite/wiring.ts` registers the pre-plugin,
 * `resolve.alias`, and Rolldown chunk groups for generated metadata modules. Testem’s Vite
 * middleware loads this file so browser tests get the same behavior. Other plugins stay below.
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
    ...(coverageEnabled
      ? [
          istanbul({
            include: "sources/**",
            exclude: ["node_modules", "tests", "dist"],
            extension: [".js", ".ts"],
            requireEnv: true,
            cypress: false,
            checkProd: false,
          }),
          vitePluginCoverageCollect(),
        ]
      : []),
  ],
}));

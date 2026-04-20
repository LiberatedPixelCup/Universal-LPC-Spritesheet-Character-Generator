import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { run } from "vite-plugin-run";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @returns {string[]} Command and args for vite-plugin-run (first element is the executable). */
function copySpritesheetsRsyncRun() {
  return [
    "rsync",
    "-ahu",
    "--delete",
    "--info=progress2",
    "--no-inc-recursive",
    "spritesheets",
    "dist",
  ];
}

/**
 * Windows: mirror `spritesheets/` into `dist/spritesheets` with robocopy (same flags as before).
 * Robocopy uses exit codes 0–7 for success; ≥8 is failure — we fail the build only on real errors.
 */
function vitePluginCopySpritesheetsRobocopy() {
  return {
    name: "copy-spritesheets-robocopy",
    apply: "build",
    closeBundle() {
      const dest = path.join("dist", "spritesheets");
      const result = spawnSync(
        "robocopy",
        [
          "spritesheets",
          dest,
          "/MIR",
          "/Z",
          "/XO",
          "/MT:8",
          "/NFL",
          "/NDL",
          "/NJH",
          "/NJS",
          "/NP",
        ],
        { stdio: "inherit", shell: false, windowsHide: true },
      );
      if (result.error) {
        throw result.error;
      }
      const code = result.status;
      if (code === null) {
        throw new Error("robocopy was terminated by a signal");
      }
      if (code >= 8) {
        throw new Error(`robocopy failed with exit code ${code}`);
      }
    },
  };
}

/**
 * Plugin that keeps spritesheets available to Vite: in dev, serve the tree from disk; on build,
 * copy (mirror) `spritesheets/` into `dist/spritesheets` so the production output matches the repo.
 *
 * - **Dev (`vite`, `command === "serve"`):** serve `public/` and `spritesheets/` (no `dist/` copy).
 * - **Build on Windows:** robocopy into `dist/` with exit codes mapped so real failures fail the build.
 * - **Build on macOS / Linux:** `rsync` via `vite-plugin-run`.
 *
 * @param {"serve" | "build"} command Vite CLI command from `defineConfig`.
 */
function getSpritesheetsPlugin(command) {
  if (command === "serve") {
    return DynamicPublicDirectory(["public/**", "{\x01,spritesheets}/**"]);
  }

  if (process.platform === "win32") {
    return vitePluginCopySpritesheetsRobocopy();
  }

  return run({
    input: [
      {
        name: "copy spritesheets",
        run: copySpritesheetsRsyncRun,
        condition: () => true,
        onFileChanged: () => {},
      },
    ],
    silent: false,
  });
}

/**
 * Vite injects the extracted entry CSS after module scripts in built HTML.
 * Keep Bulma first, then the app bundle (same cascade as source index.html).
 */
function vitePluginBundledCssAfterBulma() {
  return {
    name: "bundled-css-after-bulma",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const stylesheetLinkRe = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
        const bundled = [];
        let m;
        while ((m = stylesheetLinkRe.exec(html)) !== null) {
          const tag = m[0];
          // With `base: "./"`, href is `./assets/...`; older builds used `/assets/...`.
          if (
            /assets\/[^"'>\s]+\.css\b/.test(tag) &&
            !/https?:\/\//i.test(tag)
          ) {
            bundled.push(tag);
          }
        }
        if (bundled.length === 0) {
          return html;
        }

        let out = html;
        for (const tag of bundled) {
          out = out.replace(tag, "");
        }

        const bulmaRe =
          /(<link\b[^>]*\brel=["']stylesheet["'][^>]*bulma[^>]*>)/i;
        if (!bulmaRe.test(out)) {
          return html;
        }

        return out.replace(
          bulmaRe,
          (_, bulmaTag) => `${bulmaTag}\n\t${bundled.join("\n\t")}`,
        );
      },
    },
  };
}

export default defineConfig(({ command }) => ({
  base: "./",
  publicDir: false,
  logLevel: "info",
  resolve: {
    alias: {
      "mocha-globals": path.resolve(__dirname, "tests/bdd-globals.js"),
    },
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
  plugins: [vitePluginBundledCssAfterBulma(), getSpritesheetsPlugin(command)],
}));

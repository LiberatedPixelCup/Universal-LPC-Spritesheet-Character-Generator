import { defineConfig } from "vite";
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { run } from "vite-plugin-run";

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
    vitePluginBundledCssAfterBulma(),
    command === "serve"
      ? DynamicPublicDirectory(["public/**", "{\x01,spritesheets}/**"])
      : run({
          input: [
            {
              name: "copy spritesheets",
              run: [
                "rsync",
                "-ah",
                "--ignore-existing",
                "--info=progress2",
                "--no-inc-recursive",
                "spritesheets",
                "dist",
              ],
              condition: () => true,
              onFileChanged: () => {},
            },
          ],
          silent: false,
        }),
  ],
}));

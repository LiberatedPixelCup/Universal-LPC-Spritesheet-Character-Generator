import { defineConfig } from "vite";
import { DynamicPublicDirectory } from "vite-multiple-assets";
import { run } from "vite-plugin-run";

export default defineConfig(({ command }) => ({
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

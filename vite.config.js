import { defineConfig } from "vite";
import { DynamicPublicDirectory } from "vite-multiple-assets";

export default defineConfig({
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
      output: {
        codeSplitting: {
          minSize: 20000,
          maxSize: 200000,
          minModuleSize: 20000,
          maxModuleSize: 200000,
          maxInitialChunkSize: 200000,
          maxAsyncChunkSize: 200000,
        },
        groups: [
          {
            name: "vendor",
            test: /node_modules/,
          },
        ],
      },
    },
    target: "esnext",
  },
  css: {
    target: false,
  },
  plugins: [DynamicPublicDirectory(["public/**", "{\x01,spritesheets}/**"])],
});

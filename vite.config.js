import { defineConfig } from "vite";
import { DynamicPublicDirectory } from "vite-multiple-assets";

export default defineConfig({
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
  plugins: [DynamicPublicDirectory(["public/**", "{\x01,spritesheets}/**"])],
});

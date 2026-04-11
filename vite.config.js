import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});

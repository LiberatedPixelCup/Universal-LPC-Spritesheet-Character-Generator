import { mergeConfig } from "vite";
import { defineConfig } from "vitest/config";
import viteConfigExport from "./vite.config.js";
import { playwright } from "@vitest/browser-playwright";

const viteConfig =
  typeof viteConfigExport === "function"
    ? viteConfigExport({ command: "serve", mode: "test" })
    : viteConfigExport;

const vitestDebug =
  process.env.DEBUG === "true" || process.env.DEBUG === "1" ? "true" : "false";

export default mergeConfig(
  viteConfig,
  defineConfig({
    define: {
      "import.meta.env.VITEST_DEBUG": JSON.stringify(vitestDebug),
    },
    // One Chai instance for both `import { expect } from "chai"` and @vitest/expect;
    // duplicate graphs in browser mode can leave `config` undefined (import-time TypeError).
    resolve: {
      dedupe: ["chai"],
    },
    optimizeDeps: {
      include: ["chai"],
    },
    test: {
      browser: {
        enabled: true,
        provider: playwright({
          launchOptions: {
            firefoxUserPrefs: {
              "browser.aboutwelcome.enabled": false,
              "browser.startup.homepage": "about:blank",
              "browser.startup.page": 0,
              "browser.startup.firstrunSkipsHomepage": true,
              "browser.startup.homepage_override.mstone": "ignore",
              "browser.startup.homepage_welcome_url": "",
              "browser.startup.homepage_welcome_url.additional": "",
              "browser.startup.cohort": "ignore",
              "browser.messaging-system.prompts.enabled": false,
              "browser.onboarding.enabled": false,
              "browser.tour.enabled": false,
              "browser.startup.upgradeDialog.enabled": false,
              "browser.uiCustomization.skipDefaultState": true,
              "toolkit.telemetry.enabled": false,
              "toolkit.telemetry.unified": false,
              "media.hardware-video-decoding.enabled": false,
            },
          },
        }),
        instances: [
          { browser: "chromium" },
          { browser: "firefox" },
          { browser: "webkit" },
        ],
        headless: true,
      },
      setupFiles: ["tests/vitest-setup.js"],
      include: ["tests/**/*_spec.js"],
      testTimeout: 30_000,
    },
  }),
);

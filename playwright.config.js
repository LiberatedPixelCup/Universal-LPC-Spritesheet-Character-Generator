import { defineConfig } from "@playwright/test";
import { createArgosReporterOptions } from "@argos-ci/playwright/reporter";

export default defineConfig({
  testDir: "./tests/visual",
  webServer: {
    command: process.env.CI
      ? "npm run build && npm run preview -- --port 5173 && sleep 3"
      : "npm run dev && sleep 10",
    timeout: 120000,
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    process.env.CI ? ["dot"] : ["list"],
    [
      "@argos-ci/playwright/reporter",
      createArgosReporterOptions({
        uploadToArgos: !!process.env.ARGOS_TOKEN?.trim(),
      }),
    ],
  ],
  use: {
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    bypassCSP: true,
  },
});

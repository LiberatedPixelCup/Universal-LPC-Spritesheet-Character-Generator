"use strict";

const path = require("node:path");
const { createTestemViteMiddleware } = require("vite-plugin-testem");

// Suppress app debug logs during tests by default (?debug=false), so localhost does not
// enable window.DEBUG via getDebugParam(). Set DEBUG=true or DEBUG=1 in the environment
// when launching testem to keep verbose debug output (same as opening tests_run.html without
// ?debug=false on localhost).
const testPageFromEnv =
  process.env.DEBUG === "true" || process.env.DEBUG === "1"
    ? "tests_run.html"
    : "tests_run.html?debug=false";

const vitestDebugEnv =
  process.env.DEBUG === "true" || process.env.DEBUG === "1" ? "true" : "false";

let viteClose;

let testemConfig = {
  // Firefox prefs: see tests/testem-firefox-user.js (replaces Testem’s default user.js).
  firefox_user_js: path.join(__dirname, "tests/testem-firefox-user.js"),
  framework: "mocha+chai",
  // Override when 7357 is busy: `TESTEM_PORT=7360 npm test`
  port: Number.parseInt(process.env.TESTEM_PORT ?? "7357", 10),
  test_page: testPageFromEnv,
  before_tests: "node ./tests/node/run-node-tests.js",
  parallel: 2,
  debug: true,
  disable_watching: true,
  launch_in_ci: ["Chrome", "Firefox"],
  launch_in_dev: [
    "Chrome",
    "Firefox",
    ...(process.platform === "darwin" ? ["Safari"] : []),
  ],
  browser_start_timeout: 30,
  src_files: [
    "tests/**/*.js",
    "sources/**/*.js",
    "vite.config.js",
    "tests_run.html",
  ],
  browser_args: {
    Chrome: {
      dev: [
        "--disable-popup-blocking",

        // Keep running tests even if tab is in background
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",

        // Fewer first-run / crash-recovery popups when opening Chrome manually (e.g. on Windows)
        "--disable-infobars",
        "--disable-session-crashed-bubble",
      ],
      ci: [
        // needed to run ci mode locally on MacOS ARM
        process.env.CI ? null : "--use-gl=angle",

        "--headless",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-popup-blocking",
        "--mute-audio",
        "--remote-debugging-port=0",
        "--window-size=1680,1024",
        "--enable-logging=stderr",
        // Extra quieting for fresh profiles (esp. Windows); Testem also adds no-first-run et al.
        "--disable-infobars",
        "--disable-session-crashed-bubble",
        // Omit --user-data-dir: Testem already sets a per-run temp profile. A second flag breaks
        // Chrome on some setups (e.g. macOS), and /tmp is not valid on Windows.
      ].filter(Boolean),
    },
    Firefox: {
      dev: [],
      // No Chromium-only flags (e.g. --no-sandbox). Prefs live in tests/testem-firefox-user.js.
      ci: ["-headless"],
    },
  },
};

// Testem's stock Safari launcher opens a temp start.html via file://, which triggers macOS/Safari
// prompts. Launch the Testem HTTP URL with `open` instead.
if (process.platform === "darwin") {
  testemConfig.launchers = {
    Safari: {
      protocol: "browser",
      exe: "/usr/bin/open",
      args(_config, url) {
        return ["-a", "Safari", url];
      },
    },
  };
}

module.exports = async function testemConfigFactory() {
  const { middleware, close } = await createTestemViteMiddleware({
    root: path.join(__dirname),
    define: {
      "import.meta.env.VITEST_DEBUG": JSON.stringify(vitestDebugEnv),
    },
  });
  viteClose = close;

  return {
    ...testemConfig,
    middleware: [middleware],
    on_exit(config, data, callback) {
      if (!viteClose) {
        return callback(null);
      }
      viteClose()
        .then(() => callback(null))
        .catch(callback);
    },
  };
};

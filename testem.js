"use strict";

const path = require("path");
const { createTestemViteMiddleware } = require("vite-plugin-testem");

// Suppress app debug logs during tests by default (?debug=false), so localhost does not
// enable window.DEBUG via getDebugParam(). Set DEBUG=true or DEBUG=1 in the environment
// when launching testem to keep verbose debug output (same as opening tests_run.html without
// ?debug=false on localhost).
const testPageFromEnv =
  process.env.DEBUG === "true" || process.env.DEBUG === "1"
    ? "tests_run.html"
    : "tests_run.html?debug=false";

// Extra --pref flags (Testem still writes its default user.js via firefoxSetup unless firefox_user_js is set).
const firefoxQuietPrefs = [
  "--pref",
  "browser.aboutwelcome.enabled=false",
  "--pref",
  "browser.startup.homepage=about:blank",
  "--pref",
  "browser.startup.page=0",
  "--pref",
  "browser.startup.firstrunSkipsHomepage=true",
  "--pref",
  "browser.startup.homepage_override.mstone=ignore",
  "--pref",
  "browser.startup.homepage_welcome_url=",
  "--pref",
  "browser.startup.homepage_welcome_url.additional=",
  "--pref",
  "browser.startup.cohort=ignore",
  "--pref",
  "browser.messaging-system.prompts.enabled=false",
  "--pref",
  "browser.onboarding.enabled=false",
  "--pref",
  "browser.tour.enabled=false",
  "--pref",
  "browser.startup.upgradeDialog.enabled=false",
  "--pref",
  "browser.uiCustomization.skipDefaultState=true",
  "--pref",
  "toolkit.telemetry.enabled=false",
  "--pref",
  "toolkit.telemetry.unified=false",
];

const vitestDebugEnv =
  process.env.DEBUG === "true" || process.env.DEBUG === "1" ? "true" : "false";

let viteClose;

let testemConfig = {
  framework: "mocha+chai",
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
      dev: firefoxQuietPrefs,
      ci: [
        "-headless",
        "--no-sandbox",
        ...firefoxQuietPrefs,
        "--pref",
        "gfx.direct2d.disabled=true",
        "--pref",
        "layers.acceleration.disabled=true",
        "--pref",
        "media.hardware-video-decoding.enabled=false",
      ],
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

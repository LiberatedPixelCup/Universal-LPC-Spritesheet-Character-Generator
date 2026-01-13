"use strict";

let testemConfig = {
  adapter: "custom",
  src_files: ["tests/ospec-adapter.js"],
  parallel: 2,
  debug: true,
  test_page: "tests_run.html",
  disable_watching: true,
  launch_in_ci: ["Chrome", "Firefox"],
  launch_in_dev: ["Chrome", "Firefox", "Safari"],
  browser_start_timeout: 30,
  browser_args: {
    Chrome: {
      dev: [
        "--disable-popup-blocking",

        // Keep running tests even if tab is in background
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
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
        "--user-data-dir=/tmp",
      ].filter(Boolean),
    },
    Firefox: {
      dev: [],
      ci: [
        "-headless",
        "--no-sandbox",
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

if (!process.env.CI) {
  testemConfig.launch_in_ci.push("Safari"); // Run Safari tests when not on Travis
}

module.exports = testemConfig;
